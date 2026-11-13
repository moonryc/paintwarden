import { Box } from "@mui/material";
import type { RankedPaint } from "@paint-vault/core/paint-color-similarity";
import { useState } from "react";

import type { Paint } from "../types";
import { schemeGridWindow } from "../utils/scheme-grid-window";
import { truncateSx } from "../utils/truncate";

import { PaintBottle } from "./PaintBottle";

const ROW_HEIGHT = 92;
const VIEW_HEIGHT = 448;

function differenceLabel(value: number, kind: "lightness" | "intensity") {
  const amount = Math.round(Math.abs(value));
  if (amount === 0) return kind === "lightness" ? "→ 0 lightness" : "→ 0 vividness";
  const direction =
    kind === "lightness" ? (value > 0 ? "lighter" : "darker") : value > 0 ? "more vivid" : "less vivid";
  return `${value > 0 ? "↑" : "↓"} ${amount} ${direction}`;
}

function hueLabel(value: number | null) {
  if (value === null) return "↔ n/a hue";
  const amount = Math.round(Math.abs(value));
  if (amount === 0) return "→ 0° hue";
  return `${value > 0 ? "↺" : "↻"} ${amount}° hue`;
}

export function PaintSimilarityList({ ranked }: { ranked: RankedPaint<Paint>[] }) {
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
        <Box sx={{ fontWeight: 700 }}>Closest paints</Box>
        <Box sx={{ color: "text.secondary", fontSize: 12 }}>{ranked.length} ranked</Box>
      </Box>
      <Box sx={{ color: "text.secondary", fontSize: 12, mt: 0.5, mb: 1.5 }}>
        Scores compare catalog screen colors; paint finish and primer can change the result.
      </Box>
      <Box
        role="list"
        aria-label="Paints ranked by color similarity"
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
                  <Box sx={{ fontWeight: 800, fontSize: 19 }}>{match.score}%</Box>
                  <Box sx={{ color: "text.secondary", fontSize: 10 }}>match</Box>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
