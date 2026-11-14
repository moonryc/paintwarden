import Box from "@mui/material/Box";
import type { ReactNode } from "react";

import { up } from "../theme-tokens";

export function PageHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <Box
      component="div"
      sx={{
        mb: 2.5,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        justifyContent: "space-between",
        columnGap: 2,
        rowGap: 1.5,
        [up.lg]: {
          mb: 3,
        },
      }}
    >
      <Box
        component="div"
        sx={{
          minWidth: 0,
          flex: "1 1 min(100%, 18rem)",
        }}
      >
        <Box
          component="p"
          sx={{
            m: 0,
            mb: 0.7,
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
          }}
        >
          {eyebrow}
        </Box>
        <Box
          component="h2"
          sx={{
            m: 0,
            fontFamily: "var(--font-serif)",
            fontSize: "2rem",
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            [up.lg]: {
              fontSize: "2.5rem",
            },
          }}
        >
          {title}
        </Box>
        {body && (
          <Box
            component="p"
            sx={{
              m: 0,
              mt: 1,
              maxWidth: "42rem",
              fontSize: "0.875rem",
              lineHeight: 10 / 7,
              color: "var(--ink-faint)",
            }}
          >
            {body}
          </Box>
        )}
      </Box>
      {action && (
        <Box
          component="div"
          sx={{
            display: "flex",
            flexShrink: 0,
            alignItems: "center",
            gap: 1,
          }}
        >
          {action}
        </Box>
      )}
    </Box>
  );
}
