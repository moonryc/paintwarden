import { Alert, Button, ButtonBase, Card, Chip } from "@mui/material";
import Box from "@mui/material/Box";
import { COLOR_CATEGORY_LABELS } from "@paint-vault/core/color-categories";
import { useState } from "react";

import type { LibraryPaintProjection } from "../graphql/library-model";
import type { SchemeSummaryModel } from "../graphql/miniature-scheme-model";
import { Pencil } from "../icons";
import { ImageViewer } from "../Modals/ImageViewer";
import { PaintDetailsOverlay } from "../Modals/PaintDetailsOverlay";
import { useVaultStore } from "../store/hooks";
import type { Paint, SchemeOrderEntry } from "../types";
import { schemePreviewChipSize } from "../utils/chip-sizes";
import { listResetSx } from "../utils/element-resets";
import { imageUrl } from "../utils/image-cache";
import { displayDividerLabel } from "../utils/scheme-order";

import { LibraryPaintRow } from "./LibraryPaintRow";
import { Modal } from "./Modal";
import { PluginChip } from "./PluginChip";
import { SchemeProgressChip } from "./SchemeProgressChip";

export function SchemePreview({
  active,
  entries,
  projections,
  availableCount,
  paintCount,
  toggleOwned,
  onEdit,
  onClose,
  error,
  loading,
  onRetry,
}: {
  active: SchemeSummaryModel;
  entries: SchemeOrderEntry[];
  projections: LibraryPaintProjection[];
  availableCount: number;
  paintCount: number;
  toggleOwned?(paint: Paint): void;
  onEdit(): void;
  onClose(): void;
  error?: Error | null;
  loading?: boolean;
  onRetry?(): void;
}) {
  const openMini = useVaultStore((s) => s.openMini);
  const [openPaintId, setOpenPaintId] = useState<string | null>(null);
  const [openImage, setOpenImage] = useState<{ src: string; alt: string } | null>(null);
  return (
    <Modal title={active.name} subtitle="Ordered paint recipe and reference images." onClose={onClose}>
      {error && (
        <Alert severity="error" action={<Button onClick={onRetry}>Retry</Button>}>
          {error.message}
        </Alert>
      )}
      {loading && (
        <Box role="status" sx={{ mb: 1, fontSize: 13 }}>
          Refreshing scheme…
        </Box>
      )}
      <Box
        component="div"
        sx={{
          "& > :where(:not(:last-child))": { mb: 2 },
        }}
      >
        <Box
          component="div"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Chip
            size="small"
            variant="outlined"
            label={active.category ? COLOR_CATEGORY_LABELS[active.category] : "Uncategorized"}
            sx={{ ...schemePreviewChipSize, fontSize: 11, fontWeight: 700 }}
          />
          {active.isSystem && <PluginChip name={active.sourceName} logoUrl={active.sourceLogoUrl} />}
          <SchemeProgressChip available={availableCount} total={paintCount} />
          <Box
            component="span"
            sx={{
              marginLeft: "auto",
              fontSize: "0.75rem",
              lineHeight: 4 / 3,
              color: "var(--ink-faint)",
            }}
          >
            {paintCount} paint{paintCount === 1 ? "" : "s"}
          </Box>
        </Box>
        <Card
          component="ol"
          sx={{
            ...listResetSx,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {entries.map((entry) => {
            if (entry.type === "DIVIDER")
              return (
                <Box
                  component="li"
                  key={entry.id}
                  sx={[
                    {
                      boxSizing: "border-box",
                      borderBlockStyle: "solid",
                      borderBlockWidth: "1px",
                      px: 2,
                      py: 1.5,
                      fontSize: "0.875rem",
                      lineHeight: 10 / 7,
                      fontWeight: 600,
                      "&:first-child": {
                        borderTopStyle: "solid",
                        borderTopWidth: "0px",
                      },
                    },
                    entry.tone === "MILESTONE"
                      ? {
                          borderColor: "var(--brand)",
                          bgcolor: "var(--brand)",
                          textAlign: "center",
                          color: "var(--brand-fg)",
                        }
                      : {
                          borderColor: "var(--line-deep)",
                          bgcolor: "var(--sunken)",
                          color: "#fff",
                        },
                  ]}
                >
                  {displayDividerLabel(entry.role, entry.label)}
                </Box>
              );
            if (entry.type === "IMAGE")
              return (
                <Box
                  component="li"
                  key={entry.id}
                  sx={{
                    boxSizing: "border-box",
                    position: "relative",
                    borderBlockStyle: "solid",
                    borderBlockWidth: "1px",
                    borderColor: "var(--line)",
                    bgcolor: "#fff",
                  }}
                >
                  <ButtonBase
                    aria-label={`View ${active.name} reference image`}
                    onClick={() =>
                      setOpenImage({
                        src: entry.imageUrl,
                        alt: `${active.name} ${entry.imageType?.toLowerCase() ?? "recipe"} example`,
                      })
                    }
                    sx={{ display: "block", width: "100%" }}
                  >
                    <Box
                      component="img"
                      src={imageUrl(entry.imageUrl)}
                      alt={`${active.name} ${entry.imageType?.toLowerCase() ?? "recipe"} example`}
                      sx={{
                        marginInline: "auto",
                        maxHeight: "34rem",
                        width: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </ButtonBase>
                  {entry.imageType && (
                    <Chip
                      size="small"
                      label={`${entry.imageType.toLowerCase()} ready`}
                      sx={{
                        boxSizing: "border-box",
                        position: "absolute",
                        right: "0.75rem",
                        bottom: "0.75rem",
                        bgcolor: "color-mix(in oklab, var(--scrim) 60%, transparent)",
                        color: "var(--on-scrim)",
                        textTransform: "capitalize",
                        WebkitBackdropFilter: "blur(8px)",
                        backdropFilter: "blur(8px)",
                      }}
                    />
                  )}
                </Box>
              );
            const projection = projections.find((item) => item.paint.id === entry.paintId);
            const paint = projection?.paint;
            return paint ? (
              <LibraryPaintRow
                key={entry.id}
                paint={paint}
                projection={projection}
                toggleOwned={toggleOwned}
                onOpenPaint={setOpenPaintId}
                border="bottom"
              />
            ) : (
              <Box
                component="li"
                key={entry.id}
                sx={{
                  boxSizing: "border-box",
                  px: 2,
                  py: 1.5,
                  fontSize: "0.875rem",
                  lineHeight: 10 / 7,
                  color: "var(--rust)",
                }}
              >
                Paint unavailable
              </Box>
            );
          })}
        </Card>
        {!active.isSystem && (
          <Box
            component="div"
            sx={{
              boxSizing: "border-box",
              display: "flex",
              justifyContent: "flex-end",
              pt: 0.5,
            }}
          >
            <Button variant="contained" onClick={() => onEdit()} startIcon={<Pencil size={15} />}>
              Edit scheme
            </Button>
          </Box>
        )}
      </Box>
      {openImage && (
        <ImageViewer src={openImage.src} alt={openImage.alt} onClose={() => setOpenImage(null)} />
      )}
      <PaintDetailsOverlay
        paintId={openPaintId}
        onClose={() => setOpenPaintId(null)}
        openMini={(id) => {
          onClose();
          openMini(id);
        }}
      />
    </Modal>
  );
}
