import { Dialog, useMediaQuery } from "@mui/material";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { useId, type ReactNode } from "react";

import { ModalHeader } from "./ModalHeader";

// The body keeps room for a first-row outlined field's floating label (about 9px above the
// field), so the header never covers it.
const LABEL_ROOM = 1.25;

// The header stays fixed and only the body scrolls, so the scrollbar is always inside the
// modal body rather than on the dialog's outer edge.
const paperLayout = { overflow: "hidden", display: "flex", flexDirection: "column" } as const;
const scrollingBody = {
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  overscrollBehavior: "contain",
} as const;
// Footer actions sit outside the scrolling body, pinned to the bottom edge of the modal.
const footerLayout = {
  flexShrink: 0,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 1,
  pt: 2,
  borderTop: "1px solid var(--line)",
  bgcolor: "var(--surface)",
} as const;

export function Modal({
  title,
  subtitle,
  badge,
  onClose,
  children,
  footer,
  fillBody = false,
}: {
  title: string;
  subtitle: string;
  badge?: ReactNode;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  // Lays the body out as a flex column so one child (such as a long list) can fill the
  // remaining height and scroll by itself.
  fillBody?: boolean;
}) {
  const bodyLayout = fillBody ? ({ display: "flex", flexDirection: "column" } as const) : {};
  const phone = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"), { noSsr: true });
  // Names the dialog after its visible title.
  const titleId = useId();
  const head = (sx: SxProps<Theme>) => (
    <ModalHeader
      id={titleId}
      title={title}
      subtitle={subtitle}
      badge={badge}
      onClose={onClose}
      sx={{ flexShrink: 0, ...sx }}
    />
  );
  if (phone)
    return (
      <Dialog
        open
        fullScreen
        // Phone forms ignore backdrop taps, but retain keyboard dismissal.
        onClose={(_event, reason) => {
          if (reason === "escapeKeyDown") onClose();
        }}
        aria-labelledby={titleId}
        slotProps={{
          paper: {
            sx: {
              boxSizing: "border-box",
              height: "100dvh",
              maxHeight: "100dvh",
              borderRadius: "0",
              bgcolor: "var(--surface)",
              ...paperLayout,
            },
          },
        }}
      >
        {head({ px: 2.5, pt: "calc(1rem + env(safe-area-inset-top))", pb: 1.25 })}
        <Box
          sx={{
            ...scrollingBody,
            ...bodyLayout,
            px: 2.5,
            pt: LABEL_ROOM,
            pb: footer ? 2.5 : "calc(1.5rem + env(safe-area-inset-bottom))",
          }}
        >
          {children}
        </Box>
        {footer && (
          <Box sx={{ ...footerLayout, px: 2.5, pb: "calc(1rem + env(safe-area-inset-bottom))" }}>
            {footer}
          </Box>
        )}
      </Dialog>
    );
  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby={titleId}
      slotProps={{
        paper: { sx: { boxSizing: "border-box", bgcolor: "var(--surface)", ...paperLayout } },
      }}
    >
      {head({ px: { xs: 3, md: 3.5 }, pt: { xs: 3, md: 3.5 }, pb: { xs: 1.25, md: 1.75 } })}
      <Box
        sx={{
          ...scrollingBody,
          ...bodyLayout,
          px: { xs: 3, md: 3.5 },
          pt: LABEL_ROOM,
          pb: footer ? 2.5 : { xs: 3, md: 3.5 },
        }}
      >
        {children}
      </Box>
      {footer && <Box sx={{ ...footerLayout, px: { xs: 3, md: 3.5 }, pb: { xs: 2.5, md: 3 } }}>{footer}</Box>}
    </Dialog>
  );
}
