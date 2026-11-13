import { Button, Chip, Dialog, IconButton, SwipeableDrawer, useMediaQuery } from "@mui/material";
import Box from "@mui/material/Box";
import type { Theme } from "@mui/material/styles";
import { useState } from "react";

import { ProjectPaintSummary } from "../Components/ProjectPaintSummary";
import { ProjectRecipe } from "../Components/ProjectRecipe";
import { StageStepper } from "../Components/StageStepper";
import { Pencil, X } from "../icons";
import { useVault, useVaultStore } from "../store/hooks";
import { up } from "../theme-tokens";
import type { Miniature, Paint, PaintingStatus, Requirement } from "../types";
import { STAGES, noop } from "../utils/constants";
import { imageFormData } from "../utils/image";

import { ColorSchemesDialog } from "./ColorSchemesDialog";
import { ImageViewer } from "./ImageViewer";
import { MiniatureForm } from "./MiniatureForm";
import { PaintDetailsOverlay } from "./PaintDetailsOverlay";
import { ProjectHero } from "./ProjectHero";

export function ProjectDrawer({
  miniature,
  required,
  requirementRows,
  missing,
  onClose,
}: {
  miniature: Miniature;
  required: Paint[];
  requirementRows: Requirement[];
  missing: Paint[];
  onClose(): void;
}) {
  const data = useVault();
  const api = useVaultStore((s) => s.api);
  const notify = useVaultStore((s) => s.notify);
  const setPaintState = useVaultStore((s) => s.setPaintState);
  const [editingDetails, setEditingDetails] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [openPaintId, setOpenPaintId] = useState<string | null>(null);
  const [openSchemeId, setOpenSchemeId] = useState<string | null>(null);
  const phone = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"), { noSsr: true });
  const saveMiniature = (patch: Partial<Miniature>) =>
    api(`/api/miniatures/${miniature.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...miniature, ...patch }),
    });
  const setStage = (paintingStatus: PaintingStatus) => {
    const previous = miniature.paintingStatus;
    const label = STAGES.find(([stage]) => stage === paintingStatus)?.[1] ?? paintingStatus;
    saveMiniature({ paintingStatus }).then(
      () =>
        notify(`${miniature.title} marked ${label.toLowerCase()}`, "ok", {
          label: "Undo",
          onClick: () => void saveMiniature({ paintingStatus: previous }).catch(noop),
        }),
      noop,
    );
  };
  const addAllToWishlist = (paints: Paint[]) =>
    api("/api/paint-state", {
      method: "PUT",
      body: JSON.stringify({ paintIds: paints.map((paint) => paint.id), state: "WISHLIST" }),
    }).then(
      () =>
        notify(`${paints.length} paint${paints.length === 1 ? "" : "s"} added to wishlist`, "ok", {
          label: "Undo",
          onClick: () => {
            for (const paint of paints) setPaintState(paint.id, null);
          },
        }),
      noop,
    );
  const markOwned = (paint: Paint) => {
    const previous = data.paintRecords[paint.id];
    setPaintState(paint.id, "OWNED", "FULL");
    notify(`${paint.name} marked as owned`, "ok", {
      label: "Undo",
      onClick: () =>
        previous
          ? setPaintState(paint.id, previous.state, previous.stockLevel, previous.quantity)
          : setPaintState(paint.id, null),
    });
  };
  const details = [miniature.manufacturer, miniature.faction, miniature.scale].filter(Boolean);

  const content = (
    <>
      {/* Zero-height sticky rail keeps the close button reachable while scrolling. */}
      <Box
        component="div"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          height: 0,
        }}
      >
        <IconButton
          color="overlay"
          onClick={onClose}
          aria-label="Close project"
          sx={{
            boxSizing: "border-box",
            position: "absolute",
            top: "0.75rem",
            right: "0.75rem",
            height: "2.5rem",
            width: "2.5rem",
            borderRadius: "calc(infinity * 1px)",
            bgcolor: "color-mix(in oklab, var(--scrim) 45%, transparent)",
            WebkitBackdropFilter: "blur(8px)",
            backdropFilter: "blur(8px)",
            // Keeps the dark backing on touch, where MUI's hover would clear it.
            "&:hover": {
              bgcolor: "color-mix(in oklab, var(--scrim) 45%, transparent)",
              "@media (hover: hover)": {
                bgcolor: "color-mix(in oklab, var(--scrim) 60%, transparent)",
              },
            },
            [up.md]: {
              top: "1rem",
              right: "1rem",
            },
          }}
        >
          <X size={18} />
        </IconButton>
      </Box>
      <ProjectHero miniature={miniature} paints={required} onOpenImage={() => setImageViewerOpen(true)} />

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
        <Box component="div" sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
          <Box component="div" sx={{ minWidth: 0, flex: 1 }}>
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
                onClick={() => setEditingDetails(true)}
                sx={{ ml: -1, color: "var(--ink-faint)" }}
              >
                Add project notes
              </Button>
            )}
          </Box>
          <Box component="div" sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() =>
                void api("/api/miniature-templates", {
                  method: "POST",
                  body: JSON.stringify({ sourceMiniatureId: miniature.id }),
                })
                  .then(() => notify(`Saved ${miniature.title} as a template`))
                  .catch(noop)
              }
            >
              Save as template
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Pencil size={14} />}
              onClick={() => setEditingDetails(true)}
            >
              Edit
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
            Painting stage
          </Box>
          <StageStepper value={miniature.paintingStatus} onChange={setStage} />
        </Box>

        <ProjectPaintSummary
          miniatureId={miniature.id}
          required={required}
          missing={missing}
          onOpenPaint={setOpenPaintId}
          onAddAllToWishlist={addAllToWishlist}
        />

        <ProjectRecipe
          miniature={miniature}
          required={required}
          requirementRows={requirementRows}
          onOpenPaint={setOpenPaintId}
          onOpenScheme={setOpenSchemeId}
        />
      </Box>
      {editingDetails && (
        <MiniatureForm
          initial={miniature}
          onClose={() => setEditingDetails(false)}
          onDelete={async () => {
            try {
              await api(`/api/miniatures/${miniature.id}`, { method: "DELETE" });
              notify(`Deleted ${miniature.title}`);
              onClose();
            } catch (error) {
              notify(error instanceof Error ? error.message : "Could not delete miniature", "error");
              throw error;
            }
          }}
          onSubmit={async ({ image, removeImage, ...values }) => {
            await api(`/api/miniatures/${miniature.id}`, { method: "PUT", body: JSON.stringify(values) });
            if (removeImage) await api(`/api/miniatures/${miniature.id}/image`, { method: "DELETE" });
            else if (image)
              await api(`/api/miniatures/${miniature.id}/image`, {
                method: "POST",
                body: await imageFormData(image),
              });
            setEditingDetails(false);
            notify("Miniature updated");
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
      <PaintDetailsOverlay paintId={openPaintId} onClose={() => setOpenPaintId(null)} />
      {openSchemeId && (
        <ColorSchemesDialog
          key={openSchemeId}
          initialId={openSchemeId}
          toggleOwned={markOwned}
          onClose={() => setOpenSchemeId(null)}
        />
      )}
    </>
  );
  return phone ? (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      slotProps={{
        paper: {
          "aria-label": miniature.title,
          // Dialog otherwise points the paper at a title element this layout doesn't have.
          "aria-labelledby": undefined,
          sx: {
            boxSizing: "border-box",
            height: "100dvh",
            maxHeight: "100dvh",
            overflowY: "auto",
            borderRadius: "0",
            bgcolor: "var(--canvas)",
          },
        },
      }}
    >
      {content}
    </Dialog>
  ) : (
    <SwipeableDrawer
      open
      anchor="right"
      onClose={onClose}
      onOpen={noop}
      disableSwipeToOpen
      slotProps={{
        paper: {
          "aria-label": miniature.title,
          sx: {
            boxSizing: "border-box",
            width: "100%",
            maxWidth: "640px",
            bgcolor: "var(--canvas)",
          },
        },
      }}
    >
      {content}
    </SwipeableDrawer>
  );
}
