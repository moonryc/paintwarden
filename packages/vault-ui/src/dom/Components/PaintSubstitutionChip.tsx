import { useTranslation } from "react-i18next";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { Chip } from "@mui/material";

import { truncateSx } from "../utils/truncate";

export function PaintSubstitutionChip({ name, broken = false }: { name: string; broken?: boolean }) {
  const { t } = useTranslation("components");
  return (
    <Chip
      size="small"
      color={broken ? "error" : "default"}
      icon={
        broken ? (
          <WarningAmberOutlinedIcon sx={{ fontSize: 15 }} />
        ) : (
          <ScienceOutlinedIcon sx={{ fontSize: 15 }} />
        )
      }
      label={broken ? t("brokenSubstitutionName", { name }) : name}
      title={broken ? t("brokenSubstitutionHelp", { name }) : t("usingSubstitution", { name })}
      sx={{
        height: 24,
        maxWidth: "55%",
        flexShrink: 0,
        bgcolor: broken ? undefined : "var(--brand-soft)",
        color: broken ? undefined : "var(--brand-text)",
        "& .MuiChip-icon": { color: broken ? undefined : "var(--brand-text)" },
        "& .MuiChip-label": { ...truncateSx },
      }}
    />
  );
}
