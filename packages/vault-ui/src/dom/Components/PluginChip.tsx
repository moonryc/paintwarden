import { useTranslation } from "react-i18next";
import { imageUrl } from "../utils/image-cache";
import { Avatar, Chip, Tooltip } from "@mui/material";

import { CHIP_HEIGHT } from "../utils/chip-sizes";

// Gold chip naming the plugin an item was installed from, led by the plugin's logo.svg (or
// its first letter when it has none); hover shows the full name.
export function PluginChip({ name, logoUrl }: { name?: string; logoUrl?: string | null }) {
  const { t } = useTranslation("components");
  const label = name || t("catalogSource");
  return (
    <Tooltip title={label} describeChild>
      <Chip
        color="secondary"
        size="small"
        label={label}
        avatar={
          // Avatar shows the letter itself if the logo is missing or fails to load.
          <Avatar src={logoUrl ? imageUrl(logoUrl) : undefined} alt="" variant="rounded">
            {label.trim().charAt(0).toUpperCase()}
          </Avatar>
        }
        sx={[
          {
            boxSizing: "border-box",
          },
          {
            height: CHIP_HEIGHT,
            // Size to the name with roomy side padding; very long names still truncate.
            maxWidth: 240,
            fontSize: 11,
            fontWeight: 700,
            "& .MuiChip-label": { px: "1rem" },
            "& .MuiChip-label:not(:first-child)": { pl: "0.5rem" },
            "& .MuiChip-avatar": {
              width: 18,
              height: 18,
              ml: "6px",
              mr: 0,
              borderRadius: "5px",
              fontSize: 10,
              fontWeight: 800,
              color: "inherit",
              bgcolor: logoUrl ? "transparent" : "color-mix(in oklab, currentColor 18%, transparent)",
            },
            "& .MuiChip-avatar img": { objectFit: "contain" },
          },
        ]}
      />
    </Tooltip>
  );
}
