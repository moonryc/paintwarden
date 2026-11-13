import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";

import { createFuzzyIndex, searchFuzzyIndex } from "@paint-vault/core/fuzzy-search";
import { GraphQLError, print } from "graphql";

import { WishlistPageDocument } from "../../../packages/vault-ui/src/dom/graphql/generated/graphql.ts";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-wishlist-"));
const originalDataDir = process.env.DATA_DIR;
const originalDatabasePath = process.env.DATABASE_PATH;
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getSqlite } = await import("../db/index.ts");
const {
  readWishlist,
  readWishlistModelOptions,
  readWishlistRelatedProjects,
  readWishlistExport,
  clearWishlistProjectionCache,
  wishlistProjectionDiagnostics,
} = await import("./wishlist.ts");
const { readMiniatures, clearMiniatureProjectionCache } = await import("./miniatures.ts");
const sqlite = getSqlite();
const timestamp = 1_800_000_000_000;
let serial = 0;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const nextId = () => uuid(++serial);
const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);
function miniature(title: string, status = "OWNED", createdAt = timestamp) {
  const id = nextId();
  sqlite
    .prepare(`INSERT INTO miniatures(id,title,status,created_at,updated_at) VALUES(?,?,?,?,?)`)
    .run(id, title, status, createdAt, timestamp);
  return id;
}
function paint(name: string, brand = "Fixture", id = nextId()) {
  sqlite
    .prepare(
      "INSERT INTO paint_catalog(id,brand,range,name,color_hex,updated_at) VALUES(?,?,'Base',?,'#123456',?)",
    )
    .run(id, brand, name, timestamp);
  return id;
}
function inventory(id: string, state = "OWNED", stock = "FULL", quantity = 1) {
  sqlite
    .prepare("INSERT INTO paint_inventory(paint_id,state,stock_level,quantity,updated_at) VALUES(?,?,?,?,?)")
    .run(id, state, stock, quantity, timestamp);
}
function substitution(target: string, ingredients: string[] = [], active = true) {
  const id = nextId();
  sqlite
    .prepare(
      `INSERT INTO paint_substitutions(id,target_paint_id,name,is_default,created_at,updated_at) VALUES(?,?,'Fixture mix',?,?,?)`,
    )
    .run(id, target, Number(active), timestamp, timestamp);
  ingredients.forEach((paintId, order) =>
    sqlite
      .prepare(
        `INSERT INTO paint_substitution_ingredients(substitution_id,paint_id,parts,sort_order,updated_at) VALUES(?,?,1,?,?)`,
      )
      .run(id, paintId, order, timestamp),
  );
  return id;
}
function requirement(miniatureId: string, paintId: string, order = 0) {
  sqlite
    .prepare(
      `INSERT INTO miniature_required_paints(id,miniature_id,paint_id,step,sort_order,updated_at) VALUES(?,?,?,?,?,?)`,
    )
    .run(nextId(), miniatureId, paintId, order ? "HIGHLIGHT" : "OTHER", order, timestamp);
}
function scheme(miniatureId: string, paints: string[]) {
  const id = nextId();
  sqlite
    .prepare("INSERT INTO color_schemes(id,name,created_at,updated_at) VALUES(?,'Fixture scheme',?,?)")
    .run(id, timestamp, timestamp);
  paints.forEach((paintId, order) =>
    sqlite
      .prepare("INSERT INTO color_scheme_paints(scheme_id,paint_id,sort_order,updated_at) VALUES(?,?,?,?)")
      .run(id, paintId, order, timestamp),
  );
  sqlite
    .prepare(
      "INSERT INTO miniature_color_schemes(miniature_id,scheme_id,sort_order,updated_at) VALUES(?,?,0,?)",
    )
    .run(miniatureId, id, timestamp);
}
const code = (expected: string) => (error: unknown) =>
  error instanceof GraphQLError && error.extensions.code === expected;
beforeEach(() => {
  sqlite.exec(
    "DELETE FROM miniatures; DELETE FROM miniature_templates; DELETE FROM color_schemes; DELETE FROM paint_catalog; DELETE FROM catalog_sources;",
  );
  serial = 0;
  clearWishlistProjectionCache();
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

void test("empty vault returns bounded connections and complete empty export", () => {
  const view = readWishlist({ first: 1 });
  assert.deepEqual(view.counts, {
    shoppingPaints: 0,
    restockPaints: 0,
    projectCount: 0,
    missingPaints: 0,
    missingStock: 0,
    brokenSubstitution: 0,
    listedMissingStock: 0,
  });
  assert.deepEqual(view.shopping, {
    nodes: [],
    totalCount: 0,
    pageInfo: { hasNextPage: false, endCursor: null },
  });
  assert.deepEqual(view.missing, view.shopping);
  assert.equal(readWishlistModelOptions({ first: 1 }).totalCount, 0);
  assert.equal(readWishlistRelatedProjects({ paintId: "unknown", first: 1 }).totalCount, 0);
  assert.deepEqual(readWishlistExport({}), {
    revision: view.revision,
    totalCount: 0,
    text: "Paint shopping list",
  });
});
void test("shopping membership uses raw inventory, not effective availability or broken status", () => {
  const wish = paint("Wish"),
    depleted = paint("Depleted"),
    zero = paint("Zero"),
    emptyWish = paint("Wishlist empty"),
    low = paint("Low"),
    missing = paint("Missing"),
    ownedBroken = paint("Owned broken");
  inventory(wish, "WISHLIST");
  inventory(depleted, "OWNED", "EMPTY", 2);
  inventory(zero, "OWNED", "FULL", 0);
  inventory(emptyWish, "WISHLIST", "EMPTY");
  inventory(low, "OWNED", "LOW");
  inventory(ownedBroken);
  substitution(wish, [low]);
  substitution(ownedBroken);
  const mini = miniature("Project");
  [missing, ownedBroken, wish, depleted, zero].forEach((p) => requirement(mini, p));
  const view = readWishlist({ first: 100 });
  assert.deepEqual(new Set(ids(view.shopping.nodes)), new Set([wish, depleted, zero, emptyWish]));
  assert.equal(view.shopping.nodes.find((r) => r.id === wish)!.paint.available, true);
  assert.equal(
    view.shopping.nodes.find((r) => r.id === wish)!.projectCount,
    0,
    "active mix overrides original wishlist target",
  );
  assert.deepEqual(
    view.shopping.nodes
      .filter((r) => r.restock)
      .map((r) => r.id)
      .sort(),
    [depleted, zero, emptyWish].sort(),
  );
  assert.deepEqual(ids(view.missing.nodes), [missing, ownedBroken]);
  assert.equal(view.counts.listedMissingStock, 2);
  assert.equal(view.counts.projectCount, 1);
});
void test("all miniatures, duplicate targets, attached schemes and nested defaults yield deduplicated leaf associations", () => {
  const leaf = paint("Leaf"),
    other = paint("Other"),
    target = paint("Target"),
    middle = paint("Middle");
  inventory(leaf, "WISHLIST");
  inventory(other, "WISHLIST");
  substitution(target, [middle, leaf]);
  substitution(middle, [leaf, other]);
  const owned = miniature("Owned"),
    wish = miniature("Wishlist", "WISHLIST");
  requirement(owned, target);
  requirement(owned, target, 1);
  requirement(owned, leaf, 2);
  scheme(owned, [leaf, target, other]);
  requirement(wish, target);
  scheme(wish, [target]);
  const rows = readWishlist({ first: 100 }).shopping.nodes;
  assert.deepEqual(ids(rows), [leaf, other]);
  for (const row of rows) {
    assert.equal(row.projectCount, 2);
    assert.deepEqual(new Set(ids(row.relatedProjectsPreview)), new Set([owned, wish]));
    assert.equal(row.relatedProjectsTruncated, false);
  }
  assert.equal(
    readWishlistRelatedProjects({ paintId: target, first: 100 }).totalCount,
    0,
    "not original/transitive targets",
  );
  assert.equal(readWishlistModelOptions({ first: 100 }).nodes.find((m) => m.id === wish)!.projectCount, 2);
});
void test("broken empty/cyclic substitutions never fall back or enter shopping; flags coexist; direct self is physical", () => {
  const emptyOwned = paint("Owned empty"),
    emptyMissing = paint("Missing empty"),
    a = paint("Cycle A"),
    b = paint("Cycle B"),
    ancestor = paint("Ancestor"),
    self = paint("Self"),
    listed = paint("Listed broken");
  [emptyOwned, a, b, ancestor, self].forEach((p) => inventory(p));
  inventory(listed, "WISHLIST");
  substitution(emptyOwned);
  substitution(emptyMissing);
  substitution(a, [b]);
  substitution(b, [a]);
  substitution(ancestor, [emptyOwned, emptyMissing, a]);
  substitution(self, [self]);
  substitution(listed);
  const mini = miniature("Broken graph");
  requirement(mini, ancestor);
  requirement(mini, self);
  requirement(mini, listed);
  const view = readWishlist({ first: 100 });
  assert.deepEqual(ids(view.shopping.nodes), [listed]);
  assert.equal(view.shopping.nodes[0].brokenSubstitution, true);
  assert.deepEqual(
    view.missing.nodes.map((r) => [r.id, r.missingStock, r.brokenSubstitution]),
    [
      [b, false, true],
      [emptyMissing, true, true],
      [emptyOwned, false, true],
    ],
  );
  assert.equal(view.counts.missingStock, 1);
  assert.equal(view.counts.brokenSubstitution, 3);
  assert.equal(view.counts.listedMissingStock, 1);
  assert.equal(readWishlistRelatedProjects({ paintId: self, first: 100 }).totalCount, 1);
  const otherRoot = miniature("Other root");
  requirement(otherRoot, b);
  assert.equal(readWishlist({ first: 100 }).missing.nodes.find((r) => r.id === a)!.brokenSubstitution, true);
});
void test("model filtering narrows shopping only; all global counts and missing panel stay unchanged", () => {
  const first = miniature("One"),
    second = miniature("Two", "WISHLIST"),
    empty = miniature("Empty");
  const a = paint("A"),
    b = paint("B"),
    missing = paint("Global missing");
  inventory(a, "WISHLIST");
  inventory(b, "WISHLIST");
  requirement(first, a);
  requirement(second, b);
  requirement(second, missing);
  const all = readWishlist({ first: 1, missingFirst: 1 });
  const one = readWishlist({ first: 100, miniatureId: first });
  assert.deepEqual(ids(one.shopping.nodes), [a]);
  assert.deepEqual(one.counts, all.counts);
  assert.deepEqual(one.missing, all.missing);
  assert.equal(readWishlist({ first: 1, miniatureId: empty }).shopping.totalCount, 0);
  assert.equal(readWishlist({ first: 1, miniatureId: "absent" }).shopping.totalCount, 0);
  assert.deepEqual(
    readWishlist({ first: 100, miniatureId: null }).shopping.nodes.map((r) => r.id),
    [a, b],
  );
  assert.equal(
    readWishlistExport({ miniatureId: first }).text,
    "Paint shopping list for One\n\nFixture\n• A (Base)",
  );
  assert.equal(readWishlistExport({ miniatureId: second }).totalCount, 1);
});
void test("shopping order groups canonical normalized brands then projectCount descending/name/id; custom under Custom", () => {
  const a = paint("Zeta", "acme", uuid(901)),
    b = paint("Alpha", "Acme", uuid(902)),
    tieZ = paint("Équal", "Acme", uuid(904)),
    tieA = paint("Equal", "Acme", uuid(903)),
    custom = paint("Custom", "AAAA", `user:${nextId()}`),
    last = paint("Last", "ZZZ", uuid(905));
  [a, b, tieZ, tieA, custom, last].forEach((p) => inventory(p, "WISHLIST"));
  requirement(miniature("First"), a);
  requirement(miniature("Second"), a);
  requirement(miniature("Third"), b);
  const all = readWishlist({ first: 100 }).shopping.nodes;
  assert.deepEqual(ids(all), [a, b, tieA, tieZ, custom, last]);
  assert.equal(all.find((r) => r.id === custom)!.brandGroup, "Custom");
  let cursor: string | null | undefined;
  const collected: string[] = [];
  do {
    const page = readWishlist({ first: 2, after: cursor }).shopping;
    collected.push(...ids(page.nodes));
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  assert.deepEqual(collected, ids(all));
  assert.equal(new Set(collected).size, all.length);
});
void test("both independent window cursors bind roots, model filters, ID anchors and revisions", () => {
  const mini = miniature("Project");
  for (let i = 0; i < 5; i++) {
    const id = paint(`Paint ${i}`);
    if (i < 2) inventory(id, "WISHLIST");
    requirement(mini, id);
  }
  const page = readWishlist({ first: 1, missingFirst: 1 });
  const after = page.shopping.pageInfo.endCursor!,
    missingAfter = page.missing.pageInfo.endCursor!;
  assert.equal(
    readWishlist({ first: 1, after, missingFirst: 1, missingAfter }).shopping.nodes[0].id,
    readWishlist({ first: 100 }).shopping.nodes[1].id,
  );
  assert.equal(readWishlist({ first: 1, after, missingAfter }).missing.nodes.length, 2);
  assert.throws(() => readWishlist({ first: 1, after: missingAfter }), code("BAD_USER_INPUT"));
  assert.throws(() => readWishlist({ first: 1, missingAfter: after }), code("BAD_USER_INPUT"));
  assert.throws(() => readWishlist({ first: 1, after, miniatureId: mini }), code("BAD_USER_INPUT"));
  assert.throws(() => readWishlistModelOptions({ first: 1, after }), code("BAD_USER_INPUT"));
  const payload = JSON.parse(Buffer.from(after, "base64url").toString());
  payload[4] = "nonexistent";
  assert.throws(
    () => readWishlist({ first: 1, after: Buffer.from(JSON.stringify(payload)).toString("base64url") }),
    code("BAD_USER_INPUT"),
  );
  miniature("External write");
  assert.throws(() => readWishlist({ first: 1, after }), code("STALE_CURSOR"));
  assert.throws(() => readWishlist({ first: 1, missingAfter }), code("STALE_CURSOR"));
});
void test("related preview is bounded; continuation includes every distinct related model, not only owned", () => {
  const p = paint("Shared"),
    other = paint("Other");
  inventory(p, "WISHLIST");
  const models: string[] = [];
  for (let i = 0; i < 9; i++) {
    const id = miniature(`Project ${i}`, i % 2 ? "WISHLIST" : "OWNED");
    models.push(id);
    requirement(id, p);
    requirement(id, p, 1);
  }
  const row = readWishlist({ first: 1 }).shopping.nodes[0];
  assert.equal(row.projectCount, 9);
  assert.equal(row.relatedProjectsPreview.length, 3);
  assert.equal(row.relatedProjectsTruncated, true);
  const first = readWishlistRelatedProjects({ paintId: p, first: 2 });
  assert.throws(
    () => readWishlistRelatedProjects({ paintId: other, first: 2, after: first.pageInfo.endCursor }),
    code("BAD_USER_INPUT"),
  );
  const tail = readWishlistRelatedProjects({ paintId: p, first: 100, after: first.pageInfo.endCursor });
  assert.deepEqual(new Set([...ids(first.nodes), ...ids(tail.nodes)]), new Set(models));
  assert.equal(tail.pageInfo.hasNextPage, false);
});
void test("model picker includes zero-count and unloaded models with core fuzzy matching and cached deep pages", () => {
  miniature("Café hero");
  miniature("Scarlet captain", "WISHLIST");
  miniature("Scarlat guard");
  miniature("Same");
  miniature("Same");
  sqlite.prepare("UPDATE miniatures SET notes='weathered bronze' WHERE title='Café hero'").run();
  const base = readMiniatures({ first: 100 }).miniatures.nodes;
  const index = createFuzzyIndex(
    base,
    (m) => `${m.title} ${m.notes} ${m.manufacturer} ${m.faction} ${m.scale} ${m.paintingStatus}`,
  );
  for (const search of ["", "  ", "scarlte", "cafe", "weathered", "xyzzyplugh", "same"]) {
    const view = readWishlistModelOptions({ first: 100, search });
    assert.deepEqual(ids(view.nodes), ids(searchFuzzyIndex(index, search.trim())), search);
    assert.ok(view.nodes.every((m) => m.projectCount === 0));
  }
  const first = readWishlistModelOptions({ first: 1, search: "same" });
  const diagnostics = wishlistProjectionDiagnostics();
  assert.equal(
    readWishlistModelOptions({ first: 1, search: " same ", after: first.pageInfo.endCursor }).nodes.length,
    1,
  );
  assert.equal(wishlistProjectionDiagnostics().searchRanks, diagnostics.searchRanks);
  assert.throws(
    () => readWishlistModelOptions({ first: 1, search: "cafe", after: first.pageInfo.endCursor }),
    code("BAD_USER_INPUT"),
  );
});
void test("expired/evicted model search generations return STALE_CURSOR, never silently rerank deep pages", () => {
  miniature("Same");
  miniature("Same");
  const first = readWishlistModelOptions({ first: 1, search: "Same" });
  const now = Date.now;
  try {
    Date.now = () => now() + 60_001;
    assert.throws(
      () => readWishlistModelOptions({ first: 1, search: "Same", after: first.pageInfo.endCursor }),
      code("STALE_CURSOR"),
    );
  } finally {
    Date.now = now;
  }
  const page = readWishlistModelOptions({ first: 1, search: "Same" });
  for (let i = 0; i < 101; i++) readWishlistModelOptions({ first: 1, search: `other${i}` });
  assert.ok(wishlistProjectionDiagnostics().resultSets <= 100);
  assert.throws(
    () => readWishlistModelOptions({ first: 1, search: "Same", after: page.pageInfo.endCursor }),
    code("STALE_CURSOR"),
  );
});
void test("complete filtered export does not truncate to loaded shopping pages or include unlisted issues", () => {
  const model = miniature("Export model");
  for (let i = 0; i < 137; i++) {
    const id = paint(`Paint ${String(i).padStart(3, "0")}`, "Fixture", uuid(1000 + i));
    inventory(id, "WISHLIST");
    if (i % 2 === 0) requirement(model, id);
  }
  requirement(model, paint("Unlisted issue"));
  assert.equal(readWishlist({ first: 1 }).shopping.nodes.length, 1);
  const all = readWishlistExport({}),
    filtered = readWishlistExport({ miniatureId: model });
  assert.equal(all.totalCount, 137);
  assert.equal(all.text.split("\n").filter((l) => l.startsWith("• ")).length, 137);
  assert.match(all.text, /Paint 136/);
  assert.doesNotMatch(all.text, /Unlisted issue/);
  assert.equal(filtered.totalCount, 69);
  assert.match(filtered.text, /^Paint shopping list for Export model/);
  assert.doesNotMatch(filtered.text, /Paint 135/);
});
void test("all first/cursor/text inputs are bounded and malformed cursors rejected", () => {
  for (const first of [0, -1, 101, 1.1, NaN, Infinity]) {
    assert.throws(() => readWishlist({ first }), code("BAD_USER_INPUT"));
    assert.throws(() => readWishlist({ first: 1, missingFirst: first }), code("BAD_USER_INPUT"));
    assert.throws(() => readWishlistModelOptions({ first }), code("BAD_USER_INPUT"));
    assert.throws(() => readWishlistRelatedProjects({ first, paintId: "id" }), code("BAD_USER_INPUT"));
  }
  for (const after of ["", "bad=", "a".repeat(8193), Buffer.from("{}").toString("base64url")])
    assert.throws(() => readWishlist({ first: 1, after }), code("BAD_USER_INPUT"));
  assert.throws(() => readWishlist({ first: 1, miniatureId: "a".repeat(257) }), code("BAD_USER_INPUT"));
  assert.throws(() => readWishlist({ first: 1, missingAfter: "a".repeat(8193) }), code("BAD_USER_INPUT"));
  assert.throws(
    () => readWishlistModelOptions({ first: 1, search: "a".repeat(129) }),
    code("BAD_USER_INPUT"),
  );
  assert.throws(
    () => readWishlistRelatedProjects({ first: 1, paintId: "a".repeat(257) }),
    code("BAD_USER_INPUT"),
  );
  assert.throws(() => readWishlistExport({ miniatureId: "a".repeat(257) }), code("BAD_USER_INPUT"));
});
void test("aggregate reuses an exact generation and never publishes rollback-local stock, relationships or search", () => {
  const mini = miniature("Committed"),
    p = paint("Needed");
  requirement(mini, p);
  const before = readWishlist({ first: 1 });
  readWishlist({ first: 1 });
  readWishlistModelOptions({ first: 1 });
  readWishlistExport({});
  assert.equal(wishlistProjectionDiagnostics().builds, 1);
  const rollback = new Error("rollback");
  assert.throws(
    () =>
      sqlite.transaction(() => {
        inventory(p, "WISHLIST");
        sqlite.prepare("UPDATE miniatures SET title='Rolled back'").run();
        assert.equal(readWishlist({ first: 1 }).shopping.totalCount, 1);
        assert.equal(readWishlistModelOptions({ first: 1, search: "Rolled back" }).totalCount, 1);
        throw rollback;
      })(),
    (error: unknown) => error === rollback,
  );
  assert.deepEqual(readWishlist({ first: 1 }), before);
  sqlite.prepare("UPDATE miniatures SET title='Actually committed'").run();
  assert.equal(readWishlistModelOptions({ first: 1, search: "Rolled back" }).totalCount, 0);
  assert.equal(readWishlist({ first: 1 }).shopping.totalCount, 0);
  inventory(p, "WISHLIST");
  assert.equal(readWishlist({ first: 1 }).shopping.totalCount, 1);
  assert.equal(readWishlist({ first: 1 }).missing.totalCount, 0);
});

void test("HTTP exposes bounded wishlist windows, model picker, complete export and related continuation", async () => {
  const mini = miniature("HTTP miniature"),
    p = paint("HTTP paint");
  inventory(p, "WISHLIST");
  requirement(mini, p);
  const missing = paint("Broken paint");
  inventory(missing);
  substitution(missing);
  requirement(mini, missing);
  const { graphqlResponse } = await import("./server.ts");
  const post = (query: string) =>
    graphqlResponse(
      new Request("http://127.0.0.1/api/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      }),
      false,
    );
  const response = await post(
    `{wishlist(first:1,missingFirst:1,miniatureId:"${mini}"){revision{epoch seq} counts{shoppingPaints missingStock brokenSubstitution listedMissingStock projectCount} shopping{nodes{id brandGroup restock missingStock brokenSubstitution projectCount relatedProjectsPreview{id title} relatedProjectsTruncated}totalCount pageInfo{hasNextPage endCursor}}missing{nodes{id missingStock brokenSubstitution}}}wishlistModelOptions(first:1,search:"HTTP"){nodes{id title projectCount}}wishlistExport(miniatureId:"${mini}"){text totalCount}}`,
  );
  const productionDocument = await graphqlResponse(
    new Request("http://127.0.0.1/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: print(WishlistPageDocument),
        variables: { first: 48, missingFirst: 48, miniatureId: mini },
      }),
    }),
    false,
  );
  const productionPayload = await productionDocument.json();
  assert.equal(productionPayload.errors, undefined, JSON.stringify(productionPayload));
  assert.equal(productionPayload.data.wishlist.shopping.nodes[0].paint.name, "HTTP paint");
  const payload = await response.json();
  assert.equal(payload.errors, undefined, JSON.stringify(payload));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(payload.data.wishlist.counts, {
    shoppingPaints: 1,
    missingStock: 0,
    brokenSubstitution: 1,
    listedMissingStock: 1,
    projectCount: 1,
  });
  assert.deepEqual(payload.data.wishlist.missing.nodes, [
    { id: missing, missingStock: false, brokenSubstitution: true },
  ]);
  assert.equal(payload.data.wishlist.revision.seq, String(readWishlist({ first: 1 }).revision.seq));
  assert.equal(payload.data.wishlist.shopping.nodes[0].id, p);
  assert.equal(payload.data.wishlistExport.totalCount, 1);
  const related = await (
    await post(`{wishlistRelatedProjects(paintId:"${p}",first:1){revision{seq}nodes{id title}totalCount}}`)
  ).json();
  assert.equal(related.errors, undefined);
  assert.deepEqual(related.data.wishlistRelatedProjects.nodes, [{ id: mini, title: "HTTP miniature" }]);
  for (const query of [
    "{wishlist(missingFirst:101){counts{shoppingPaints}}}",
    "{wishlist(missingFirst:0){counts{shoppingPaints}}}",
    "{wishlist(first:101){counts{shoppingPaints}}}",
  ]) {
    const rejected = await (await post(query)).json();
    assert.ok(rejected.errors);
    assert.equal(rejected.data, undefined);
  }
});

void test("acquired retained shopping paint keeps all deduplicated project associations after leaving shopping", () => {
  const p = paint("Retained purchase");
  const ownedMini = miniature("Owned project");
  const wishMini = miniature("Wishlist project", "WISHLIST");
  inventory(p, "WISHLIST", "FULL", 0);
  requirement(ownedMini, p);
  requirement(ownedMini, p, 1);
  scheme(ownedMini, [p]);
  requirement(wishMini, p);
  assert.equal(readWishlist({ first: 1 }).shopping.nodes[0].projectCount, 2);
  sqlite
    .prepare("UPDATE paint_inventory SET state='OWNED', stock_level='FULL', quantity=2 WHERE paint_id=?")
    .run(p);
  assert.equal(readWishlist({ first: 1 }).shopping.totalCount, 0);
  assert.equal(readWishlistExport({}).totalCount, 0);
  const related = readWishlistRelatedProjects({ paintId: p, first: 100 });
  assert.equal(related.totalCount, 2);
  assert.deepEqual(new Set(ids(related.nodes)), new Set([ownedMini, wishMini]));
});
