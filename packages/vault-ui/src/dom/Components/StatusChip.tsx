import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

import type { Tone } from "../utils/tones";

const TONES = {
  rust: { bgcolor: "var(--rust-soft)", color: "var(--rust)" },
  ok: { bgcolor: "var(--ok-soft)", color: "var(--ok)" },
  gold: { bgcolor: "var(--gold-soft)", color: "var(--gold-text)" },
  wishlist: { bgcolor: "color-mix(in oklab, var(--wishlist) 10%, var(--surface))", color: "var(--wishlist)" },
  muted: { bgcolor: "var(--sunken)", color: "var(--ink-faint)" },
} satisfies Record<Tone, object>;

export function StatusChip({ tone, sx, children }: { tone: Tone; sx?: SxProps<Theme>; children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={[
        {
          flexShrink: 0,
          borderRadius: 9999,
          px: 1,
          py: 0.25,
          fontSize: 11,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          ...TONES[tone],
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}
