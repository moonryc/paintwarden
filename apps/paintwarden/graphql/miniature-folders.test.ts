import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";

import { GraphQLError } from "graphql";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-miniature-folders-"));
const originalDataDir = process.env.DATA_DIR;
const originalDatabasePath = process.env.DATABASE_PATH;
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getSqlite } = await import("../db/index.ts");
const { readHome, readMiniatures, readMiniature, clearMiniatureProjectionCache } =
  await import("./miniatures.ts");
const sqlite = getSqlite();
const timestamp = 1_800_000_000_000;
let serial = 0;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const nextId = () => uuid(++serial);
const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);
type ListArgs = Parameters<typeof readMiniatures>[0];
function miniature(
  title: string,
  options: {
    id?: string;
    status?: ListArgs["ownership"];
    stage?: ListArgs["stage"];
    notes?: string;
    manufacturer?: string;
    faction?: string;
    scale?: string;
    createdAt?: number;
  } = {},
) {
  const id = options.id ?? nextId();
  sqlite
    .prepare(
      `INSERT INTO miniatures
    (id,title,status,painting_status,notes,manufacturer,faction,scale,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      title,
      options.status ?? "OWNED",
      options.stage ?? "NOT_STARTED",
      options.notes ?? "",
      options.manufacturer ?? "",
      options.faction ?? "",
      options.scale ?? "",
      options.createdAt ?? timestamp,
      timestamp,
    );
  return id;
}
function paint(name: string, color: string | null = "#123456") {
  const id = nextId();
  sqlite
    .prepare(
      "INSERT INTO paint_catalog(id,brand,range,name,color_hex,updated_at) VALUES(?,'Fixture','Base',?,?,?)",
    )
    .run(id, name, color, timestamp);
  return id;
}
function inventory(id: string, state = "OWNED", stock = "FULL", quantity = 1) {
  sqlite
    .prepare("INSERT INTO paint_inventory(paint_id,state,stock_level,quantity,updated_at) VALUES(?,?,?,?,?)")
    .run(id, state, stock, quantity, timestamp);
}
function requirement(miniatureId: string, paintId: string, step = "OTHER", notes = "", order = 0) {
  const id = nextId();
  sqlite
    .prepare(
      `INSERT INTO miniature_required_paints(id,miniature_id,paint_id,step,notes,sort_order,updated_at)
    VALUES(?,?,?,?,?,?,?)`,
    )
    .run(id, miniatureId, paintId, step, notes, order, timestamp);
  return id;
}
function code(expected: string) {
  return (error: unknown) => error instanceof GraphQLError && error.extensions.code === expected;
}
beforeEach(() => {
  sqlite.exec(
    "DELETE FROM miniatures; DELETE FROM miniature_templates; DELETE FROM color_schemes; DELETE FROM paint_catalog; DELETE FROM catalog_sources; DELETE FROM folders;",
  );
  serial = 0;
  clearMiniatureProjectionCache();
});
after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;
});

void test("folder paging binds cursors/cache scope and filters before fuzzy ranking", () => {
  const parent = uuid(1000);
  const child = uuid(1001);
  const sibling = uuid(1002);
  const templateFolder = uuid(1003);
  const folder = sqlite.prepare(
    "INSERT INTO folders(id,kind,parent_id,name,created_at,updated_at) VALUES(?,?,?,?,?,?)",
  );
  folder.run(parent, "miniature", null, "Parent", timestamp, timestamp);
  folder.run(child, "miniature", parent, "Child", timestamp, timestamp);
  folder.run(sibling, "miniature", null, "Sibling", timestamp, timestamp);
  folder.run(templateFolder, "template", null, "Templates", timestamp, timestamp);
  const root = miniature("Scarlet");
  const direct = miniature("Scarlat A");
  const nested = miniature("Scarlat B");
  const other = miniature("Scarlet sibling");
  for (const [id, folderId] of [
    [direct, parent],
    [nested, child],
    [other, sibling],
  ])
    sqlite.prepare("UPDATE miniatures SET folder_id=? WHERE id=?").run(folderId, id);
  assert.equal(readMiniatures({ first: 100 }).miniatures.totalCount, 4);
  assert.deepEqual(ids(readMiniatures({ first: 100, flat: false }).miniatures.nodes), [root]);
  assert.deepEqual(ids(readMiniatures({ first: 100, folderId: parent, flat: false }).miniatures.nodes), [
    direct,
  ]);
  assert.deepEqual(ids(readMiniatures({ first: 100, folderId: parent }).miniatures.nodes), [direct, nested]);
  assert.equal(readMiniature(nested).miniature!.folderId, child);
  assert.equal(readMiniatures({ first: 1, folderId: templateFolder }).miniatures.totalCount, 0);
  assert.equal(readMiniatures({ first: 1, folderId: "absent" }).miniatures.totalCount, 0);
  const first = readMiniatures({ first: 1, folderId: parent, search: "scarlet" });
  assert.equal(first.miniatures.totalCount, 2, "excluded root literal cannot suppress subtree typos");
  const after = first.miniatures.pageInfo.endCursor;
  assert.deepEqual(
    ids(readMiniatures({ first: 1, folderId: parent, search: "scarlet", after }).miniatures.nodes),
    [nested],
  );
  for (const scope of [{ folderId: parent, flat: false }, { folderId: sibling }, {}])
    assert.throws(
      () => readMiniatures({ first: 1, search: "scarlet", after, ...scope }),
      code("BAD_USER_INPUT"),
    );
  assert.equal(readMiniatures({ first: 1, folderId: sibling, search: "scarlet" }).miniatures.totalCount, 1);
  sqlite.prepare("UPDATE miniatures SET folder_id=? WHERE id=?").run(sibling, nested);
  assert.throws(
    () => readMiniatures({ first: 1, folderId: parent, search: "scarlet", after }),
    code("STALE_CURSOR"),
  );
  assert.equal(readMiniatures({ first: 100, folderId: parent }).miniatures.totalCount, 1);
});

void test("Workbench counts summarize a folder subtree independently of direct paging, search and stage", () => {
  const parent = uuid(1004),
    child = uuid(1005),
    other = uuid(1006);
  const folder = sqlite.prepare(
    "INSERT INTO folders(id,kind,parent_id,name,created_at,updated_at) VALUES(?,'miniature',?,'Fixture',?,?)",
  );
  folder.run(parent, null, timestamp, timestamp);
  folder.run(child, parent, timestamp, timestamp);
  folder.run(other, null, timestamp, timestamp);
  const full = paint("Available"),
    missing = paint("Wishlisted"),
    elsewhere = paint("Elsewhere missing");
  inventory(full);
  inventory(missing, "WISHLIST");
  const direct = miniature("Direct ready", { stage: "COMPLETE" });
  const nested = miniature("Nested blocked", { stage: "PRIMED" });
  const wish = miniature("Nested wishlist", { status: "WISHLIST" });
  const sibling = miniature("Other owned");
  const loose = miniature("Root ready");
  for (const [id, folderId] of [
    [direct, parent],
    [nested, child],
    [wish, child],
    [sibling, other],
  ])
    sqlite.prepare("UPDATE miniatures SET folder_id=? WHERE id=?").run(folderId, id);
  requirement(direct, full);
  requirement(loose, full);
  requirement(nested, missing);
  requirement(wish, elsewhere);
  requirement(sibling, elsewhere);
  const scoped = readHome({ first: 1, folderId: parent, flat: false });
  assert.deepEqual(ids(scoped.miniatures.nodes), [direct]);
  assert.deepEqual(scoped.counts, {
    catalogCount: 3,
    owned: 2,
    ready: 1,
    distinctMissingPaints: 1,
    wishlistedMissingPaints: 1,
    stages: scoped.counts.stages,
  });
  assert.equal(scoped.counts.stages.find((f) => f.key === "PRIMED")!.count, 1);
  assert.deepEqual(readHome({ first: 1, folderId: parent }).counts, scoped.counts);
  assert.deepEqual(
    readHome({ first: 1, folderId: parent, flat: false, stage: "ASSEMBLED", search: "absent" }).counts,
    scoped.counts,
  );
  assert.equal(readHome({ first: 1, flat: false }).counts.owned, 4);
  assert.deepEqual(readHome({ first: 1, flat: false }).counts, readHome({ first: 1 }).counts);
  assert.equal(readHome({ first: 1, flat: false }).miniatures.totalCount, 1);
  assert.equal(readHome({ first: 1 }).counts.owned, 4);
  assert.equal(readHome({ first: 1, folderId: other }).counts.ready, 0);
  assert.equal(readHome({ first: 1, folderId: "absent" }).counts.owned, 0);
  assert.deepEqual(
    readHome({ first: 1, folderId: parent, flat: false }).counts,
    scoped.counts,
    "other scopes do not poison cached counts",
  );
});
