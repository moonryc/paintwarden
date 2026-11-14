import { Dialog, IconButton, SwipeableDrawer, useMediaQuery } from "@mui/material";
import Box from "@mui/material/Box";
import type { Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { X } from "../icons";
import { up } from "../theme-tokens";
import { noop } from "../utils/constants";

// Share the actual drawer geometry between pending and loaded detail queries.
export function ProjectDrawerFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
}) {
  const { t } = useTranslation("components");
  const phone = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"), { noSsr: true });
  const content = (
    <>
      <Box sx={{ position: "sticky", top: 0, zIndex: 10, height: 0 }}>
        <IconButton
          color="overlay"
          onClick={onClose}
          aria-label={t("closeProject")}
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
            "&:hover": {
              bgcolor: "color-mix(in oklab, var(--scrim) 45%, transparent)",
              "@media (hover: hover)": { bgcolor: "color-mix(in oklab, var(--scrim) 60%, transparent)" },
            },
            [up.md]: { top: "1rem", right: "1rem" },
          }}
        >
          <X size={18} />
        </IconButton>
      </Box>
      {children}
    </>
  );
  return phone ? (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      slotProps={{
        paper: {
          role: "dialog",
          "aria-modal": true,
          "aria-label": title,
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
          role: "dialog",
          "aria-modal": true,
          "aria-label": title,
          sx: { boxSizing: "border-box", width: "100%", maxWidth: "640px", bgcolor: "var(--canvas)" },
        },
      }}
    >
      {content}
    </SwipeableDrawer>
  );
}
