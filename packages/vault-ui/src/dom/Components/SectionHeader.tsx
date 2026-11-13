import Box from "@mui/material/Box";
import type { ReactNode } from "react";

import { up } from "../theme-tokens";

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Box
      component="div"
      sx={{
        mb: 1.5,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 1.5,
        [up.lg]: {
          mb: 2,
        },
      }}
    >
      <Box
        component="h3"
        sx={{
          m: 0,
          fontFamily: "var(--font-serif)",
          fontSize: "1.25rem",
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          [up.lg]: {
            fontSize: "1.375rem",
          },
        }}
      >
        {title}
      </Box>
      {action}
    </Box>
  );
}
