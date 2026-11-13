import type { Paint, State } from "../types";

import type { LibraryPaintFragment } from "./generated/graphql";

export type LibraryPaintProjection = {
  paint: Paint;
  record: State["paintRecords"][string] | undefined;
  available: boolean;
  substitution: { id: string; name: string } | null;
  broken: boolean;
};

export function libraryInventoryRecord(
  inventory: { state?: string; stockLevel?: string; quantity?: number } | null | undefined,
): State["paintRecords"][string] | undefined {
  const state = inventory?.state;
  const stockLevel = inventory?.stockLevel;
  return inventory &&
    (state === "OWNED" || state === "WISHLIST") &&
    (stockLevel === "FULL" || stockLevel === "LOW" || stockLevel === "EMPTY") &&
    typeof inventory.quantity === "number"
    ? { state, stockLevel, quantity: inventory.quantity }
    : undefined;
}

export function libraryPaintProjection(paint: LibraryPaintFragment): LibraryPaintProjection {
  return {
    paint: {
      id: paint.id,
      brand: paint.brand,
      range: paint.range,
      name: paint.name,
      colorHex: paint.colorHex ?? null,
      sourceUrl: paint.sourceUrl ?? null,
      isCustom: paint.isCustom,
      sourceName: paint.sourceName ?? undefined,
      sourceLogoUrl: paint.sourceLogoUrl,
    },
    record: libraryInventoryRecord(paint.inventory),
    available: paint.available,
    substitution: paint.activeSubstitution ?? null,
    broken: paint.brokenSubstitution,
  };
}
