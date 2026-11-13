import Box from "@mui/material/Box";

import { ImagePlus, Paintbrush } from "../icons";
import type { Paint } from "../types";
import { paintGradient } from "../utils/paint-gradient";

export function PaintGradientPlaceholder({
  paints,
  showIcon = true,
}: {
  paints: Pick<Paint, "colorHex">[];
  showIcon?: boolean;
}) {
  const colors = paints
    .map((p) => p.colorHex)
    .filter(Boolean)
    .slice(0, 4) as string[];
  if (!colors.length)
    return (
      <Box
        component="div"
        sx={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          color: "color-mix(in oklab, var(--ink-faint) 70%, transparent)",
        }}
      >
        {showIcon && <ImagePlus size={32} strokeWidth={1.4} />}
      </Box>
    );
  return (
    <Box
      component="div"
      sx={{
        position: "absolute",
        inset: 0,
      }}
      style={{
        background: paintGradient(colors),
      }}
    >
      <Box
        component="div"
        sx={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          bgcolor: "color-mix(in oklab, var(--scrim) 10%, transparent)",
          color: "color-mix(in oklab, var(--on-scrim) 80%, transparent)",
        }}
      >
        {showIcon && <Paintbrush size={30} strokeWidth={1.4} />}
      </Box>
    </Box>
  );
}
