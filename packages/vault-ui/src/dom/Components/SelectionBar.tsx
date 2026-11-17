import Close from "@mui/icons-material/Close";
import DeleteOutline from "@mui/icons-material/DeleteOutlineOutlined";
import DriveFileMove from "@mui/icons-material/DriveFileMove";
import { Box, Button, IconButton, Paper, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";

/** Floating action bar for a multi-selection: it stays at the bottom while the grid scrolls. */
export function SelectionBar({
  count,
  onMove,
  onDelete,
  onClear,
}: {
  count: number;
  onMove: () => void;
  onDelete: () => void;
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
      <Button color="error" variant="outlined" size="small" startIcon={<DeleteOutline />} onClick={onDelete}>
        {t("folders.deleteSelected", { count })}
      </Button>
      <Tooltip title={t("folders.clearSelection")}>
        <IconButton size="small" aria-label={t("folders.clearSelection")} onClick={onClear}>
          <Close fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}
