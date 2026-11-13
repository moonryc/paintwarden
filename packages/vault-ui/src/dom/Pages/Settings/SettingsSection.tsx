import { Card } from "@mui/material";
import Box from "@mui/material/Box";
import { useId, type ReactNode } from "react";

const rowIconSx = {
  display: "grid",
  placeItems: "center",
  width: 40,
  height: 40,
  flexShrink: 0,
  borderRadius: 2,
  bgcolor: "var(--sunken)",
  color: "var(--ink-soft)",
  "& svg": { fontSize: 20 },
} as const;

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Box component="section" aria-labelledby={id}>
      <Box sx={{ px: 0.5, mb: 1 }}>
        <Box
          component="h2"
          id={id}
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
        {description && (
          <Box component="p" sx={{ m: 0, mt: 0.25, fontSize: 13, color: "var(--ink-faint)" }}>
            {description}
          </Box>
        )}
      </Box>
      <Card sx={{ "& > * + *": { borderTop: "1px solid var(--line)" } }}>{children}</Card>
    </Box>
  );
}

// Icon, label and explanation on the left; the control sits right on wide screens and wraps below on phones.
export function SettingsRow({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
      <Box sx={{ display: "flex", flexWrap: { xs: "wrap", sm: "nowrap" }, alignItems: "center", gap: 2 }}>
        <Box sx={rowIconSx} aria-hidden="true">
          {icon}
        </Box>
        <Box sx={{ minWidth: 0, flex: "1 1 200px" }}>
          <Box sx={{ fontSize: 14, fontWeight: 650 }}>{title}</Box>
          {description && (
            <Box sx={{ mt: 0.25, fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-faint)" }}>
              {description}
            </Box>
          )}
        </Box>
        {action && (
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              flexShrink: 0,
              ml: { xs: "56px", sm: 0 },
            }}
          >
            {action}
          </Box>
        )}
      </Box>
      {children && <Box sx={{ mt: 2, ml: { xs: 0, sm: "56px" } }}>{children}</Box>}
    </Box>
  );
}
