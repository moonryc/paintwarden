import { inArray, sql } from "drizzle-orm";

import { getDb } from "../db";
import { paintCatalog, paintInventory } from "../db/schema";

export type SetPaintStockInput = {
  paintId?: string;
  paintIds?: string[];
  state?: string | null;
  stockLevel?: string | null;
  quantity?: number | null;
};

export class PaintStockError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaintStockError";
  }
}

// Synchronous so callers can read a revision/change envelope in the same outer SQLite
// transaction. Drizzle uses a savepoint when that transaction is already open.
export function setPaintStock(input: SetPaintStockInput): { ok: true; updated: number } {
  const { paintId, paintIds, state, stockLevel, quantity } = input;
  const ids = paintId ? [paintId] : Array.isArray(paintIds) ? [...new Set(paintIds)].slice(0, 500) : [];
  if (!ids.length) throw new PaintStockError("Paint is required", 400);
  if (ids.some((id) => typeof id !== "string" || !id.length))
    throw new PaintStockError("Paint IDs must be non-empty strings", 400);
  const db = getDb();
  const qty =
    state === "OWNED" ? Math.min(999, Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity! : 1))) : 0;
  db.transaction((tx) => {
    if ((state !== "OWNED" && state !== "WISHLIST") || (state === "OWNED" && qty === 0)) {
      // Clearing an unknown paint remains a harmless no-op, as in the original REST route.
      tx.delete(paintInventory).where(inArray(paintInventory.paintId, ids)).run();
      return;
    }
    // Report unknown IDs deliberately instead of leaking a foreign-key error as HTTP 500.
    // Validate the entire batch before writing so both transports get an atomic failure.
    const known = tx
      .select({ id: paintCatalog.id })
      .from(paintCatalog)
      .where(inArray(paintCatalog.id, ids))
      .all();
    if (known.length !== ids.length) throw new PaintStockError("Paint not found", 404);
    const stock =
      state === "OWNED" && stockLevel === "LOW"
        ? "LOW"
        : state === "WISHLIST" && stockLevel === "EMPTY"
          ? "EMPTY"
          : "FULL";
    const upsert = tx
      .insert(paintInventory)
      .values({ paintId: sql.placeholder("paintId"), state, stockLevel: stock, quantity: qty })
      .onConflictDoUpdate({
        target: paintInventory.paintId,
        set: { state, stockLevel: stock, quantity: qty },
      })
      .prepare();
    for (const id of ids) upsert.run({ paintId: id });
  });
  return { ok: true, updated: ids.length };
}
