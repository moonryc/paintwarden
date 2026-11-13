import { inArray, sql } from "drizzle-orm";

import { getDb } from "../../../db";
import { paintInventory } from "../../../db/schema";

export async function PUT(request: Request) {
  const { paintId, paintIds, state, stockLevel, quantity } = (await request.json()) as {
    paintId?: string;
    paintIds?: string[];
    state?: string | null;
    stockLevel?: string | null;
    quantity?: number;
  };
  const ids = paintId ? [paintId] : Array.isArray(paintIds) ? [...new Set(paintIds)].slice(0, 500) : [];
  if (!ids.length) return Response.json({ error: "Paint is required" }, { status: 400 });
  const db = getDb();
  const qty =
    state === "OWNED" ? Math.min(999, Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity! : 1))) : 0;
  db.transaction((tx) => {
    if ((state !== "OWNED" && state !== "WISHLIST") || (state === "OWNED" && qty === 0)) {
      tx.delete(paintInventory).where(inArray(paintInventory.paintId, ids)).run();
    } else {
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
    }
  });
  return Response.json({ ok: true, updated: ids.length });
}
