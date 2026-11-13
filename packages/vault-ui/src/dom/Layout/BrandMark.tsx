import Box from "@mui/material/Box";
import { useId } from "react";

import { colors } from "../theme-tokens";

/** The paint-pot `PaintBottle` drawn as a 64-unit mark; matches `public/favicon.svg`. */
const POT_BODY =
  "M18.79 23.04H45.21A7.27 7.27 0 0 1 52.48 30.31V47.77A7.27 7.27 0 0 1 45.21 55.04H18.79A7.27 7.27 0 0 1 11.52 47.77V30.31A7.27 7.27 0 0 1 18.79 23.04Z";

const POT_EDGES = {
  shadow:
    "M18.79 18.68H45.21A7.27 7.27 0 0 1 52.48 25.95V43.4A7.27 7.27 0 0 1 45.21 50.68H18.79A7.27 7.27 0 0 1 11.52 43.4V25.95A7.27 7.27 0 0 1 18.79 18.68Z",
  shine:
    "M18.79 25.95H45.21A7.27 7.27 0 0 1 52.48 33.22V50.68A7.27 7.27 0 0 1 45.21 57.95H18.79A7.27 7.27 0 0 1 11.52 50.68V33.22A7.27 7.27 0 0 1 18.79 25.95Z",
};

const POT_CAP = "M14.08 24.32V10.94A5.82 5.82 0 0 1 19.9 5.12H44.1A5.82 5.82 0 0 1 49.92 10.94V24.32Z";

export function BrandMark({ small = false }: { small?: boolean }) {
  const clipId = `brand-pot-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Box
      component="svg"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      sx={{ width: small ? 32 : 40, height: small ? 32 : 40, flexShrink: 0 }}
    >
      <rect
        x="0.73"
        y="0.73"
        width="62.55"
        height="62.55"
        rx="16.73"
        fill={colors.surfaceRaised}
        stroke={colors.line}
        strokeWidth="1.45"
      />
      {/* The swatch leaves more room below the pot than above; shift it to center the mark. */}
      <g transform="translate(0 1.92)">
        <clipPath id={clipId}>
          <path d={POT_BODY} />
        </clipPath>
        <path d={POT_BODY} fill={colors.gold} />
        <g clipPath={`url(#${clipId})`} fillRule="evenodd">
          <path d={POT_BODY + POT_EDGES.shadow} fill="#000" fillOpacity=".15" />
          <path d={POT_BODY + POT_EDGES.shine} fill="#fff" fillOpacity=".25" />
        </g>
        <path d={POT_CAP} fill={colors.bottleCap} />
      </g>
    </Box>
  );
}
