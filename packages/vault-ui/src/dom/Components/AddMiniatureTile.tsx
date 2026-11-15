import { ButtonBase } from "@mui/material";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

import { dialogPreloadHandlers } from "../dialog-preload";
import { Plus } from "../icons";

/**
 * Dashed "Add miniature" tile. It shows only a plus; `title` names it for assistive technology.
 */
export function AddMiniatureTile({
  onClick,
  title,
  sx,
}: {
  onClick: () => void;
  /** Accessible name; defaults to "Add miniature". */
  title?: string;
  sx?: SxProps<Theme>;
}) {
  const { t } = useTranslation("components");
  return (
    <ButtonBase
      {...dialogPreloadHandlers("miniature")}
      aria-label={title ?? t("addMiniature")}
      aria-haspopup="dialog"
      onClick={onClick}
      sx={[
        {
          boxSizing: "border-box",
          display: "grid",
          aspectRatio: "4/5",
          placeItems: "center",
          borderRadius: "20px",
          borderStyle: "dashed",
          borderWidth: "2px",
          borderColor: "var(--line-strong) !important",
          color: "var(--ink-faint) !important",
          transition:
            "border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            "@media (hover: hover)": {
              borderColor: "var(--brand) !important",
              bgcolor: "color-mix(in oklab, var(--brand-soft) 40%, transparent) !important",
            },
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        component="span"
        sx={{
          display: "grid",
          height: "2.75rem",
          width: "2.75rem",
          placeItems: "center",
          borderRadius: "calc(infinity * 1px)",
          bgcolor: "var(--sunken)",
          transition:
            "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
          ".MuiButtonBase-root:hover &": {
            "@media (hover: hover)": {
              bgcolor: "var(--brand)",
              color: "var(--brand-fg)",
            },
          },
        }}
      >
        <Plus size={20} />
      </Box>
    </ButtonBase>
  );
}
