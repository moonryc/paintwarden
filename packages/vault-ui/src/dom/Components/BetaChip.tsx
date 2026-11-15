import { Chip } from "@mui/material";
import { useTranslation } from "react-i18next";

/** A non-status badge with a theme-independent AA text/background pair. */
export function BetaChip() {
  const { t } = useTranslation("components");
  return (
    <Chip
      component="span"
      label={t("scanBeta")}
      size="small"
      sx={{
        height: 19,
        fontSize: 10,
        fontWeight: 700,
        bgcolor: "var(--beta)",
        color: "var(--beta-fg)",
        "& .MuiChip-label": { px: 0.75 },
      }}
    />
  );
}
