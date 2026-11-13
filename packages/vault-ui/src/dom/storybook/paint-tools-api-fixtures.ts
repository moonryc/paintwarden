// Complete fixture snapshots are projected only in Storybook, never in runtime hooks.
import { createFuzzyIndex, searchFuzzyIndex } from "@paint-vault/core/fuzzy-search";
import { rankPaintsByColor } from "@paint-vault/core/paint-color-similarity";
import { paintType, rankOwnedPaintMatches, suggestedOwnedPaint } from "@paint-vault/core/recipe-converter";

import type { Paint, State } from "../types";
import { owns } from "../utils/vault-data";

export function fixturePaintToolsResponse(
  data: State,
  operationName: string | undefined,
  vars: Record<string, unknown>,
  revision: { epoch: string; seq: string },
  projectPaint: (paint: Paint) => Record<string, unknown>,
): Record<string, unknown> | null {
  const paint = data.catalog.find((row) => row.id === vars.id) ?? null;
  if (operationName === "PaintToolChoice")
    return { paint: { revision, paint: paint ? projectPaint(paint) : null } };
  if (operationName === "OwnedPaintPickerOptions") {
    const index = createFuzzyIndex(
      data.catalog.filter((row) => owns(data.paintRecords[row.id])),
      (row) => `${row.name} ${row.brand} ${row.range}`,
    );
    return {
      ownedPaintOptions: {
        revision,
        items: searchFuzzyIndex(index, typeof vars.search === "string" ? vars.search : "", 30).map(
          projectPaint,
        ),
      },
    };
  }
  if (operationName !== "PaintToolRanking") return null;
  const ranked = !paint
    ? []
    : vars.ownedOnly
      ? rankOwnedPaintMatches(
          paint,
          data.catalog.filter((row) => owns(data.paintRecords[row.id])),
        )
      : (rankPaintsByColor(paint, data.catalog) ?? []).map((row) => ({
          ...row,
          sameType: paintType(row.paint.range) === paintType(paint.range),
        }));
  const start = Number(vars.after ?? 0);
  const nodes = ranked.slice(start, start + 30);
  return {
    paintRanking: {
      revision,
      paint: paint ? projectPaint(paint) : null,
      owned: paint ? owns(data.paintRecords[paint.id]) : false,
      suggestedId: vars.ownedOnly ? (suggestedOwnedPaint(ranked)?.paint.id ?? null) : null,
      nodes: nodes.map((row) => ({ ...row, paint: projectPaint(row.paint) })),
      totalCount: ranked.length,
      pageInfo: {
        hasNextPage: start + nodes.length < ranked.length,
        endCursor: nodes.length ? String(start + nodes.length) : null,
      },
    },
  };
}
