import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";

import { GraphQLError } from "graphql";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-templates-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
process.env.HOST = "127.0.0.1";
process.env.NODE_ENV = "test";
const { routeApi } = await import("../server/api-router.ts");
const { getSqlite } = await import("../db/index.ts");
const {
  readTemplates,
  readTemplateRecipe,
  templatePaints,
  templateSchemes,
  clearTemplateProjectionCache,
  templateProjectionDiagnostics,
} = await import("./templates.ts");
const { currentChangeSeq } = await import("../db/change-log.ts");
const { saveImage, imageExists } = await import("../lib/image-store.ts");
const sqlite = getSqlite();
const token = "c".repeat(64);
const code = (expected: string) => (error: unknown) =>
  error instanceof GraphQLError && error.extensions.code === expected;
function insertTemplate(name: string, user = false, categories = ["Infantry"]) {
  const id = (user ? "user:" : "") + randomUUID();
  sqlite
    .prepare(
      "INSERT INTO miniature_templates(id,name,manufacturer,faction,categories,created_at) VALUES(?,?,'Maker','Order',?,1)",
    )
    .run(id, name, JSON.stringify(categories));
  return id;
}
function insertPaint() {
  const id = randomUUID();
  sqlite
    .prepare(
      "INSERT INTO paint_catalog(id,brand,range,name,color_hex) VALUES(?,'Brand','Base','Crimson','#123456')",
    )
    .run(id);
  return id;
}
async function rest(endpoint: string, method: string, body: unknown) {
  return routeApi(
    new Request(`http://127.0.0.1:3000/api${endpoint}`, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
  );
}
async function gql(query: string, variables: Record<string, unknown> = {}) {
  const response = await rest("/graphql", "POST", { query, variables });
  assert.equal(response.status, 200);
  return (await response.json()) as {
    data?: Record<
      string,
      { templateId: string; revision: { epoch: string; seq: string }; invalidatedFamilies: string[] }
    >;
    errors?: { message: string; extensions: { code: string } }[];
  };
}
const selection = "templateId revision{epoch seq} invalidatedFamilies clientMutationId";
beforeEach(() => {
  sqlite.exec(
    "DELETE FROM miniatures; DELETE FROM miniature_templates; DELETE FROM color_schemes; DELETE FROM paint_catalog; DELETE FROM catalog_sources; DELETE FROM vault_sessions; DELETE FROM vault_account;",
  );
  clearTemplateProjectionCache();
  sqlite
    .prepare(
      "INSERT INTO vault_account(id,username,password_hash,require_sign_in) VALUES(1,'owner','fake',1)",
    )
    .run();
  sqlite
    .prepare("INSERT INTO vault_sessions(token_hash,expires_at) VALUES(?,?)")
    .run(createHash("sha256").update(token).digest("hex"), Date.now() + 600_000);
});
after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

void test("summary projection pages global metadata/facets without recipe materialization and supports selected ID", () => {
  const plugin = randomUUID();
  sqlite
    .prepare(
      "INSERT INTO catalog_sources(id,repository,url,branch,name,version,dependencies,updated_at) VALUES(?,'fixture/source','https://github.com/fixture/source','main','Fixture source','1.0.0','[]',1)",
    )
    .run(plugin);
  const id = insertTemplate("Distant Dragon", false, ["Dragons"]);
  sqlite
    .prepare("INSERT INTO catalog_source_items(source_id,kind,item_id) VALUES(?,'template',?)")
    .run(plugin, id);
  for (let i = 0; i < 110; i++) insertTemplate(`Knight ${String(i).padStart(3, "0")}`);
  const user = insertTemplate("My setup", true);
  const paint = insertPaint();
  sqlite
    .prepare(
      "INSERT INTO miniature_template_paints(template_id,paint_id,step,notes,sort_order) VALUES(?,?,'BASECOAT','Must stay deferred',0)",
    )
    .run(id, paint);
  const first = readTemplates({ first: 48 });
  assert.equal(first.templates.totalCount, 112);
  assert.equal(first.templates.nodes.length, 48);
  assert.equal(first.categoryCounts.find((row) => row.key === "Dragons")?.count, 1);
  assert.equal(first.sourceCounts.find((row) => row.key === plugin)?.count, 1);
  assert.equal("paints" in first.templates.nodes[0], false);
  assert.equal(first.templates.nodes.find((row) => row.id === id)?.paintCount, 1);
  const second = readTemplates({ first: 48, after: first.templates.pageInfo.endCursor });
  assert.equal(second.templates.nodes.length, 48);
  assert.equal(templateProjectionDiagnostics().builds, 1);
  const searched = readTemplates({ first: 48, search: "Distant Dragon", sourceId: plugin });
  assert.deepEqual(
    searched.templates.nodes.map((row) => row.id),
    [id],
  );
  assert.equal(searched.templates.nodes[0].sourceName, "Fixture source");
  assert.deepEqual(
    readTemplates({ first: 48, id: user }).templates.nodes.map((row) => row.categories),
    [["My templates"]],
  );
  assert.throws(
    () => readTemplates({ first: 1, after: first.templates.pageInfo.endCursor, category: "Dragons" }),
    code("BAD_USER_INPUT"),
  );
  insertTemplate("New write");
  assert.throws(
    () => readTemplates({ first: 1, after: first.templates.pageInfo.endCursor }),
    code("STALE_CURSOR"),
  );
});

void test("selected recipe pages all rows with minimal labels and repeated paint steps", () => {
  const id = insertTemplate("Large selected template", true);
  const insert = sqlite.prepare(
    "INSERT INTO miniature_template_paints(template_id,paint_id,step,notes,sort_order) VALUES(?,?,'BASECOAT',?,?)",
  );
  for (let i = 0; i < 207; i++) insert.run(id, insertPaint(), `Notes ${i}`, i);
  const repeated = insertPaint();
  sqlite
    .prepare(
      "INSERT INTO miniature_template_paints(template_id,paint_id,step,notes,sort_order) VALUES(?,?,'BASECOAT','Base',207),(?,?,'HIGHLIGHT','Highlight',208)",
    )
    .run(id, repeated, id, repeated);
  const view = readTemplateRecipe(id);
  const nodes = [...templatePaints(view, { first: 100 }).nodes];
  let cursor = templatePaints(view, { first: 100 }).pageInfo.endCursor;
  while (cursor) {
    const page = templatePaints(view, { first: 100, after: cursor });
    nodes.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  }
  assert.equal(nodes.length, 209);
  assert.deepEqual(
    nodes.filter((row) => row.paintId === repeated).map((row) => [row.step, row.notes]),
    [
      ["BASECOAT", "Base"],
      ["HIGHLIGHT", "Highlight"],
    ],
  );
  assert.equal(nodes[0].paintName, "Crimson");
  assert.equal(nodes[0].paintBrand, "Brand");
  assert.deepEqual(templateSchemes(view, { first: 100 }).nodes, []);
  assert.throws(() => readTemplateRecipe(randomUUID()), code("NOT_FOUND"));
  insertTemplate("Invalidate revision");
  assert.throws(() => templatePaints(view, { first: 100 }), code("STALE_CURSOR"));
});

void test("REST and GraphQL share validated atomic template commands with source copy, revision and image lifecycle", async () => {
  const paint = insertPaint(),
    scheme = randomUUID();
  sqlite.prepare("INSERT INTO color_schemes(id,name,created_at) VALUES(?,'Red armour',1)").run(scheme);
  const original = await rest("/miniature-templates", "POST", {
    name: "REST reusable",
    schemeIds: [scheme],
    paints: [
      { paintId: paint, step: "BASECOAT", notes: "Base", sortOrder: 0 },
      { paintId: paint, step: "HIGHLIGHT", notes: "Light", sortOrder: 1 },
    ],
  });
  assert.equal(original.status, 201);
  const existing = (await original.json()) as { id: string };
  const changed = await gql(
    `mutation($id:ID!,$input:TemplateInput!){updateTemplate(id:$id,input:$input){${selection}}}`,
    { id: existing.id, input: { name: "Edited via GraphQL" } },
  );
  assert.equal(changed.errors, undefined, JSON.stringify(changed));
  assert.equal(Number(changed.data?.updateTemplate.revision.seq), currentChangeSeq(sqlite));
  assert.ok(changed.data?.updateTemplate.invalidatedFamilies.includes("TEMPLATES"));
  assert.equal(templatePaints(readTemplateRecipe(existing.id), { first: 100 }).nodes.length, 2);
  const before = currentChangeSeq(sqlite);
  const invalid = await gql(
    `mutation($id:ID!,$input:TemplateInput!){updateTemplate(id:$id,input:$input){${selection}}}`,
    { id: existing.id, input: { name: "Do not commit", schemeIds: [randomUUID()] } },
  );
  assert.equal(invalid.errors?.[0].extensions.code, "BAD_USER_INPUT");
  assert.equal(currentChangeSeq(sqlite), before);
  assert.equal(
    (sqlite.prepare("SELECT name FROM miniature_templates WHERE id=?").get(existing.id) as { name: string })
      .name,
    "Edited via GraphQL",
  );
  const sourceId = insertTemplate("Catalog source");
  const denied = await gql(`mutation($id:ID!){deleteTemplate(id:$id){${selection}}}`, { id: sourceId });
  assert.equal(denied.errors?.[0].extensions.code, "FORBIDDEN");
  assert.equal((await rest("/miniature-templates", "DELETE", { id: sourceId })).status, 403);
  const image = await saveImage(new File([new Uint8Array([1, 2, 3])], "source.png", { type: "image/png" }));
  const model = randomUUID();
  sqlite
    .prepare(
      "INSERT INTO miniatures(id,title,status,manufacturer,faction,image_key,created_at) VALUES(?,'Copy me','OWNED','Maker','Order',?,1)",
    )
    .run(model, image);
  sqlite
    .prepare(
      "INSERT INTO miniature_required_paints(id,miniature_id,paint_id,step,notes,sort_order) VALUES(?,?,?,'LAYER','Copied model notes',0)",
    )
    .run(randomUUID(), model, paint);
  const copied = await gql(
    `mutation($input:TemplateInput!){createTemplate(input:$input,clientMutationId:"copy"){${selection}}}`,
    { input: { sourceMiniatureId: model } },
  );
  assert.equal(copied.errors, undefined, JSON.stringify(copied));
  const id = copied.data!.createTemplate.templateId;
  const key = (
    sqlite.prepare("SELECT image_key FROM miniature_templates WHERE id=?").get(id) as { image_key: string }
  ).image_key;
  assert.ok(await imageExists(key));
  assert.equal(templatePaints(readTemplateRecipe(id), { first: 100 }).nodes[0].notes, "Copied model notes");
  const removed = await gql(`mutation($id:ID!){deleteTemplate(id:$id){${selection}}}`, { id });
  assert.equal(removed.errors, undefined, JSON.stringify(removed));
  assert.equal(
    sqlite.prepare("SELECT count(*) AS n FROM miniature_template_paints WHERE template_id=?").get(id) &&
      (
        sqlite.prepare("SELECT count(*) AS n FROM miniature_template_paints WHERE template_id=?").get(id) as {
          n: number;
        }
      ).n,
    0,
  );
  // Content-addressed source bytes remain referenced by the source model.
  assert.ok(await imageExists(image));
});

void test("template summaries expose bounded local thumbnails without replacing editor originals", () => {
  const id = insertTemplate("Thumbnail template", true);
  const key = `${randomUUID()}.webp`;
  sqlite.prepare("UPDATE miniature_templates SET image_key=? WHERE id=?").run(key, id);
  let row = readTemplates({ first: 48, id }).templates.nodes[0];
  const original = `/api/miniature-templates/${encodeURIComponent(id)}/image?v=${key}`;
  assert.equal(row.imageUrl, original);
  assert.equal(row.thumbnailUrl, `${original}&w=320`);
  for (const image of ["/api/catalog-source-images/source.webp", "https://external.test/source.jpg"]) {
    sqlite.prepare("UPDATE miniature_templates SET image_key=NULL,image_url=? WHERE id=?").run(image, id);
    row = readTemplates({ first: 48, id }).templates.nodes[0];
    assert.equal(row.imageUrl, image);
    assert.equal(row.thumbnailUrl, image.startsWith("/api/") ? `${image}?w=320` : image);
  }
});
