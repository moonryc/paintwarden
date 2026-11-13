import { Card } from "@mui/material";
import Box from "@mui/material/Box";
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card
      sx={{
        boxSizing: "border-box",
        display: "grid",
        placeItems: "center",
        px: 3,
        py: 7,
        textAlign: "center",
      }}
    >
      <Box
        component="span"
        sx={{
          mb: 1.5,
          display: "grid",
          height: "3.5rem",
          width: "3.5rem",
          placeItems: "center",
          borderRadius: "1rem",
          bgcolor: "var(--sunken)",
          color: "var(--ink-faint)",
        }}
      >
        {icon}
      </Box>
      <Box
        component="p"
        sx={{
          m: 0,
          fontFamily: "var(--font-serif)",
          letterSpacing: "-0.02em",
          fontOpticalSizing: "auto",
          fontSize: "1.125rem",
          lineHeight: 14 / 9,
          fontWeight: 600,
        }}
      >
        {title}
      </Box>
      <Box
        component="p"
        sx={{
          m: 0,
          mt: 0.5,
          maxWidth: "24rem",
          fontSize: "0.875rem",
          lineHeight: 10 / 7,
          color: "var(--ink-faint)",
        }}
      >
        {body}
      </Box>
      {action && (
        <Box
          component="div"
          sx={{
            mt: 2.5,
          }}
        >
          {action}
        </Box>
      )}
    </Card>
  );
}
