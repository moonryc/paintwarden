import { i18n, formatNumber } from "../i18n";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import type { RankedPaint } from "@paintwarden/core/paint-color-similarity";
import { useState } from "react";

import type { Paint } from "../types";
import { schemeGridWindow } from "../utils/scheme-grid-window";
import { truncateSx } from "../utils/truncate";

import { PaintBottle } from "./PaintBottle";

const ROW_HEIGHT = 92;
const VIEW_HEIGHT = 448;

function differenceLabel(value: number, kind: "lightness" | "intensity") {
  const amount = Math.round(Math.abs(value));
  if (amount === 0)
    return i18n.t(
      kind === "lightness"
        ? "components:similarityNoLightnessChange"
        : "components:similarityNoVividnessChange",
    );
  const key =
    kind === "lightness"
      ? value > 0
        ? "components:similarityLighter"
        : "components:similarityDarker"
      : value > 0
        ? "components:similarityMoreVivid"
        : "components:similarityLessVivid";
  return i18n.t(key, { amount });
}

function hueLabel(value: number | null) {
  if (value === null) return i18n.t("components:similarityHueUnavailable");
  const amount = Math.round(Math.abs(value));
  if (amount === 0) return i18n.t("components:similarityNoHueChange");
  return i18n.t(
    value > 0 ? "components:similarityHueCounterclockwise" : "components:similarityHueClockwise",
    { amount },
  );
}

export function PaintSimilarityList({ ranked }: { ranked: RankedPaint<Paint>[] }) {
  const { t } = useTranslation("components");
  const [scrollTop, setScrollTop] = useState(0);
  const listWindow = schemeGridWindow({
    itemCount: ranked.length,
    columns: 1,
    rowHeight: ROW_HEIGHT,
    rowGap: 0,
    gridTop: 0,
    scrollY: scrollTop,
    viewportHeight: VIEW_HEIGHT,
    overscanRows: 3,
  });

  return (
    <Box sx={{ mt: 2.5 }}>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box sx={{ fontWeight: 700 }}>{t("closestPaints")}</Box>
        <Box sx={{ color: "text.secondary", fontSize: 12 }}>
          {t("similarityRankedCount", { count: ranked.length })}
        </Box>
      </Box>
      <Box sx={{ color: "text.secondary", fontSize: 12, mt: 0.5, mb: 1.5 }}>
        {t("scoresCompareCatalogScreenColorsPaintFinishAndPrimer")}
      </Box>
      <Box
        role="list"
        aria-label={t("paintsRankedByColorSimilarity")}
        // Focusable so keyboard users can scroll the list.
        tabIndex={0}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        sx={{
          height: Math.min(VIEW_HEIGHT, listWindow.totalHeight),
          overflowY: "auto",
          overscrollBehavior: "contain",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Box sx={{ position: "relative", height: listWindow.totalHeight }}>
          {ranked.slice(listWindow.startIndex, listWindow.endIndex).map(({ paint, match }, offset) => (
            <Box
              key={paint.id}
              role="listitem"
              aria-posinset={listWindow.startIndex + offset + 1}
              aria-setsize={ranked.length}
              sx={{
                position: "absolute",
                top: (listWindow.startIndex + offset) * ROW_HEIGHT,
                left: 0,
                right: 0,
                height: ROW_HEIGHT,
                boxSizing: "border-box",
                px: { xs: 1.5, sm: 2 },
                py: 1,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.75, sm: 1.5 }, height: "100%" }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    minWidth: 0,
                    flex: { xs: "1 1 0", md: "0 1 35%" },
                  }}
                >
                  <PaintBottle paint={paint} size="sm" />
                  <Box
                    sx={{
                      minWidth: 0,
                    }}
                  >
                    <Box
                      title={paint.name}
                      sx={{
                        fontWeight: 700,
                        fontSize: 14,
                        ...truncateSx,
                      }}
                    >
                      {paint.name}
                    </Box>
                    <Box
                      sx={{
                        color: "text.secondary",
                        fontSize: 12,
                        ...truncateSx,
                      }}
                    >
                      {paint.brand} · {paint.range}
                    </Box>
                  </Box>
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                    alignItems: { xs: "flex-start", md: "center" },
                    gap: { xs: 0, md: 1.5 },
                    flex: { xs: "0 0 auto", md: "1 1 auto" },
                    justifyContent: { md: "center" },
                    color: "text.secondary",
                    fontSize: { xs: 10, md: 12 },
                    whiteSpace: "nowrap",
                  }}
                >
                  <Box component="span">{differenceLabel(match.lightnessDelta, "lightness")}</Box>
                  <Box component="span">{hueLabel(match.hueDelta)}</Box>
                  <Box component="span">{differenceLabel(match.intensityDelta, "intensity")}</Box>
                </Box>
                <Box sx={{ textAlign: "right", flexShrink: 0, lineHeight: 1.1 }}>
                  <Box sx={{ fontWeight: 800, fontSize: 19 }}>
                    {formatNumber(match.score / 100, { style: "percent", maximumFractionDigits: 2 })}
                  </Box>
                  <Box sx={{ color: "text.secondary", fontSize: 10 }}>{t("match")}</Box>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
