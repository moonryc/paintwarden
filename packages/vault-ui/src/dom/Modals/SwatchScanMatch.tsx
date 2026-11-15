import { Box, Chip, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { ColorMatchSwatch } from "../Components/ColorMatchSwatch";
import { MatchQualityChip } from "../Components/MatchQualityChip";
import type { useColorIndex } from "../graphql/color-tools-hooks";

type ColorPaint = ReturnType<typeof useColorIndex>["paints"][number];

/** One Swatch Scan paint match: sampled vs. paint color, name, closeness and stock state. */
export function SwatchScanMatch({
  sample,
  match: { paint, deltaE },
  size,
}: {
  sample: string;
  match: { paint: ColorPaint; deltaE: number };
  size: number;
}) {
  const { t } = useTranslation("components");
  const stock =
    (paint.owned ? t("scanOwned") : paint.available ? t("scanAvailable") : t("scanNotOwned")) +
    (paint.owned && !paint.available ? ` · ${t("paintUnavailable")}` : "");
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1.5, minWidth: 0, flex: "1 1 200px" }}>
      <ColorMatchSwatch target={sample} paint={paint.hex} size={size} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{paint.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
          {paint.brand} · {paint.hex}
        </Typography>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
          <MatchQualityChip deltaE={deltaE} />
          <Chip
            size="small"
            variant="outlined"
            label={stock}
            sx={{ height: "auto", "& .MuiChip-label": { whiteSpace: "normal", py: 0.25 } }}
          />
        </Stack>
      </Box>
    </Stack>
  );
}
