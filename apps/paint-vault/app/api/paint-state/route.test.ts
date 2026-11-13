import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-paint-state-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { PUT } = await import("./route");
const { getDb, getSqlite } = await import("../../../db");
const { paintCatalog, paintInventory } = await import("../../../db/schema");
const { testUserId } = await import("../../../lib/test-ids");
const { PaintStockError, setPaintStock } = await import("../../../lib/paint-stock");
const { currentChangeSeq } = await import("../../../db/change-log");
const { vaultSnapshot, vaultChangesSince } = await import("../../../lib/vault-state");

const ids = Array.from({ length: 502 }, (_, i) => testUserId(`inventory-paint-${i}`));
const call = (body: unknown) =>
  PUT(new Request("http://localhost/api/paint-state", { method: "PUT", body: JSON.stringify(body) }));
const inventory = () =>
  getDb()
    .select({
      paintId: paintInventory.paintId,
      state: paintInventory.state,
      stockLevel: paintInventory.stockLevel,
      quantity: paintInventory.quantity,
    })
    .from(paintInventory)
    .orderBy(paintInventory.paintId)
    .all();
const expected = (paintIds: string[], state: string, stockLevel: string, quantity: number) =>
  paintIds
    .map((paintId) => ({ paintId, state, stockLevel, quantity }))
    .sort((a, b) => a.paintId.localeCompare(b.paintId));

// Every mutation uses an isolated temporary vault, never the owner's DATA_DIR.
test.before(() => {
  const db = getDb();
  for (const id of ids) db.insert(paintCatalog).values({ id, brand: "Test", range: "Base", name: id }).run();
});
test.beforeEach(() => getDb().delete(paintInventory).run());
test.after(() => {
  getSqlite().close();
  rmSync(directory, { recursive: true, force: true });
});

void test("bulk upserts roll back earlier inserts and updates when a paint id does not exist", async () => {
  await call({ paintId: ids[0], state: "WISHLIST", stockLevel: "EMPTY" });
  const before = inventory();
  const seq = currentChangeSeq(getSqlite());
  const response = await call({
    paintIds: [ids[0], ids[1], testUserId("missing-inventory-paint")],
    state: "OWNED",
    quantity: 7,
    stockLevel: "LOW",
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Paint not found" });
  assert.deepEqual(inventory(), before);
  assert.equal(currentChangeSeq(getSqlite()), seq);
});

void test("bulk ownership and wishlist updates preserve stock and quantity rules", async () => {
  const paintIds = ids.slice(0, 2);
  const response = await call({
    paintIds: [...paintIds, ids[0]],
    state: "OWNED",
    stockLevel: "LOW",
    quantity: 3.9,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, updated: 2 });
  assert.deepEqual(inventory(), expected(paintIds, "OWNED", "LOW", 3));

  for (const [quantity, normalized] of [
    [2000, 999],
    [undefined, 1],
  ] as const) {
    await call({ paintIds, state: "OWNED", stockLevel: "EMPTY", quantity });
    assert.deepEqual(inventory(), expected(paintIds, "OWNED", "FULL", normalized));
  }
  await call({ paintIds, state: "WISHLIST", stockLevel: "EMPTY", quantity: 12 });
  assert.deepEqual(inventory(), expected(paintIds, "WISHLIST", "EMPTY", 0));
  await call({ paintIds, state: "WISHLIST", stockLevel: "LOW" });
  assert.deepEqual(inventory(), expected(paintIds, "WISHLIST", "FULL", 0));
});

void test("bulk removal handles cleared states and zero quantities without touching other paints", async () => {
  const paintIds = ids.slice(0, 2);
  for (const body of [
    { state: null },
    { state: "OTHER" },
    {},
    { state: "OWNED", quantity: 0 },
    { state: "OWNED", quantity: -2 },
    { state: "OWNED", quantity: 0.9 },
  ]) {
    await call({ paintIds: ids.slice(0, 3), state: "OWNED" });
    const response = await call({ paintIds, ...body });
    assert.deepEqual(await response.json(), { ok: true, updated: 2 });
    assert.deepEqual(inventory(), expected([ids[2]], "OWNED", "FULL", 1));
  }
});

void test("bulk requests keep the 500 unique paint limit and single-paint precedence", async () => {
  const response = await call({ paintIds: [ids[0], ...ids], state: "OWNED" });
  assert.deepEqual(await response.json(), { ok: true, updated: 500 });
  assert.deepEqual(inventory(), expected(ids.slice(0, 500), "OWNED", "FULL", 1));
  const single = await call({ paintId: ids[500], paintIds: [ids[501]], state: "WISHLIST" });
  assert.deepEqual(await single.json(), { ok: true, updated: 1 });
  assert.equal(
    inventory().some((row) => row.paintId === ids[501]),
    false,
  );
  assert.equal(inventory().find((row) => row.paintId === ids[500])?.state, "WISHLIST");
});

void test("requests without paint ids return 400 and leave inventory unchanged", async () => {
  for (const body of [{}, { paintIds: [] }]) {
    const response = await call(body);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Paint is required" });
  }
  assert.deepEqual(inventory(), []);
});

void test("shared stock command preserves non-finite and nullable quantity defaults", () => {
  for (const quantity of [undefined, null, NaN, Infinity, -Infinity]) {
    const result = setPaintStock({ paintId: ids[0], state: "OWNED", quantity });
    assert.deepEqual(result, { ok: true, updated: 1 });
    assert.deepEqual(inventory(), expected([ids[0]], "OWNED", "FULL", 1));
  }
});

void test("shared command is synchronous and its writes and change log join an outer transaction", () => {
  const sqlite = getSqlite();
  const before = vaultSnapshot().cursor;
  const abort = new Error("Abort outer mutation");
  assert.throws(
    () =>
      sqlite.transaction(() => {
        const result = setPaintStock({ paintId: ids[0], state: "OWNED", quantity: 4 });
        assert.deepEqual(result, { ok: true, updated: 1 });
        assert.equal(inventory()[0].quantity, 4);
        assert.ok(currentChangeSeq(sqlite) > before.seq);
        throw abort;
      })(),
    (error) => error === abort,
  );
  assert.deepEqual(inventory(), []);
  assert.equal(currentChangeSeq(sqlite), before.seq);

  const committed = sqlite.transaction(() => {
    const result = setPaintStock({ paintIds: ids.slice(0, 2), state: "OWNED", stockLevel: "LOW" });
    const delta = vaultChangesSince(before.epoch, before.seq);
    return { result, delta };
  })();
  assert.deepEqual(committed.result, { ok: true, updated: 2 });
  assert.equal(committed.delta.reload, false);
  assert.deepEqual(
    committed.delta.changes.map(({ table, key, row }) => ({
      table,
      key,
      row: row && {
        paintId: row.paintId,
        state: row.state,
        stockLevel: row.stockLevel,
        quantity: row.quantity,
      },
    })),
    ids.slice(0, 2).map((paintId) => ({
      table: "paintRecords",
      key: { paintId },
      row: { paintId, state: "OWNED", stockLevel: "LOW", quantity: 1 },
    })),
  );
  const cursor = committed.delta;
  setPaintStock({ paintId: ids[0], state: null });
  const deletion = vaultChangesSince(cursor.epoch, cursor.seq);
  assert.deepEqual(deletion.changes, [{ table: "paintRecords", key: { paintId: ids[0] }, row: null }]);
});

void test("shared command exposes typed errors and keeps clearing unknown IDs harmless", async () => {
  assert.throws(
    () => setPaintStock({}),
    (error) =>
      error instanceof PaintStockError && error.status === 400 && error.message === "Paint is required",
  );
  assert.throws(
    () => setPaintStock({ paintId: testUserId("unknown"), state: "OWNED" }),
    (error) => error instanceof PaintStockError && error.status === 404,
  );
  assert.deepEqual(setPaintStock({ paintId: testUserId("unknown"), state: null }), { ok: true, updated: 1 });
  for (const paintIds of [[null], [123], [""], [{}]]) {
    const response = await call({ paintIds, state: "OWNED" });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Paint IDs must be non-empty strings" });
  }
  assert.deepEqual(inventory(), []);
});
