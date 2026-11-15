import Close from "@mui/icons-material/Close";
import DriveFileMove from "@mui/icons-material/DriveFileMove";
import { Box, Button, IconButton, Paper, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * Hides a tile's select checkbox until the tile is hovered or focused, or while anything is
 * selected. Touch screens without hover always show it. Put `selectRevealParentSx` on the tile
 * wrapper and `selectRevealSx(selecting)` on the checkbox.
 */
export const selectRevealParentSx = {
  "&:hover .select-reveal, &:focus-within .select-reveal": { opacity: 1 },
} as const;
export const selectRevealSx = (selecting: boolean) =>
  ({
    opacity: selecting ? 1 : 0,
    transition: "opacity 120ms",
    "@media (hover: none)": { opacity: 1 },
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  }) as const;

/** Floating action bar for a multi-selection: it stays at the bottom while the grid scrolls. */
export function SelectionBar({
  count,
  onMove,
  onClear,
}: {
  count: number;
  onMove: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("pages");
  if (!count) return null;
  return (
    <Paper
      role="group"
      aria-label={t("folders.selectItems")}
      elevation={6}
      sx={{
        position: "sticky",
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1,
        width: "fit-content",
        maxWidth: "100%",
        boxSizing: "border-box",
        mx: "auto",
        my: 2,
        py: 1,
        pl: 2,
        pr: 1,
        borderRadius: 999,
        bgcolor: "var(--surface)",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box role="status" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", mr: 1 }}>
        {t("folders.selected", { count })}
      </Box>
      <Button variant="contained" size="small" startIcon={<DriveFileMove />} onClick={onMove}>
        {t("folders.moveToFolder")}
      </Button>
      <Tooltip title={t("folders.clearSelection")}>
        <IconButton size="small" aria-label={t("folders.clearSelection")} onClick={onClear}>
          <Close fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}
