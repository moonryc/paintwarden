import { useTranslation } from "react-i18next";
import { useFragment } from "@apollo/client/react";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import { Alert, Button, Chip, ToggleButton, ToggleButtonGroup } from "@mui/material";
import Box from "@mui/material/Box";
import { isPaintOwned } from "@paint-vault/core/paint-state";
import type { ReactNode } from "react";
import { useState } from "react";

import { Modal } from "../Components/Modal";
import { PageSkeleton } from "../Components/PageSkeletons";
import { PluginChip } from "../Components/PluginChip";
import { QuantityCounter } from "../Components/QuantityCounter";
import { usePaintDetail } from "../graphql/detail-hooks";
import { PaintStockFragmentDoc } from "../graphql/generated/graphql";
import { usePaintStock } from "../graphql/stock-actions";
import { Check, ExternalLink, Heart, Minus, Pencil } from "../icons";
import type { Paint, PaintStateSetter, PaintStatus, StockLevel } from "../types";

import { SubstitutionDialog } from "./SubstitutionDialog";

type DetailProps = {
  paint: Paint;
  onClose(): void;
  openMini(id: string): void;
  onEdit(paint: Paint): void;
};

export function PaintDetailsModal(props: DetailProps) {
  const { t } = useTranslation("components");
  const detail = usePaintDetail(props.paint.id);
  const { setPaintState } = usePaintStock();
  const stock = useFragment({
    fragment: PaintStockFragmentDoc,
    from: { __typename: "Paint", id: props.paint.id },
    optimistic: true,
  });
  const projected = detail.data?.paint;
  const inventory = stock.complete ? stock.data.inventory : projected?.inventory;
  if (!projected)
    return (
      <Modal
        title={props.paint.name}
        subtitle={`${props.paint.brand} · ${props.paint.range}`}
        onClose={props.onClose}
      >
        {detail.error ? (
          <Alert severity="error" action={<Button onClick={detail.refresh}>{t("retry")}</Button>}>
            {detail.error.message}
          </Alert>
        ) : detail.data ? (
          <Alert severity="info">{t("thisPaintIsNoLongerAvailable")}</Alert>
        ) : (
          <PageSkeleton page="paint-detail" />
        )}
      </Modal>
    );
  return (
    <PaintDetailsView
      {...props}
      paint={{ ...projected, sourceName: projected.sourceName ?? undefined }}
      rec={
        inventory
          ? {
              ...inventory,
              state: inventory.state as PaintStatus,
              stockLevel: inventory.stockLevel as StockLevel,
            }
          : undefined
      }
      setPaintState={setPaintState}
      activeSubstitution={projected.activeSubstitution}
      brokenReason={
        projected.brokenReason === "EMPTY" ? "empty" : projected.brokenReason === "CYCLE" ? "cycle" : null
      }
      blocked={projected.brokenSubstitution}
      available={projected.available}
      substitutionCount={detail.data?.substitutions.totalCount ?? 0}
      usedBy={detail.data?.usedBy.nodes ?? []}
      loading={detail.loading}
      error={detail.error}
      refresh={detail.refresh}
      hasMoreUsedBy={detail.data?.usedBy.pageInfo.hasNextPage}
      loadMoreUsedBy={detail.loadMoreUsedBy}
    />
  );
}

function PaintDetailsView({
  paint,
  onClose,
  openMini,
  onEdit,
  rec,
  setPaintState,
  activeSubstitution,
  brokenReason,
  blocked,
  available,
  usedBy,
  substitutionCount,
  loading,
  error,
  refresh,
  hasMoreUsedBy,
  loadMoreUsedBy,
}: DetailProps & {
  rec?: { state: PaintStatus; stockLevel: StockLevel; quantity: number };
  setPaintState: PaintStateSetter;
  activeSubstitution?: { id: string; name: string } | null;
  brokenReason?: string | null;
  blocked: boolean;
  available: boolean;
  usedBy: { id: string; title: string }[];
  substitutionCount: number;
  loading?: boolean;
  error?: Error | null;
  refresh?(): void;
  hasMoreUsedBy?: boolean;
  loadMoreUsedBy?(): void;
}) {
  const { t } = useTranslation("components");
  const [showSubstitutions, setShowSubstitutions] = useState(false);
  const state = isPaintOwned(rec?.state ?? null, rec?.stockLevel ?? null, rec?.quantity ?? 0)
    ? "OWNED"
    : rec?.state === "WISHLIST"
      ? "WISHLIST"
      : null;
  const options: [
    PaintStatus | "UNTRACKED",
    string,
    ReactNode,
    { bgcolor: string; color: string } | undefined,
  ][] = [
    [
      "OWNED",
      t("owned"),
      <Check key="o" size={18} strokeWidth={3} />,
      { bgcolor: "var(--ok-soft)", color: "var(--ok)" },
    ],
    [
      "WISHLIST",
      t("wishlist"),
      <Heart key="w" size={18} />,
      { bgcolor: "var(--rust-soft)", color: "var(--rust)" },
    ],
    ["UNTRACKED", t("notOwned"), <Minus key="u" size={18} />, undefined],
  ];
  return (
    <Modal
      title={paint.name}
      subtitle={`${paint.brand} · ${paint.range}`}
      badge={
        paint.sourceName ? <PluginChip name={paint.sourceName} logoUrl={paint.sourceLogoUrl} /> : undefined
      }
      onClose={onClose}
    >
      <Box
        component="div"
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
        }}
      >
        <Box
          component="div"
          sx={{
            boxSizing: "border-box",
            position: "relative",
            height: "7rem",
            overflow: "hidden",
            borderRadius: "1rem",
            borderStyle: "solid",
            borderWidth: "1px",
            borderColor: "var(--line)",
          }}
          style={{
            background: paint.colorHex
              ? `linear-gradient(135deg, ${paint.colorHex}, color-mix(in oklab, ${paint.colorHex} 70%, black))`
              : "var(--sunken)",
          }}
        >
          {paint.colorHex && (
            <Box
              component="span"
              sx={{
                boxSizing: "border-box",
                position: "absolute",
                bottom: "0.5rem",
                left: "0.75rem",
                borderRadius: "10px",
                bgcolor: "color-mix(in oklab, var(--scrim) 35%, transparent)",
                px: 1,
                py: 0.25,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: "11px",
                color: "var(--on-scrim)",
                WebkitBackdropFilter: "blur(8px)",
                backdropFilter: "blur(8px)",
              }}
            >
              {paint.colorHex}
            </Box>
          )}
        </Box>
        {error && (
          <Alert severity="error" action={<Button onClick={refresh}>{t("retry")}</Button>}>
            {error.message}
          </Alert>
        )}
        <ToggleButtonGroup
          exclusive
          disabled={loading}
          fullWidth
          value={state ?? "UNTRACKED"}
          onChange={(_, v: PaintStatus | "UNTRACKED" | null) => {
            if (!v) return;
            setPaintState(
              paint.id,
              v === "UNTRACKED" ? null : v,
              v === "OWNED" ? "FULL" : (rec?.stockLevel ?? "FULL"),
              v === "OWNED" ? Math.max(1, rec?.quantity ?? 0) : undefined,
            );
          }}
          aria-label={t("paintStateLabel", { name: paint.name })}
        >
          {options.map(([key, label, icon, active]) => (
            <ToggleButton
              key={key}
              value={key}
              sx={[
                {
                  boxSizing: "border-box",
                  flexDirection: "column",
                  gap: "0.25rem",
                  fontSize: "0.75rem",
                  lineHeight: "calc(4 / 3)",
                },
                // The group marks the current state selected.
                active ? { "&.Mui-selected, &.Mui-selected:hover": active } : false,
              ]}
            >
              {icon}
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {state === "OWNED" && rec && (
          <Box
            component="div"
            sx={{
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: "1rem",
              borderStyle: "solid",
              borderWidth: "1px",
              borderColor: "var(--line)",
              bgcolor: "var(--surface-raised)",
              p: 1.5,
              pl: 2,
            }}
          >
            <span>
              <Box
                component="b"
                sx={{
                  display: "block",
                  fontSize: "0.875rem",
                  lineHeight: 10 / 7,
                }}
              >
                {t("bottlesOnHand")}
              </Box>
              <Box
                component="small"
                sx={{
                  color: "var(--ink-faint)",
                }}
              >
                {rec.stockLevel === "LOW" ? t("runningLow") : t("inStock")}
              </Box>
            </span>
            <QuantityCounter
              name={paint.name}
              value={rec.quantity}
              onChange={(quantity) =>
                setPaintState(paint.id, quantity === 0 ? null : "OWNED", "FULL", quantity)
              }
            />
          </Box>
        )}
        {activeSubstitution && (
          <Alert severity={brokenReason ? "error" : available ? "success" : "warning"} variant="outlined">
            {brokenReason
              ? brokenReason === "empty"
                ? t("brokenEmptySubstitution")
                : t("brokenCircularSubstitution")
              : blocked
                ? t("unavailableASubstitutionIngredientHasABrokenRecipe")
                : available
                  ? t("substitutionAllPaintsAvailable", { name: activeSubstitution.name })
                  : t("activeSubstitutionMissingPaint", { name: activeSubstitution.name })}
          </Alert>
        )}
        {/* All actions share one row of equal-width buttons; they stack on phones. */}
        <Box
          component="div"
          sx={{ display: "grid", gap: 1, gridAutoFlow: { sm: "column" }, gridAutoColumns: { sm: "1fr" } }}
        >
          <Button
            variant="outlined"
            startIcon={<ScienceOutlinedIcon fontSize="small" />}
            onClick={() => setShowSubstitutions(true)}
            sx={{
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            {t("paintSubstitutionCount", { count: substitutionCount })}
          </Button>
          {paint.sourceUrl && (
            <Button
              variant="outlined"
              href={paint.sourceUrl}
              target="_blank"
              rel="noreferrer"
              startIcon={<ExternalLink size={15} />}
              sx={{
                boxSizing: "border-box",
                width: "100%",
              }}
            >
              {t("productPage")}
            </Button>
          )}
          {paint.isCustom && (
            <Button
              variant="outlined"
              onClick={() => onEdit(paint)}
              startIcon={<Pencil size={15} />}
              sx={{
                boxSizing: "border-box",
                width: "100%",
              }}
            >
              {t("editPaint")}
            </Button>
          )}
        </Box>
        <Box
          component="div"
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <Box
            component="p"
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
            {t("usedIn")}
          </Box>
          {usedBy.length ? (
            <Box
              component="div"
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              {usedBy.map((m) => (
                <Chip
                  key={m.id}
                  clickable
                  label={m.title}
                  onClick={() => openMini(m.id)}
                  sx={{
                    boxSizing: "border-box",
                    height: "2.25rem",
                    bgcolor: "var(--sunken) !important",
                  }}
                />
              ))}
            </Box>
          ) : (
            <Box
              component="p"
              sx={{
                m: 0,
                fontSize: "0.875rem",
                lineHeight: 10 / 7,
                color: "var(--ink-faint)",
              }}
            >
              {t("notPartOfAnyProjectRecipeYet")}
            </Box>
          )}
          {hasMoreUsedBy && (
            <Button onClick={loadMoreUsedBy} disabled={loading}>
              {t("loadMoreProjects")}
            </Button>
          )}
        </Box>
      </Box>
      {showSubstitutions && <SubstitutionDialog paint={paint} onClose={() => setShowSubstitutions(false)} />}
    </Modal>
  );
}
