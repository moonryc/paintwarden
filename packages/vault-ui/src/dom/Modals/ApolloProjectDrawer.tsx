import { useFragment } from "@apollo/client/react";
import { Button, Chip } from "@mui/material";
import Box from "@mui/material/Box";
import { lazy, Suspense, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageSkeleton } from "../Components/PageSkeletons";
import { ProjectPaintSummaryView } from "../Components/ProjectPaintSummary";
import { ProjectRecipeView } from "../Components/ProjectRecipe";
import { QueryErrorNotice } from "../Components/QueryErrorNotice";
import { StageStepper } from "../Components/StageStepper";
import { dialogPreloadHandlers } from "../dialog-preload";
import { MiniatureTileFragmentDoc, type DetailPaintFragment } from "../graphql/generated/graphql";
import { useMiniatureActions } from "../graphql/miniature-actions";
import { useMiniatureDetail } from "../graphql/miniature-detail-hooks";
import type { MiniatureDetailView } from "../graphql/miniature-detail-loader";
import { paintModel, schemeEntryModels } from "../graphql/miniature-scheme-model";
import { useVaultGraphQL } from "../graphql/provider";
import { usePaintStock } from "../graphql/stock-actions";
import { i18n } from "../i18n";
import { Pencil } from "../icons";
import { useVaultStore } from "../store/hooks";
import { up } from "../theme-tokens";
import type { Miniature, Paint, PaintingStatus, PaintStatus, RecipeStep } from "../types";
import { getStages, getSteps, noop } from "../utils/constants";
import { useDrawerRenderTiming } from "../utils/drawer-render-timing";

import { ApolloSchemePickerDialog } from "./ApolloSchemePickerDialog";
import { ImageViewer } from "./ImageViewer";
import { MiniatureForm } from "./MiniatureForm";
import { ProjectDrawerFrame } from "./ProjectDrawerFrame";
import { ProjectHero } from "./ProjectHero";
// Scanning/color tools and secondary overlays must not be parsed on first open.
const SwatchScan = lazy(() => import("./SwatchScan").then((m) => ({ default: m.SwatchScan })));
const PaintDetailsOverlay = lazy(() =>
  import("./PaintDetailsOverlay").then((m) => ({ default: m.PaintDetailsOverlay })),
);
const ApolloProjectSchemeDialog = lazy(() =>
  import("./ApolloProjectSchemeDialog").then((m) => ({ default: m.ApolloProjectSchemeDialog })),
);

// This boundary never loads the legacy State snapshot, even when a project is
// opened directly from a paint's Used by link.
export function ApolloProjectDrawer({ miniatureId, onClose }: { miniatureId: string; onClose(): void }) {
  useDrawerRenderTiming("shell");
  const { t } = useTranslation("components");
  const detail = useMiniatureDetail(miniatureId);
  const scope = useVaultGraphQL();
  // A list-opened drawer already knows whether the hero has a photograph. Reuse
  // that normalized preview without issuing another read or inventing detail data.
  const preview = useFragment({
    fragment: MiniatureTileFragmentDoc,
    client: scope?.client,
    from: { __typename: "Miniature", id: miniatureId },
  });
  return (
    <ProjectContent
      key={miniatureId}
      data={detail.data}
      loading={detail.loading}
      error={detail.error}
      refresh={detail.refresh}
      onClose={onClose}
      title={detail.data?.miniature?.title ?? preview.data.title ?? t("miniature")}
      previewImage={preview.data.imageUrl === undefined ? undefined : Boolean(preview.data.imageUrl)}
    />
  );
}

function recipeStep(value: string): RecipeStep {
  const step = getSteps().find(([id]) => id === value)?.[0];
  if (!step) throw new Error(i18n.t("components:unknownRecipeStep", { value }));
  return step;
}

function ProjectContent({
  data,
  loading,
  error,
  refresh,
  onClose,
  title,
  previewImage,
}: {
  data: MiniatureDetailView | null;
  title: string;
  previewImage?: boolean;
  loading: boolean;
  error: Error | null;
  refresh(): void;
  onClose(): void;
}) {
  const { t } = useTranslation("components");
  useDrawerRenderTiming("content", Boolean(data?.miniature));
  const miniature = data?.miniature;
  const api = useVaultStore((s) => s.api);
  const notify = useVaultStore((s) => s.notify);
  const actions = useMiniatureActions();
  const { setPaintState } = usePaintStock();
  const [pending, setPending] = useState(0);
  const run = async (task: Promise<void>) => {
    setPending((old) => old + 1);
    try {
      await task;
    } finally {
      setPending((old) => old - 1);
    }
  };
  const model = useMemo(() => {
    if (!data || !miniature) return null;
    const schemes = data.attachedSchemes.map((read) => ({
      id: read.scheme!.id,
      name: read.scheme!.name,
      paintCount: read.scheme!.paintCount,
      ...schemeEntryModels(read.entries.nodes),
    }));
    const projections = new Map<string, DetailPaintFragment>();
    for (const row of data.recipe.nodes) projections.set(row.paint.id, row.paint);
    for (const paint of data.required.nodes) projections.set(paint.id, paint);
    for (const row of data.missing.nodes) projections.set(row.paint.id, row.paint);
    for (const read of data.attachedSchemes)
      for (const row of read.entries.nodes) if (row.paint) projections.set(row.paint.id, row.paint);
    const catalog = [...projections.values()].map(paintModel);
    const required = data.required.nodes.map(paintModel);
    const missing = data.missing.nodes.map((row) => paintModel(row.paint));
    const requirementRows = data.recipe.nodes.map((row) => ({
      ...row,
      miniatureId: miniature.id,
      paintId: row.paint.id,
      step: recipeStep(row.step),
    }));
    const issues = new Map(
      data.missing.nodes.map((row) => [
        row.paint.id,
        new Set<"missingStock" | "brokenSubstitution">([
          ...(row.missingStock ? ["missingStock" as const] : []),
          ...(row.brokenSubstitution ? ["brokenSubstitution" as const] : []),
        ]),
      ]),
    );
    const paintStates: Record<string, PaintStatus> = {};
    for (const paint of projections.values())
      if (paint.inventory?.state === "OWNED" || paint.inventory?.state === "WISHLIST")
        paintStates[paint.id] = paint.inventory.state;
    return { schemes, projections, catalog, required, missing, requirementRows, issues, paintStates };
  }, [data, miniature]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [openPaintId, setOpenPaintId] = useState<string | null>(null);
  const [openSchemeId, setOpenSchemeId] = useState<string | null>(null);
  // Keep both the frame and its session-state owner mounted when data arrives.
  // State stays above the responsive drawer/dialog host, so resizing still resets
  // scan pins without dismissing an open scan or losing pending edit UI.
  if (!data || !miniature || !model)
    return (
      <ProjectDrawerFrame title={title} onClose={onClose}>
        {error ? (
          <QueryErrorNotice error={error.message} onRetry={refresh} />
        ) : loading ? (
          <PageSkeleton page="miniature-detail" miniatureImage={previewImage} />
        ) : (
          <Box role="status">{t("thisMiniatureIsNoLongerAvailable")}</Box>
        )}
      </ProjectDrawerFrame>
    );
  const { schemes, projections, catalog, required, missing, requirementRows, issues, paintStates } = model;
  const saveMiniature = (patch: Partial<Miniature>) =>
    run(actions.update(miniature.id, { ...miniature, ...patch }));
  const setStage = (paintingStatus: PaintingStatus) => {
    const previous = miniature.paintingStatus;
    const label = getStages().find(([stage]) => stage === paintingStatus)?.[1] ?? paintingStatus;
    saveMiniature({ paintingStatus }).then(
      () =>
        notify(t("miniatureStageChanged", { name: miniature.title, stage: label }), "ok", {
          label: t("undo"),
          onClick: () => void saveMiniature({ paintingStatus: previous }).catch(noop),
        }),
      noop,
    );
  };
  const addAllToWishlist = (paints: Paint[]) => {
    for (const paint of paints) setPaintState(paint.id, "WISHLIST");
    notify(t("paintsAddedToWishlist", { count: paints.length }), "ok", {
      label: t("undo"),
      onClick: () => {
        for (const paint of paints) {
          const previous = projections.get(paint.id)?.inventory;
          if (previous?.state === "OWNED")
            setPaintState(
              paint.id,
              "OWNED",
              previous.stockLevel === "LOW" ? "LOW" : "FULL",
              previous.quantity,
            );
          else setPaintState(paint.id, previous?.state === "WISHLIST" ? "WISHLIST" : null);
        }
      },
    });
  };
  const details = [miniature.manufacturer, miniature.faction, miniature.scale].filter(Boolean);

  return (
    <ProjectDrawerFrame title={title} onClose={onClose}>
      <ProjectHero miniature={miniature} paints={required} onOpenImage={() => setImageViewerOpen(true)} />
      {scanOpen && (
        <Suspense fallback={null}>
          <SwatchScan miniatureId={miniature.id} onClose={() => setScanOpen(false)} />
        </Suspense>
      )}

      <Box
        component="div"
        sx={{
          boxSizing: "border-box",
          "& > :where(:not(:last-child))": { mb: 3 },
          p: 2,
          paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
          [up.md]: {
            "& > :where(:not(:last-child))": { mb: 3.5 },
            p: 3.5,
          },
        }}
      >
        {error && <QueryErrorNotice error={error.message} onRetry={refresh} />}
        <Box component="div" sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 1.5 }}>
          <Box component="div" sx={{ minWidth: "min(100%, 12rem)", flex: 1 }}>
            {details.length > 0 && (
              <Box component="div" sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1 }}>
                {details.map((value) => (
                  <Chip
                    key={value}
                    label={value}
                    size="small"
                    sx={{ bgcolor: "var(--sunken)", color: "var(--ink-soft)" }}
                  />
                ))}
              </Box>
            )}
            {miniature.notes ? (
              <Box
                component="p"
                sx={{ m: 0, fontSize: 14, lineHeight: 1.6, color: "var(--ink-soft)", whiteSpace: "pre-line" }}
              >
                {miniature.notes}
              </Box>
            ) : (
              <Button
                size="small"
                variant="text"
                startIcon={<Pencil size={13} />}
                {...dialogPreloadHandlers("miniature")}
                onClick={() => setEditingDetails(true)}
                sx={{ ml: -1, color: "var(--ink-faint)" }}
              >
                {t("addProjectNotes")}
              </Button>
            )}
          </Box>
          <Box component="div" sx={{ display: "flex", flexWrap: "wrap", gap: 1, ml: "auto" }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() =>
                void api("/api/miniature-templates", {
                  method: "POST",
                  body: JSON.stringify({ sourceMiniatureId: miniature.id }),
                })
                  .then(() => notify(t("miniatureSavedAsTemplate", { name: miniature.title })))
                  .catch(noop)
              }
            >
              {t("saveAsTemplate")}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Pencil size={14} />}
              {...dialogPreloadHandlers("miniature")}
              onClick={() => setEditingDetails(true)}
            >
              {t("edit")}
            </Button>
          </Box>
        </Box>

        <Box component="section" aria-labelledby="painting-stage-heading">
          <Box
            component="h3"
            id="painting-stage-heading"
            sx={{
              m: 0,
              mb: 0.7,
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            {t("paintingStage")}
          </Box>
          <StageStepper value={miniature.paintingStatus} onChange={setStage} />
        </Box>

        <ProjectPaintSummaryView
          miniatureId={miniature.id}
          required={required}
          missing={missing}
          onOpenPaint={setOpenPaintId}
          onAddAllToWishlist={addAllToWishlist}
          issues={issues}
          paintStates={paintStates}
          onSetPaintState={setPaintState}
        />

        <Box inert={pending > 0 || loading || Boolean(error)} aria-busy={pending > 0 || loading}>
          <ProjectRecipeView
            miniature={miniature}
            onScan={() => setScanOpen(true)}
            required={required}
            requirementRows={requirementRows}
            catalog={catalog}
            explicitSteps={data.recipeSteps.map(recipeStep)}
            schemes={schemes}
            onSetPaintState={setPaintState}
            paintStatus={(id) => {
              const paint = projections.get(id);
              return {
                available: paint?.available ?? false,
                wished: paint?.inventory?.state === "WISHLIST",
                activeSubstitution: paint?.activeSubstitution
                  ? { name: paint.activeSubstitution.name, broken: paint.brokenSubstitution }
                  : null,
              };
            }}
            setRecipe={(id, entries) => void run(actions.setRecipe(id, entries)).catch(noop)}
            setRecipeSteps={(id, steps) =>
              void run(
                actions.setRecipe(
                  id,
                  requirementRows.map(({ miniatureId: _miniatureId, paint: _paint, ...row }) => row),
                  steps,
                ),
              ).catch(noop)
            }
            setAttached={(ids) => run(actions.setSchemes(miniature.id, ids))}
            renderSchemePicker={(props) => <ApolloSchemePickerDialog {...props} />}
            onOpenPaint={setOpenPaintId}
            onOpenScheme={setOpenSchemeId}
          />
        </Box>
      </Box>
      {editingDetails && (
        <MiniatureForm
          initial={miniature}
          onClose={() => setEditingDetails(false)}
          onDelete={async () => {
            try {
              await run(actions.remove(miniature.id));
              notify(t("miniatureDeleted", { name: miniature.title }));
              onClose();
            } catch (error) {
              notify(error instanceof Error ? error.message : t("couldNotDeleteMiniature"), "error");
              throw error;
            }
          }}
          onSubmit={async (values) => {
            await run(actions.update(miniature.id, values));
            setEditingDetails(false);
            notify(t("miniatureUpdated"));
          }}
        />
      )}
      {imageViewerOpen && miniature.imageUrl && (
        <ImageViewer
          src={miniature.imageUrl}
          alt={miniature.title}
          onClose={() => setImageViewerOpen(false)}
        />
      )}
      <Suspense fallback={null}>
        {openPaintId && <PaintDetailsOverlay paintId={openPaintId} onClose={() => setOpenPaintId(null)} />}
        {openSchemeId && (
          <ApolloProjectSchemeDialog
            key={openSchemeId}
            schemeId={openSchemeId}
            onClose={() => setOpenSchemeId(null)}
          />
        )}
      </Suspense>
    </ProjectDrawerFrame>
  );
}
