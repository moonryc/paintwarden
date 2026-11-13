// Shared screen derivations. Keep these independent of React so the pre-migration
// semantic acceptance suite exercises the same rules that the screens render.
import { COLOR_CATEGORY_LABELS, type ColorCategory } from "@paint-vault/core/color-categories";

import type { ColorScheme, Miniature, Paint, State } from "../types";

import { paintGradient } from "./paint-gradient";
import { schemePaintRows } from "./scheme-order";
import {
  effectiveRequirements,
  owns,
  projectPaintIssues,
  wishlistPaintIds,
  type PaintRequirementReason,
} from "./vault-data";

export type WishlistRow = { paint: Paint; projects: Miniature[]; reasons?: PaintRequirementReason[] };

const compareShoppingRows = (a: WishlistRow, b: WishlistRow) =>
  b.projects.length - a.projects.length || a.paint.name.localeCompare(b.paint.name);

export function shoppingRows(data: State) {
  const paintById = new Map(data.catalog.map((paint) => [paint.id, paint]));
  const grouped = new Map<string, WishlistRow>();
  for (const paintId of wishlistPaintIds(data)) {
    const paint = paintById.get(paintId);
    if (paint) grouped.set(paintId, { paint, projects: [] });
  }
  for (const mini of data.miniatures)
    for (const [paintId, reasons] of projectPaintIssues(data, mini.id)) {
      const current = grouped.get(paintId);
      if (!current) continue;
      if (!current.projects.some((m) => m.id === mini.id)) current.projects.push(mini);
      current.reasons = [...new Set([...(current.reasons ?? []), ...reasons])];
    }
  return [...grouped.values()].sort(compareShoppingRows);
}

export function retainedShoppingRows(
  rows: WishlistRow[],
  retained: Map<string, WishlistRow>,
  records: State["paintRecords"],
  data?: State,
) {
  const listedIds = new Set(rows.map(({ paint }) => paint.id));
  return [
    ...rows,
    ...[...retained.values()]
      .filter(({ paint }) => owns(records[paint.id]) && !listedIds.has(paint.id))
      .map((row) => {
        if (!data) return row;
        const reasons = new Set<PaintRequirementReason>();
        for (const mini of data.miniatures)
          for (const reason of projectPaintIssues(data, mini.id).get(row.paint.id) ?? []) reasons.add(reason);
        // Retain the row/quantity controls, not stale issue reasons after buying or repairing.
        return { ...row, reasons: [...reasons] };
      }),
  ].sort(compareShoppingRows);
}

export function shoppingGroups(rows: WishlistRow[]) {
  const byBrand = new Map<string, WishlistRow[]>();
  for (const row of rows) {
    const brand = row.paint.isCustom ? "Custom" : row.paint.brand;
    const items = byBrand.get(brand);
    if (items) items.push(row);
    else byBrand.set(brand, [row]);
  }
  return [...byBrand].sort(([a], [b]) => a.localeCompare(b));
}

export function filterShoppingGroups(groups: ReturnType<typeof shoppingGroups>, miniatureId: string) {
  return groups
    .map(
      ([brand, items]) =>
        [
          brand,
          items.filter(
            (row) => miniatureId === "ALL" || row.projects.some((mini) => mini.id === miniatureId),
          ),
        ] as const,
    )
    .filter(([, items]) => items.length > 0);
}

// Intentionally global: the shopping model filter must not narrow this panel.
export function missingShoppingPaints(data: State) {
  const paintById = new Map(data.catalog.map((paint) => [paint.id, paint]));
  const listed = wishlistPaintIds(data);
  const missing = new Map<string, { projectCount: number; reasons: Set<PaintRequirementReason> }>();
  for (const mini of data.miniatures)
    for (const [paintId, reasons] of projectPaintIssues(data, mini.id)) {
      if (listed.has(paintId)) continue;
      const entry = missing.get(paintId) ?? { projectCount: 0, reasons: new Set<PaintRequirementReason>() };
      entry.projectCount++;
      for (const reason of reasons) entry.reasons.add(reason);
      missing.set(paintId, entry);
    }
  return [...missing]
    .flatMap(([paintId, { projectCount, reasons }]) => {
      const paint = paintById.get(paintId);
      return paint ? [{ paint, projectCount, reasons: [...reasons] }] : [];
    })
    .sort((a, b) => b.projectCount - a.projectCount || a.paint.name.localeCompare(b.paint.name));
}

export function usedByMiniatures(data: State, paintId: string) {
  return data.miniatures.filter((mini) =>
    effectiveRequirements(data, mini.id).some((row) => row.paintId === paintId),
  );
}

export const libraryInventoryFilter = <T extends string>(search: string, filter: T) =>
  search.trim() ? "ALL" : filter;

export function matchesLibraryInventory(
  data: State,
  availablePaintIds: Set<string>,
  paint: Paint,
  filter: string,
) {
  return (
    filter === "ALL" ||
    (filter === "OWNED"
      ? availablePaintIds.has(paint.id)
      : filter === "UNTRACKED"
        ? !availablePaintIds.has(paint.id) && data.paintStates[paint.id] !== "WISHLIST"
        : data.paintStates[paint.id] === filter)
  );
}

export function schemePaintIdIndex(data: State) {
  const result = new Map<string, Set<string>>();
  for (const row of data.colorSchemePaints) {
    const paintIds = result.get(row.schemeId) ?? new Set<string>();
    paintIds.add(row.paintId);
    result.set(row.schemeId, paintIds);
  }
  return result;
}

export type SchemeReadiness = "ALL" | "READY" | "MISSING";

// Search is deliberately absent: readiness facets use the same non-search filters.
export function filteredSchemes(
  data: State,
  category: ColorCategory | "ALL",
  matchesSource: (scheme: ColorScheme) => boolean,
  selectedPaintIds: string[],
  paintIds: Map<string, Set<string>>,
  readiness: SchemeReadiness,
  readyIds: Set<string>,
) {
  return data.colorSchemes.filter(
    (scheme) =>
      (category === "ALL" || scheme.category === category) &&
      matchesSource(scheme) &&
      selectedPaintIds.every((id) => paintIds.get(scheme.id)?.has(id)) &&
      (readiness === "ALL" || (readiness === "READY") === readyIds.has(scheme.id)),
  );
}

export function schemeCategoryCount(data: State, category: ColorCategory) {
  return data.colorSchemes.filter((scheme) => scheme.category === category).length;
}

export function sortedSchemes(schemes: ColorScheme[]) {
  return [...schemes].sort((a, b) => {
    if (!a.category && b.category) return 1;
    if (a.category && !b.category) return -1;
    const categoryOrder =
      a.category && b.category
        ? COLOR_CATEGORY_LABELS[a.category].localeCompare(COLOR_CATEGORY_LABELS[b.category], undefined, {
            sensitivity: "base",
          })
        : 0;
    return categoryOrder || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export function schemeCardSummary(data: State, schemeId: string) {
  const paints = schemePaintRows(data, schemeId)
    .map((row) => data.catalog.find((paint) => paint.id === row.paintId))
    .filter(Boolean) as Paint[];
  const colors = paints.map((paint) => paint.colorHex).filter(Boolean) as string[];
  const preview = data.colorSchemeImages
    .filter((image) => image.schemeId === schemeId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .at(-1);
  return {
    gradient: paintGradient(colors),
    preview,
    previewUrl: preview ? preview.thumbnailUrl || preview.imageUrl : undefined,
    uses: data.miniatureColorSchemes.filter((row) => row.schemeId === schemeId).length,
    paintNames: paints.map((paint) => paint.name).join(" · "),
  };
}
