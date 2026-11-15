import Box from "@mui/material/Box";
import type { ReactNode } from "react";

import { up } from "../theme-tokens";

// Keep page content, header notices and floating notices on the same gutters.
export const contentGutters = {
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
  maxWidth: "1280px",
  marginInline: "auto",
  px: 2,
  [up.md]: { px: 4 },
  [up.lg]: { px: 5 },
} as const;

export function AppContent({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <Box
      data-app-content
      sx={{
        ...contentGutters,
        ...(compact
          ? {}
          : {
              pt: 0.5,
              paddingBottom: "calc(6.5rem + env(safe-area-inset-bottom))",
              [up.lg]: { px: 5, pt: 1, pb: 8 },
            }),
      }}
    >
      {children}
    </Box>
  );
}
