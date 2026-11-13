import { imageUrl } from "../utils/image-cache";
import Box from "@mui/material/Box";

import { Layers } from "../icons";
import { useVault } from "../store/hooks";
import type { SchemeOrderEntry } from "../types";
import { paintGradient } from "../utils/paint-gradient";
import { schemeOrderEntries } from "../utils/scheme-order";

const SWATCH_SIZES = {
  xs: { width: 16, height: 16, borderRadius: "4px" },
  sm: { width: "1.5rem", height: "1.5rem", borderRadius: "10px" },
  md: { width: "2.25rem", height: "2.25rem", borderRadius: "0.75rem" },
  lg: { width: "3.5rem", height: "3.5rem", borderRadius: "16px" },
};

export function SchemeSwatch({
  schemeId,
  size = "md",
}: {
  schemeId: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const data = useVault();
  const entries = schemeOrderEntries(data, schemeId);
  const preview = entries
    .filter((entry): entry is Extract<SchemeOrderEntry, { type: "IMAGE" }> => entry.type === "IMAGE")
    .at(-1);
  const colors = entries
    .filter((entry): entry is Extract<SchemeOrderEntry, { type: "PAINT" }> => entry.type === "PAINT")
    .map((entry) => data.catalog.find((paint) => paint.id === entry.paintId)?.colorHex)
    .filter(Boolean) as string[];
  const background = paintGradient(colors);
  return (
    <Box
      component="span"
      sx={{
        boxSizing: "border-box",
        display: "grid",
        flexShrink: 0,
        placeItems: "center",
        overflow: "hidden",
        border: "1px solid var(--line-strong)",
        bgcolor: "var(--surface)",
        ...SWATCH_SIZES[size],
      }}
      style={!preview ? { background } : undefined}
      aria-hidden="true"
    >
      {preview ? (
        <Box
          component="img"
          src={imageUrl(preview.thumbnailUrl || preview.imageUrl)}
          alt=""
          draggable={false}
          sx={{
            pointerEvents: "none",
            height: "100%",
            width: "100%",
            objectFit: "cover",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
        />
      ) : !background ? (
        <Layers size={16} style={{ color: "var(--ink-faint)" }} />
      ) : null}
    </Box>
  );
}
