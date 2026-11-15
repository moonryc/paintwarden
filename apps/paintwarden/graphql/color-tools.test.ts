import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";

import { GraphQLError, Kind, visit, print } from "graphql";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-color-index-"));
const originalDataDir = process.env.DATA_DIR;
const originalDatabasePath = process.env.DATABASE_PATH;
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getSqlite } = await import("../db/index.ts");
const { readColorIndex, readSchemeColorIndex } = await import("./color-tools.ts");
const sqlite = getSqlite();
let serial = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`;
function paint(name: string, hex: string | null = "#aabbcc") {
  const id = nextId();
  sqlite
    .prepare(
      "INSERT INTO paint_catalog(id,brand,range,name,color_hex,type,discontinued,updated_at) VALUES(?,'Fixture','Base',?,?,'BASE',0,1)",
    )
    .run(id, name, hex);
  return id;
}
function inventory(id: string, state = "OWNED", stock = "FULL", quantity = 1) {
  sqlite
    .prepare("INSERT INTO paint_inventory(paint_id,state,stock_level,quantity,updated_at) VALUES(?,?,?,?,1)")
    .run(id, state, stock, quantity);
}
function substitute(target: string, ingredients: string[], isDefault = true) {
  const id = nextId();
  sqlite
    .prepare(
      "INSERT INTO paint_substitutions(id,target_paint_id,name,is_default,created_at,updated_at) VALUES(?,?,'Mix',?,1,1)",
    )
    .run(id, target, Number(isDefault));
  for (const [order, ingredient] of ingredients.entries()) {
    sqlite
      .prepare(
        "INSERT INTO paint_substitution_ingredients(substitution_id,paint_id,parts,sort_order,updated_at) VALUES(?,?,1,?,1)",
      )
      .run(id, ingredient, order);
  }
}
const code = (expected: string) => (error: unknown) =>
  error instanceof GraphQLError && error.extensions.code === expected;
const cursor = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
beforeEach(() => {
  sqlite.exec(
    "DELETE FROM miniatures; DELETE FROM miniature_templates; DELETE FROM color_schemes; DELETE FROM paint_catalog;",
  );
  serial = 0;
});
after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;
});

void test("color index is a compact projection with independent physical-owned and resolved-available flags", () => {
  const full = paint("Full");
  const low = paint("Low");
  const empty = paint("Empty");
  const zero = paint("Zero");
  const wish = paint("Wishlist");
  const missing = paint("Missing", null);
  const replaced = paint("Replaced");
  const replacedWish = paint("Replaced wishlist");
  const ownedBroken = paint("Physical bottle with broken active mix");
  const nonDefault = paint("Nondefault mix");
  const emptyMix = paint("Empty mix");
  const cycleA = paint("Cycle A");
  const cycleB = paint("Cycle B");
  const nested = paint("Nested mix");
  inventory(full);
  inventory(low, "OWNED", "LOW", 2);
  inventory(empty, "OWNED", "EMPTY", 2);
  inventory(zero, "OWNED", "FULL", 0);
  inventory(wish, "WISHLIST");
  inventory(replacedWish, "WISHLIST");
  inventory(ownedBroken);
  substitute(replaced, [full, low]);
  substitute(replacedWish, [full]);
  substitute(ownedBroken, [missing]);
  substitute(nonDefault, [full], false);
  substitute(emptyMix, []);
  substitute(cycleA, [cycleB]);
  substitute(cycleB, [cycleA]);
  substitute(nested, [replaced]);
  const result = readColorIndex({ first: 100 });
  assert.equal(result.nodes.length, 14);
  for (const row of result.nodes) {
    assert.deepEqual(Object.keys(row).sort(), ["available", "brand", "hex", "id", "name", "owned"]);
    assert.equal(row.brand, "Fixture");
  }
  const flags = new Map(result.nodes.map((row) => [row.id, [row.owned, row.available]]));
  for (const id of [full, low]) assert.deepEqual(flags.get(id), [true, true]);
  for (const id of [empty, zero, wish, missing, nonDefault, emptyMix, cycleA, cycleB]) {
    assert.deepEqual(flags.get(id), [false, false]);
  }
  for (const id of [replaced, replacedWish, nested]) assert.deepEqual(flags.get(id), [false, true]);
  assert.deepEqual(
    flags.get(ownedBroken),
    [true, false],
    "active unavailable substitution must not be conflated with physical stock",
  );
  assert.equal(result.nodes.find((row) => row.id === missing)?.hex, null);
});

void test("revision-bound color pagination walks the full catalog once, including final and empty pages", () => {
  for (let i = 0; i < 205; i++) paint(`Paint ${String(i).padStart(3, "0")}`);
  const first = readColorIndex({ first: 100 });
  const second = readColorIndex({ first: 100, after: first.pageInfo.endCursor });
  const third = readColorIndex({ first: 100, after: second.pageInfo.endCursor });
  assert.deepEqual([first.nodes.length, second.nodes.length, third.nodes.length], [100, 100, 5]);
  assert.deepEqual(
    [first.pageInfo.hasNextPage, second.pageInfo.hasNextPage, third.pageInfo.hasNextPage],
    [true, true, false],
  );
  assert.deepEqual(second.revision, first.revision);
  assert.deepEqual(third.revision, first.revision);
  const nodes = [...first.nodes, ...second.nodes, ...third.nodes];
  assert.equal(new Set(nodes.map((row) => row.id)).size, 205);
  assert.deepEqual(
    nodes.map((row) => row.name),
    [...nodes.map((row) => row.name)].sort(),
  );
  const end = readColorIndex({ first: 100, after: third.pageInfo.endCursor });
  assert.deepEqual(end.nodes, []);
  assert.deepEqual(end.pageInfo, { hasNextPage: false, endCursor: null });
});

void test("color index rejects malformed, oversized, wrong-shape and out-of-range cursors", () => {
  paint("One");
  const { epoch, seq } = readColorIndex({ first: 1 }).revision;
  for (const first of [-1, 0, 101, 1.5, NaN, Infinity]) {
    assert.throws(() => readColorIndex({ first }), code("BAD_USER_INPUT"));
  }
  const invalid = [
    "!invalid!",
    "x".repeat(8193),
    cursor(null),
    cursor({}),
    cursor([]),
    cursor(["colors-v2", epoch, seq, 0]),
    cursor(["colors-v1", 1, seq, 0]),
    cursor(["colors-v1", epoch, String(seq), 0]),
    cursor(["colors-v1", epoch, seq + 0.5, 0]),
    cursor(["colors-v1", epoch, seq, -1]),
    cursor(["colors-v1", epoch, seq, 0.5]),
    cursor(["colors-v1", epoch, seq, 2]),
    cursor(["colors-v1", epoch, seq, Number.MAX_SAFE_INTEGER + 1]),
    cursor(["colors-v1", epoch, seq, 0, "extra"]),
  ];
  for (const after of invalid)
    assert.throws(() => readColorIndex({ first: 1, after }), code("BAD_USER_INPUT"));
  for (const after of [
    cursor(["colors-v1", "old-epoch", seq, 0]),
    cursor(["colors-v1", epoch, seq - 1, 0]),
  ]) {
    assert.throws(() => readColorIndex({ first: 1, after }), code("STALE_CURSOR"));
  }
});

void test("physical inventory and substitution edits invalidate old color index cursors", () => {
  const target = paint("A target");
  const ingredient = paint("B ingredient");
  const first = readColorIndex({ first: 1 });
  inventory(ingredient);
  assert.throws(() => readColorIndex({ first: 1, after: first.pageInfo.endCursor }), code("STALE_CURSOR"));
  const second = readColorIndex({ first: 1 });
  substitute(target, [ingredient]);
  assert.throws(() => readColorIndex({ first: 1, after: second.pageInfo.endCursor }), code("STALE_CURSOR"));
  assert.deepEqual(
    readColorIndex({ first: 1 }).nodes.map((row) => [row.owned, row.available]),
    [[false, true]],
  );
});

void test("valid old cursor after catalog shrink is stale, not malformed, so loaders can restart", () => {
  for (let i = 0; i < 3; i++) paint(`Paint ${i}`);
  const first = readColorIndex({ first: 2 });
  sqlite.exec("DELETE FROM paint_catalog");
  assert.throws(() => readColorIndex({ first: 2, after: first.pageInfo.endCursor }), code("STALE_CURSOR"));
  const fresh = readColorIndex({ first: 2 });
  assert.deepEqual(fresh.nodes, []);
  assert.deepEqual(fresh.pageInfo, { hasNextPage: false, endCursor: null });
});

void test("transaction-local color projections never poison the reusable committed revision", () => {
  const id = paint("Committed");
  const initial = readColorIndex({ first: 100 });
  assert.throws(
    () =>
      sqlite.transaction(() => {
        inventory(id);
        paint("Rolled back");
        const inside = readColorIndex({ first: 100 });
        assert.equal(inside.nodes.length, 2);
        assert.equal(inside.nodes.find((row) => row.id === id)?.owned, true);
        throw new Error("rollback fixture");
      })(),
    /rollback fixture/,
  );
  assert.deepEqual(readColorIndex({ first: 100 }), initial);
});

void test("production GraphQL color index resolver remains wired alongside folders", async () => {
  const id = paint("Color integration");
  inventory(id);
  const { graphqlResponse } = await import("./server.ts");
  const response = await graphqlResponse(
    new Request("http://localhost/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "query { colorIndex(first: 1) { nodes { id name owned available } } }",
      }),
    }),
    false,
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    errors?: unknown[];
    data?: { colorIndex: { nodes: { id: string; name: string; owned: boolean; available: boolean }[] } };
  };
  assert.equal(body.errors, undefined);
  assert.deepEqual(body.data?.colorIndex.nodes, [
    { id, name: "Color integration", owned: true, available: true },
  ]);
});

function scheme(name: string, paints: string[]) {
  const id = nextId();
  sqlite.prepare("INSERT INTO color_schemes(id,name,created_at,updated_at) VALUES(?,?,1,1)").run(id, name);
  for (const [order, paintId] of paints.entries()) {
    sqlite
      .prepare("INSERT INTO color_scheme_paints(scheme_id,paint_id,sort_order,updated_at) VALUES(?,?,?,1)")
      .run(id, paintId, order);
  }
  return id;
}

void test("scheme index preserves authored color order and repetitions, with independent availability, not substituted colors", () => {
  const valid = paint("Valid", "#aabbcc");
  const missing = paint("Missing", null);
  // Legacy/corrupt colors are filtered defensively even though current writes validate hex.
  sqlite.pragma("ignore_check_constraints = ON");
  let broken: string;
  try {
    broken = paint("Broken", "not-a-color");
  } finally {
    sqlite.pragma("ignore_check_constraints = OFF");
  }
  const ingredient = paint("Ingredient", "#ff0000");
  inventory(ingredient);
  substitute(valid, [ingredient]);
  const second = paint("Second color", "#123456");
  const id = scheme("Mixed", [valid, missing, second, broken, valid]);
  scheme("Empty", []);
  scheme("Invalid", [missing, broken]);
  const result = readSchemeColorIndex({ first: 100 });
  assert.equal(result.nodes.length, 3);
  assert.deepEqual(
    result.nodes.map((row) => row.paint.id),
    [valid, second, valid],
  );
  assert.equal(result.nodes[0].schemeId, id);
  assert.equal(result.nodes[0].schemeName, "Mixed");
  assert.deepEqual(result.nodes[0].paint, {
    id: valid,
    name: "Valid",
    brand: "Fixture",
    hex: "#aabbcc",
    owned: false,
    available: true,
  });
  assert.equal(result.pageInfo.hasNextPage, false);
});

void test("scheme index bounds memberships even within one large scheme and reuses one generation projection", (context) => {
  const ids = Array.from({ length: 205 }, (_, i) => paint(`Paint ${i}`));
  const large = scheme("Large", ids);
  for (let i = 0; i < 40; i++) scheme(`Small ${i}`, [ids[0]]);
  const queries: string[] = [];
  const prepare = sqlite.prepare.bind(sqlite);
  context.mock.method(sqlite, "prepare", (sql: string) => {
    queries.push(sql);
    return prepare(sql);
  });
  const first = readSchemeColorIndex({ first: 100 });
  const second = readSchemeColorIndex({ first: 100, after: first.pageInfo.endCursor });
  const third = readSchemeColorIndex({ first: 100, after: second.pageInfo.endCursor });
  assert.deepEqual([first.nodes.length, second.nodes.length, third.nodes.length], [100, 100, 45]);
  assert.ok(first.nodes.every((row) => row.schemeId === large));
  const all = [...first.nodes, ...second.nodes, ...third.nodes];
  assert.equal(new Set(all.map((row) => `${row.schemeId}/${row.paint.id}`)).size, 245);
  assert.equal(third.pageInfo.hasNextPage, false);
  assert.equal(
    queries.filter((sql) => sql.includes("FROM color_schemes s JOIN color_scheme_paints")).length,
    1,
  );
  assert.equal(queries.filter((sql) => sql.includes("FROM paint_catalog p")).length, 1);
  assert.deepEqual(readSchemeColorIndex({ first: 100, after: third.pageInfo.endCursor }).nodes, []);
  assert.throws(() => readSchemeColorIndex({ first: 101 }), code("BAD_USER_INPUT"));
  assert.throws(() => readSchemeColorIndex({ first: 1, after: "bad" }), code("BAD_USER_INPUT"));
  assert.throws(
    () => readSchemeColorIndex({ first: 1, after: readColorIndex({ first: 1 }).pageInfo.endCursor }),
    code("BAD_USER_INPUT"),
  );
});

void test("scheme membership, name, color, physical stock and active mix edits invalidate old cursors", () => {
  const firstPaint = paint("First");
  const secondPaint = paint("Second");
  const id = scheme("Scheme", [firstPaint, secondPaint]);
  const edits = [
    () => inventory(firstPaint),
    () => substitute(secondPaint, [firstPaint]),
    () => sqlite.prepare("UPDATE color_schemes SET name='Changed' WHERE id=?").run(id),
    () => sqlite.prepare("UPDATE paint_catalog SET color_hex='#123456' WHERE id=?").run(firstPaint),
    () =>
      sqlite.prepare("DELETE FROM color_scheme_paints WHERE scheme_id=? AND paint_id=?").run(id, secondPaint),
  ];
  for (const edit of edits) {
    const before = readSchemeColorIndex({ first: 1 });
    edit();
    assert.throws(
      () => readSchemeColorIndex({ first: 1, after: before.pageInfo.endCursor }),
      code("STALE_CURSOR"),
    );
  }
  const after = readSchemeColorIndex({ first: 100 });
  assert.equal(after.nodes.length, 1);
  assert.equal(after.nodes[0].schemeName, "Changed");
  assert.equal(after.nodes[0].paint.hex, "#123456");
  assert.equal(after.nodes[0].paint.owned, true);
});

void test("scheme color projections made in rolled-back transactions do not poison committed cache", () => {
  const paintId = paint("Committed");
  const id = scheme("Committed scheme", [paintId]);
  const before = readSchemeColorIndex({ first: 100 });
  assert.throws(
    () =>
      sqlite.transaction(() => {
        inventory(paintId);
        sqlite.prepare("UPDATE color_schemes SET name='Rolled back' WHERE id=?").run(id);
        const inside = readSchemeColorIndex({ first: 100 });
        assert.equal(inside.nodes[0].schemeName, "Rolled back");
        assert.equal(inside.nodes[0].paint.owned, true);
        throw new Error("rollback fixture");
      })(),
    /rollback fixture/,
  );
  assert.deepEqual(readSchemeColorIndex({ first: 100 }), before);
});

void test("production typed scheme color query including Apollo typenames passes budget and resolves", async () => {
  const paintId = paint("Integration");
  const id = scheme("Integration scheme", [paintId]);
  const { SchemeColorToolIndexDocument } =
    await import("../../../packages/vault-ui/src/dom/graphql/generated/graphql.ts");
  const document = visit(SchemeColorToolIndexDocument, {
    SelectionSet(node) {
      return {
        ...node,
        selections: [
          ...node.selections,
          { kind: Kind.FIELD, name: { kind: Kind.NAME, value: "__typename" } },
        ],
      };
    },
  });
  const { graphqlResponse } = await import("./server.ts");
  const response = await graphqlResponse(
    new Request("http://localhost/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: print(document), variables: { after: null } }),
    }),
    false,
  );
  const body = (await response.json()) as {
    errors?: unknown[];
    data?: { schemeColorIndex: { nodes: { schemeId: string; schemeName: string; paint: { id: string } }[] } };
  };
  assert.equal(body.errors, undefined);
  assert.equal(body.data?.schemeColorIndex.nodes[0].schemeId, id);
  assert.equal(body.data?.schemeColorIndex.nodes[0].paint.id, paintId);
});
