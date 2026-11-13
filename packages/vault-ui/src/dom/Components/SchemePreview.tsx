import { imageUrl } from "../utils/image-cache";
import { Button, Card, Chip } from "@mui/material";
import Box from "@mui/material/Box";
import { COLOR_CATEGORY_LABELS } from "@paint-vault/core/color-categories";
import { isPaintAvailable } from "@paint-vault/core/paint-substitutions";
import { useState } from "react";

import { Pencil } from "../icons";
import { PaintDetailsOverlay } from "../Modals/PaintDetailsOverlay";
import { useVault, useVaultStore } from "../store/hooks";
import type { ColorScheme, Paint, SchemeOrderEntry } from "../types";
import { schemePreviewChipSize } from "../utils/chip-sizes";
import { listResetSx } from "../utils/element-resets";
import { schemePaintRows } from "../utils/scheme-order";

import { LibraryPaintRow } from "./LibraryPaintRow";
import { Modal } from "./Modal";
import { PluginChip } from "./PluginChip";
import { SchemeProgressChip } from "./SchemeProgressChip";

export function SchemePreview({
  active,
  entries,
  toggleOwned,
  onEdit,
  onClose,
}: {
  active: ColorScheme;
  entries: SchemeOrderEntry[];
  // Replaces the usual owned toggle; the project drawer passes one that only marks paints owned.
  toggleOwned?(paint: Paint): void;
  onEdit(): void;
  onClose(): void;
}) {
  const data = useVault();
  const openMini = useVaultStore((s) => s.openMini);
  const [openPaintId, setOpenPaintId] = useState<string | null>(null);
  const paintCount = entries.filter((entry) => entry.type === "PAINT").length;
  const schemePaintIds = new Set(schemePaintRows(data, active.id).map((row) => row.paintId));
  const availablePaintCount = [...schemePaintIds].filter((paintId) =>
    isPaintAvailable(data, data.paintRecords, paintId),
  ).length;
  return (
    <Modal title={active.name} subtitle="Ordered paint recipe and reference images." onClose={onClose}>
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
          <SchemeProgressChip available={availablePaintCount} total={schemePaintIds.size} />
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
                  {entry.label}
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
            const paint = data.catalog.find((item) => item.id === entry.paintId);
            return paint ? (
              <LibraryPaintRow
                key={entry.id}
                paint={paint}
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
