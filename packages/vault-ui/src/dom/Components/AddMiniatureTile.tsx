import CreateNewFolder from "@mui/icons-material/CreateNewFolderOutlined";
import { ButtonBase } from "@mui/material";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

import { dialogPreloadHandlers } from "../dialog-preload";
import { Plus } from "../icons";

/**
 * Dashed "Add miniature" tile. The visible subtitle also names the button for assistive technology.
 */
export function AddMiniatureTile({
  onClick,
  title,
  folder = false,
  sx,
}: {
  onClick: () => void;
  /** Accessible name; defaults to "Add miniature". */
  title?: string;
  folder?: boolean;
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
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 1.5,
          minWidth: 0,
          p: 1,
          textAlign: "center",
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
        {folder ? <CreateNewFolder fontSize="small" /> : <Plus size={20} />}
      </Box>
      <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: 1.4, overflowWrap: "anywhere" }}>
        {title ?? t("addMiniature")}
      </Box>
    </ButtonBase>
  );
}
