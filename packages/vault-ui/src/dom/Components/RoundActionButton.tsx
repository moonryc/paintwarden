import { IconButton } from "@mui/material";
import type { ReactNode } from "react";

import type { Tone } from "../utils/tones";

const SIZES = { sm: 28, md: { xs: 40, md: 32 } } as const;

export function RoundActionButton({
  label,
  title,
  onClick,
  children,
  tone,
  active = false,
  disabled = false,
  size = "sm",
}: {
  label: string;
  title: string;
  onClick(): void;
  children: ReactNode;
  tone: Extract<Tone, "rust" | "ok" | "wishlist"> | "info";
  active?: boolean;
  disabled?: boolean;
  // sm is 28px; md matches the quantity counter (40px on phones, 32px wider).
  size?: "sm" | "md";
}) {
  // The shared sky token also backs the MUI info palette.
  const color = tone === "info" ? "var(--sky)" : `var(--${tone})`;
  const highlighted = {
    color,
    bgcolor: `color-mix(in oklab, ${color} 14%, var(--surface-raised))`,
    borderColor: color,
  };

  return (
    <IconButton
      size="small"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={title}
      sx={{
        position: "relative",
        width: SIZES[size],
        height: SIZES[size],
        borderRadius: size === "md" ? 3 : undefined,
        flexShrink: 0,
        color: active ? color : "var(--ink-soft)",
        bgcolor: active
          ? `color-mix(in oklab, ${color} 14%, var(--surface-raised))`
          : "var(--surface-raised)",
        border: `1px solid ${active ? color : "var(--line)"}`,
        boxShadow: "0 1px 3px rgb(var(--shadow-color) / .12)",
        transition: "background-color .15s, border-color .15s, color .15s",
        "&.Mui-disabled": { opacity: 1, color: "var(--ink-faint)" },
        "&:hover": highlighted,
        ...(tone === "info" && {
          "&:active": {
            ...highlighted,
            bgcolor: `color-mix(in oklab, ${color} 22%, var(--surface-raised))`,
          },
        }),
        "&:focus-visible": {
          ...(tone === "info" && highlighted),
          outline: `2px solid ${color}`,
          outlineOffset: 2,
        },
      }}
    >
      {children}
    </IconButton>
  );
}
