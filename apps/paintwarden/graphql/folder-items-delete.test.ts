import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";

import { graphql, GraphQLError } from "graphql";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-folder-items-delete-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
process.env.NODE_ENV = "test";
const { getSqlite } = await import("../db/index.ts");
const { changedKeysSince } = await import("../db/change-log.ts");
const { schema } = await import("./server.ts");
const { checkOperation } = await import("./budgets.ts");
const { readRevision } = await import("./library.ts");
const { invalidationSince } = await import("./changes.ts");
const { saveImage, imageExists, holdImages, releaseImages, deleteImages } =
  await import("../lib/image-store.ts");
const sqlite = getSqlite();
const mutation = `mutation Delete($kind:FolderKind!,$ids:[ID!]!){
  deleteFolderItems(kind:$kind,ids:$ids){revision{epoch seq} invalidatedFamilies}
}`;
type Kind = "MINIATURE" | "TEMPLATE";
const tableFor = (kind: Kind) => (kind === "MINIATURE" ? "miniatures" : "miniature_templates");
async function remove(kind: Kind, ids: string[]) {
  checkOperation(schema, { query: mutation, variables: { kind, ids } }, false);
  return graphql({ schema, source: mutation, variableValues: { kind, ids } });
}
function item(kind: Kind, key: string | null = null) {
  const id = kind === "MINIATURE" ? randomUUID() : `user:${randomUUID()}`;
  const sql =
    kind === "MINIATURE"
      ? "INSERT INTO miniatures(id,title,status,image_key,created_at) VALUES(?,'Knight','OWNED',?,1)"
      : "INSERT INTO miniature_templates(id,name,image_key,created_at) VALUES(?,'Knight',?,1)";
  sqlite.prepare(sql).run(id, key);
  return id;
}
async function image(label: string) {
  return saveImage(new File([label], `${label}.png`, { type: "image/png" }));
}
beforeEach(() => {
  sqlite.exec(
    "DELETE FROM miniatures; DELETE FROM miniature_templates; DELETE FROM folders; DELETE FROM color_schemes; DELETE FROM catalog_sources; DELETE FROM paint_catalog;",
  );
});
after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

for (const kind of ["MINIATURE", "TEMPLATE"] as const) {
  void test(`${kind}: atomic deduplicated delete cascades links, preserves unrelated rows, and invalidates SSE`, async () => {
    const key = await image(`${kind}-unique`);
    const a = item(kind, key),
      b = item(kind),
      survivor = item(kind);
    const paint = `user:${randomUUID()}`,
      scheme = `user:${randomUUID()}`;
    sqlite.prepare("INSERT INTO paint_catalog(id,brand,range,name) VALUES(?,'B','R','Paint')").run(paint);
    sqlite.prepare("INSERT INTO color_schemes(id,name,created_at) VALUES(?,'Scheme',1)").run(scheme);
    if (kind === "MINIATURE") {
      sqlite.prepare("INSERT INTO miniature_recipe_steps(miniature_id,step) VALUES(?,'BASECOAT')").run(a);
      sqlite
        .prepare("INSERT INTO miniature_required_paints(id,miniature_id,paint_id,sort_order) VALUES(?,?,?,0)")
        .run(randomUUID(), a, paint);
      sqlite
        .prepare("INSERT INTO miniature_color_schemes(miniature_id,scheme_id) VALUES(?,?)")
        .run(a, scheme);
    } else {
      sqlite
        .prepare("INSERT INTO miniature_template_paints(template_id,paint_id,sort_order) VALUES(?,?,0)")
        .run(a, paint);
      sqlite
        .prepare("INSERT INTO miniature_template_schemes(template_id,scheme_id) VALUES(?,?)")
        .run(a, scheme);
    }
    const before = readRevision();
    const result = await remove(kind, [a, b, a]);
    assert.equal(result.errors, undefined);
    assert.deepEqual(
      sqlite
        .prepare(`SELECT id FROM ${tableFor(kind)}`)
        .pluck()
        .all(),
      [survivor],
    );
    for (const table of kind === "MINIATURE"
      ? ["miniature_recipe_steps", "miniature_required_paints", "miniature_color_schemes"]
      : ["miniature_template_paints", "miniature_template_schemes"])
      assert.equal(sqlite.prepare(`SELECT count(*) FROM ${table}`).pluck().get(), 0);
    assert.equal(sqlite.prepare("SELECT count(*) FROM paint_catalog").pluck().get(), 1);
    assert.equal(sqlite.prepare("SELECT count(*) FROM color_schemes").pluck().get(), 1);
    assert.equal(await imageExists(key), false);
    const changes = invalidationSince({ epoch: before.epoch, since: before.seq });
    assert.ok(changes.seq > before.seq);
    assert.ok(changes.families.includes(kind === "MINIATURE" ? "MINIATURES" : "TEMPLATES"));
    assert.deepEqual(JSON.parse(JSON.stringify(result.data?.deleteFolderItems)), {
      revision: { epoch: changes.epoch, seq: String(changes.seq) },
      invalidatedFamilies: changes.families,
    });
    if (kind === "MINIATURE") {
      const keys = changedKeysSince(sqlite, before.epoch, before.seq);
      assert.equal(keys.reload, false);
      assert.equal(keys.keys.filter((k) => k.table === "miniatures").length, 2);
      assert.ok(keys.keys.some((k) => k.table === "recipeSteps"));
    }
    assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
  });

  void test(`${kind}: missing IDs and kind/folder mismatches reject the entire batch without cleanup`, async () => {
    const key = await image(`${kind}-invalid`),
      a = item(kind, key);
    const wrong = item(kind === "MINIATURE" ? "TEMPLATE" : "MINIATURE");
    const folder = randomUUID();
    sqlite
      .prepare("INSERT INTO folders(id,kind,name,created_at) VALUES(?,'miniature','Folder',1)")
      .run(folder);
    for (const [ids, code] of [
      [[a, randomUUID()], "NOT_FOUND"],
      [[a, wrong], "BAD_USER_INPUT"],
      [[a, folder], "BAD_USER_INPUT"],
      [[], "BAD_USER_INPUT"],
    ] as [string[], string][]) {
      const before = readRevision();
      const result = await remove(kind, ids);
      assert.equal(result.errors?.[0].extensions.code, code);
      assert.ok(sqlite.prepare(`SELECT id FROM ${tableFor(kind)} WHERE id=?`).get(a));
      assert.deepEqual(readRevision(), before);
      assert.equal(await imageExists(key), true);
    }
  });

  void test(`${kind}: late SQL failure rolls back earlier deletion, cascades, revision and files`, async () => {
    const key = await image(`${kind}-rollback`),
      a = item(kind, key),
      b = item(kind);
    const child = kind === "MINIATURE" ? "miniature_recipe_steps" : "miniature_template_paints";
    if (kind === "MINIATURE")
      sqlite.prepare("INSERT INTO miniature_recipe_steps(miniature_id,step) VALUES(?,'BASECOAT')").run(a);
    else {
      const paint = `user:${randomUUID()}`;
      sqlite.prepare("INSERT INTO paint_catalog(id,brand,range,name) VALUES(?,'B','R','Paint')").run(paint);
      sqlite
        .prepare("INSERT INTO miniature_template_paints(template_id,paint_id,sort_order) VALUES(?,?,0)")
        .run(a, paint);
    }
    sqlite.exec(`CREATE TEMP TRIGGER fail_batch_delete BEFORE DELETE ON ${tableFor(kind)}
      WHEN OLD.id='${b}' BEGIN SELECT RAISE(ABORT, 'injected delete failure'); END;`);
    const before = readRevision();
    try {
      const result = await remove(kind, [a, b]);
      assert.match(result.errors?.[0].message ?? "", /injected delete failure/);
      assert.equal(
        sqlite
          .prepare(`SELECT count(*) FROM ${tableFor(kind)}`)
          .pluck()
          .get(),
        2,
      );
      assert.equal(sqlite.prepare(`SELECT count(*) FROM ${child}`).pluck().get(), 1);
      assert.deepEqual(readRevision(), before);
      assert.equal(await imageExists(key), true);
    } finally {
      sqlite.exec("DROP TRIGGER fail_batch_delete");
    }
  });
}

void test("batch cleanup preserves images referenced by either entity kind, catalog assets, schemes and export holds", async () => {
  const keys = await Promise.all(["mini", "template", "asset", "scheme", "held"].map(image));
  const ids = keys.map((key) => item("MINIATURE", key));
  item("MINIATURE", keys[0]);
  item("TEMPLATE", keys[1]);
  const source = randomUUID(),
    scheme = `user:${randomUUID()}`;
  sqlite
    .prepare(
      "INSERT INTO catalog_sources(id,repository,url,branch,name,version,dependencies,updated_at) VALUES(?,'example/src','u','main','Source','1','[]',1)",
    )
    .run(source);
  sqlite
    .prepare("INSERT INTO catalog_source_assets(source_id,asset_path,image_key,sha256) VALUES(?,'a.png',?,?)")
    .run(source, keys[2], "a".repeat(64));
  sqlite.prepare("INSERT INTO color_schemes(id,name,created_at) VALUES(?,'Scheme',1)").run(scheme);
  sqlite
    .prepare(
      "INSERT INTO color_scheme_images(id,scheme_id,image_url,thumbnail_url) VALUES(?,?,'https://example.com/image',?)",
    )
    .run(randomUUID(), scheme, `/api/catalog-source-images/${keys[3]}`);
  holdImages([keys[4]]);
  try {
    assert.equal((await remove("MINIATURE", ids)).errors, undefined);
    for (const key of keys) assert.equal(await imageExists(key), true);
  } finally {
    await deleteImages(releaseImages([keys[4]]));
  }
  assert.equal(await imageExists(keys[4]), false);
});

void test("delete batch request budget rejects excessive counts and overlong IDs before execution", () => {
  for (const ids of [Array(1001).fill(randomUUID()), ["x".repeat(257)]])
    assert.throws(
      () => checkOperation(schema, { query: mutation, variables: { kind: "MINIATURE", ids } }, false),
      (error) => error instanceof GraphQLError && error.extensions.code === "QUERY_BUDGET",
    );
});
