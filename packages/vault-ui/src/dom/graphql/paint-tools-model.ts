import type { Paint } from "../types";
import { owns } from "../utils/vault-data";

import { libraryInventoryRecord } from "./library-model";
import { paintModel } from "./miniature-scheme-model";
import type { PaintConversionRead } from "./paint-tools-loader";

export function paintConversionModel(data: PaintConversionRead | null) {
  const paints = new Map<string, Paint>();
  const ownedIds = new Set<string>();
  const remember = (projection: NonNullable<PaintConversionRead["rows"][number]["paint"]>) => {
    const paint = paintModel(projection);
    paints.set(paint.id, paint);
    if (owns(libraryInventoryRecord(projection.inventory))) ownedIds.add(paint.id);
    return paint;
  };
  const rows = (data?.rows ?? []).flatMap((row) => {
    if (!row.paint) return [];
    const original = remember(row.paint);
    const matches = row.nodes.map((match) => ({ ...match, paint: remember(match.paint) }));
    return [{ original, owned: row.owned, matches, suggestedId: row.suggestedId ?? null }];
  });
  for (const choice of data?.choices ?? []) {
    if (choice.paint) remember(choice.paint);
  }
  return { paints, ownedIds, rows };
}
export function resolveConversionChoices(
  model: ReturnType<typeof paintConversionModel>,
  choices: Record<string, string>,
) {
  return Object.fromEntries(
    model.rows.map((row) => {
      const choice = choices[row.original.id];
      return [
        row.original.id,
        row.owned
          ? row.original.id
          : choice && (choice === row.original.id || model.ownedIds.has(choice))
            ? choice
            : (row.suggestedId ?? row.original.id),
      ];
    }),
  );
}
