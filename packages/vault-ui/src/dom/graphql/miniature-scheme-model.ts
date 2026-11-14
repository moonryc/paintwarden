import { i18n } from "@paint-vault/i18n/runtime";
import { COLOR_CATEGORIES } from "@paint-vault/core/color-categories";

import type { ColorScheme, Paint, SchemeOrderEntry } from "../types";

import type { DetailPaintFragment, MiniatureSchemeSummaryFragment } from "./generated/graphql";
import { libraryInventoryRecord, type LibraryPaintProjection } from "./library-model";
import type { MiniatureSchemeRead } from "./miniature-scheme-loader";

export type SchemeSummaryModel = Pick<
  ColorScheme,
  "id" | "name" | "category" | "isSystem" | "sourceName" | "sourceLogoUrl"
> & { thumbnailUrl?: string | null };

export function schemeSummaryModel(scheme: MiniatureSchemeSummaryFragment): SchemeSummaryModel {
  return {
    id: scheme.id,
    name: scheme.name,
    category: COLOR_CATEGORIES.find((category) => category === scheme.category) ?? null,
    isSystem: scheme.isSystem,
    sourceName: scheme.sourceName ?? undefined,
    sourceLogoUrl: scheme.sourceLogoUrl,
    thumbnailUrl: scheme.thumbnailUrl ?? null,
  };
}

export function paintModel(paint: DetailPaintFragment): Paint {
  return {
    id: paint.id,
    brand: paint.brand,
    range: paint.range,
    name: paint.name,
    colorHex: paint.colorHex ?? null,
    sourceUrl: paint.sourceUrl ?? null,
    isCustom: paint.isCustom,
    sourceName: paint.sourceName ?? undefined,
    sourceLogoUrl: paint.sourceLogoUrl,
  };
}

// Preserve persisted IDs and raw divider labels: the REST editor uses these to
// recognize unchanged legacy entries. Display formatting belongs to the view.
export function schemeEntryModels(nodes: MiniatureSchemeRead["entries"]["nodes"]) {
  const projections = new Map<string, LibraryPaintProjection>();
  const entries = nodes.map((entry): SchemeOrderEntry => {
    if (entry.kind === "PAINT") {
      if (!entry.paint) throw new Error(i18n.t("shell:aSchemePaintEntryHasNoPaint"));
      const paint = paintModel(entry.paint);
      projections.set(paint.id, {
        paint,
        record: libraryInventoryRecord(entry.paint.inventory),
        available: entry.paint.available,
        substitution: entry.paint.activeSubstitution ?? null,
        broken: entry.paint.brokenSubstitution,
      });
      return { id: entry.id, type: "PAINT", paintId: paint.id, sortOrder: entry.sortOrder };
    }
    if (entry.kind === "IMAGE") {
      if (!entry.imageUrl) throw new Error(i18n.t("shell:aSchemeImageEntryHasNoImageUrl"));
      return {
        id: entry.id,
        type: "IMAGE",
        sortOrder: entry.sortOrder,
        imageUrl: entry.imageUrl,
        thumbnailUrl: entry.thumbnailUrl ?? null,
        imageType: entry.imageType ?? null,
        method: entry.method ?? null,
      };
    }
    if (
      entry.kind !== "DIVIDER" ||
      (entry.tone !== "MILESTONE" && entry.tone !== "SECTION") ||
      (entry.role !== null && entry.role !== "START" && entry.role !== "COMPLETE") ||
      entry.label === null
    ) {
      throw new Error(i18n.t("shell:aSchemeDividerEntryIsInvalid"));
    }
    return {
      id: entry.id,
      type: "DIVIDER",
      sortOrder: entry.sortOrder,
      label: entry.label,
      tone: entry.tone,
      role: entry.role,
    };
  });
  const rows = [...projections.values()];
  return { entries, paints: rows.map((row) => row.paint), projections: rows };
}
