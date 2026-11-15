import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-miniature-batch-"));
const previousData = process.env.DATA_DIR;
const previousDatabase = process.env.DATABASE_PATH;
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getSqlite } = await import("../db/index.ts");
const sqlite = getSqlite();
const timestamp = 1_800_000_000_000;
let serial = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`;
function miniature(title: string) {
  const id = nextId();
  sqlite
    .prepare(
      "INSERT INTO miniatures(id,title,status,painting_status,created_at,updated_at) VALUES(?,?,'OWNED','NOT_STARTED',?,?)",
    )
    .run(id, title, timestamp, timestamp);
  return id;
}
function paint(name: string) {
  const id = nextId();
  sqlite
    .prepare("INSERT INTO paint_catalog(id,brand,range,name,updated_at) VALUES(?,'Fixture','Base',?,?)")
    .run(id, name, timestamp);
  return id;
}
function requirement(miniatureId: string, paintId: string, step: string, notes: string, order: number) {
  sqlite
    .prepare(
      "INSERT INTO miniature_required_paints(id,miniature_id,paint_id,step,notes,sort_order,updated_at) VALUES(?,?,?,?,?,?,?)",
    )
    .run(nextId(), miniatureId, paintId, step, notes, order, timestamp);
}
function scheme(paints: string[], name: string) {
  const id = nextId();
  sqlite
    .prepare("INSERT INTO color_schemes(id,name,created_at,updated_at) VALUES(?,?,?,?)")
    .run(id, name, timestamp, timestamp);
  paints.forEach((paintId, order) =>
    sqlite
      .prepare("INSERT INTO color_scheme_paints(scheme_id,paint_id,sort_order,updated_at) VALUES(?,?,?,?)")
      .run(id, paintId, order, timestamp),
  );
  return id;
}
function link(miniatureId: string, schemeId: string, order: number) {
  sqlite
    .prepare(
      "INSERT INTO miniature_color_schemes(miniature_id,scheme_id,sort_order,updated_at) VALUES(?,?,?,?)",
    )
    .run(miniatureId, schemeId, order, timestamp);
}
after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
  if (previousData === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousData;
  if (previousDatabase === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = previousDatabase;
});

void test("generated miniature loader batches HTTP pages for large attached recipes at one revision", async () => {
  const { createVaultGraphQLClient } = await import("../../../packages/vault-ui/src/dom/graphql/client.ts");
  const { readMiniatureDetail } =
    await import("../../../packages/vault-ui/src/dom/graphql/miniature-detail-loader.ts");
  const { graphqlResponse } = await import("./server.ts");
  const id = miniature("HTTP batched schemes"),
    p = paint("Repeated paint");
  for (let i = 0; i < 43; i++)
    requirement(id, paint(`Manual paint ${i}`), "BASECOAT", `Complete recipe note ${i}`, i);
  const schemes: string[] = [];
  for (let i = 0; i < 45; i++) {
    const sid = scheme(
      Array.from({ length: i === 0 ? 45 : 1 }, () => p),
      `Scheme ${i}`,
    );
    schemes.push(sid);
    link(id, sid, i);
  }
  sqlite
    .prepare(
      "INSERT INTO color_scheme_dividers(id,scheme_id,label,tone,sort_order,updated_at) VALUES(?,?,?,'SECTION',46,?)",
    )
    .run(nextId(), schemes[0], "Full divider label", timestamp);
  sqlite
    .prepare(
      "INSERT INTO color_scheme_images(id,scheme_id,image_url,thumbnail_url,sort_order,updated_at) VALUES(?,?,?,?,47,?)",
    )
    .run(nextId(), schemes[0], "/original.webp", "/thumb.webp", timestamp);
  let calls = 0;
  const transport = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { operationName: string };
      assert.equal(body.operationName, "ProjectMiniatureDetails");
      calls++;
      return graphqlResponse(new Request("http://127.0.0.1/api/graphql", init), false);
    },
  });
  try {
    const result = await readMiniatureDetail(transport.client, id);
    assert.equal(calls, 3, "bounded aggregate pages replace 45 serial scheme reads");
    assert.equal(result.recipe.nodes.length, 43);
    assert.deepEqual(
      result.recipe.nodes.map((row) => row.notes),
      Array.from({ length: 43 }, (_, i) => `Complete recipe note ${i}`),
    );
    assert.deepEqual(
      result.attachedSchemes.map((row) => row.scheme?.id),
      schemes,
    );
    assert.equal(result.attachedSchemes[0].entries.nodes.length, 47);
    assert.equal(result.attachedSchemes[0].entries.nodes[45].label, "Full divider label");
    assert.equal(result.attachedSchemes[0].entries.nodes[46].imageUrl, "/original.webp");
    assert.equal(result.attachedSchemes[0].entries.nodes[46].thumbnailUrl, "/thumb.webp");
    assert.equal(result.attachedSchemes[44].entries.nodes[0].paint?.id, p);
    assert.equal(
      result.attachedSchemes.every(
        (row) => row.revision.seq === result.revision.seq && !row.entries.pageInfo.hasNextPage,
      ),
      true,
    );
    assert.deepEqual(transport.client.cache.extract(), {}, "HTTP pages stay uncommitted until accepted");
  } finally {
    transport.dispose();
  }
});
