import type { Miniature } from "../types";

import type { MiniatureTileFragment } from "./generated/graphql";

// A list tile is not a miniature editor or a Paint. Keep its compact projection explicit.
export type MiniatureTileProjection = {
  mini: Pick<Miniature, "id" | "title" | "status" | "imageUrl">;
  swatches: { colorHex: string | null }[];
  total: number;
  missing: number;
};

export function miniatureTileProjection(tile: MiniatureTileFragment): MiniatureTileProjection {
  return {
    mini: { id: tile.id, title: tile.title, status: tile.status, imageUrl: tile.imageUrl ?? null },
    swatches: tile.previewSwatches.map((swatch) => ({ colorHex: swatch.colorHex ?? null })),
    total: tile.readiness.total,
    missing: tile.readiness.missing,
  };
}
