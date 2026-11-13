import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-miniature-commands-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
process.env.HOST = "127.0.0.1";
process.env.NODE_ENV = "test";
const { routeApi } = await import("../server/api-router.ts");
const { getSqlite } = await import("../db/index.ts");
const { changeLogEpoch, currentChangeSeq } = await import("../db/change-log.ts");
const { invalidationSince } = await import("./changes.ts");
const { saveImage, imageExists } = await import("../lib/image-store.ts");
const sqlite = getSqlite();
const token = "b".repeat(64);
const base = "http://127.0.0.1:3000/api";
async function rest(endpoint: string, method: string, body?: unknown) {
  return routeApi(
    new Request(base + endpoint, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
const selection = "miniatureId clientMutationId revision{epoch seq} invalidatedFamilies";
async function gql(query: string, variables: Record<string, unknown> = {}) {
  const response = await rest("/graphql", "POST", { query, variables });
  return (await response.json()) as {
    data?: Record<
      string,
      {
        miniatureId: string;
        clientMutationId?: string;
        revision: { epoch: string; seq: string };
        invalidatedFamilies: string[];
      }
    >;
    errors?: { message: string; extensions: { code: string } }[];
  };
}
const create = `mutation Create($input:MiniatureInput!){createMiniature(input:$input,clientMutationId:"fixture"){${selection}}}`;
const edit = `mutation Edit($id:ID!,$input:MiniatureInput!){updateMiniature(id:$id,input:$input){${selection}}}`;
const recipe = `mutation Recipe($id:ID!,$entries:[MiniatureRecipeEntryInput!]!,$steps:[String!],$schemes:[ID!]){setMiniatureRecipe(id:$id,entries:$entries,steps:$steps,schemeIds:$schemes){${selection}}}`;
const schemes = `mutation Schemes($id:ID!,$ids:[ID!]!){setMiniatureSchemes(id:$id,schemeIds:$ids){${selection}}}`;
const remove = `mutation Delete($id:ID!){deleteMiniature(id:$id){${selection}}}`;
const paint = "user:00000000-0000-4000-8000-000000000001";
const scheme = "user:00000000-0000-4000-8000-000000000002";
const template = "user:00000000-0000-4000-8000-000000000003";
function row(id: string) {
  return sqlite.prepare("SELECT * FROM miniatures WHERE id=?").get(id) as Record<string, unknown>;
}
function requirements(id: string) {
  return sqlite
    .prepare("SELECT * FROM miniature_required_paints WHERE miniature_id=? ORDER BY sort_order")
    .all(id) as Record<string, unknown>[];
}
function cursor() {
  return { epoch: changeLogEpoch, since: currentChangeSeq(sqlite) };
}
function envelope(result: Awaited<ReturnType<typeof gql>>, name: string) {
  assert.equal(result.errors, undefined, JSON.stringify(result));
  const payload = result.data?.[name];
  assert.ok(payload);
  assert.equal(payload.revision.epoch, changeLogEpoch);
  assert.equal(Number(payload.revision.seq), currentChangeSeq(sqlite));
  return payload;
}

void test("miniature REST and GraphQL share atomic commands, metadata, image lifecycle and trigger invalidation", async (t) => {
  try {
    sqlite
      .prepare(
        "INSERT INTO vault_account(id,username,password_hash,require_sign_in) VALUES(1,'owner','fake',1)",
      )
      .run();
    sqlite
      .prepare("INSERT INTO vault_sessions(token_hash,expires_at) VALUES(?,?)")
      .run(createHash("sha256").update(token).digest("hex"), Date.now() + 600_000);
    sqlite
      .prepare(
        "INSERT INTO paint_catalog(id,brand,range,name,color_hex) VALUES(?,'Test','Base','Blue','#123456')",
      )
      .run(paint);
    sqlite.prepare("INSERT INTO color_schemes(id,name,created_at) VALUES(?,'Scheme',1)").run(scheme);
    const sourceImage = await saveImage(
      new File([new Uint8Array([1, 2, 3])], "template.png", { type: "image/png" }),
    );
    sqlite
      .prepare(
        "INSERT INTO miniature_templates(id,name,manufacturer,faction,image_key,image_url,created_at) VALUES(?,'Template','Maker','Faction',?,'https://example.invalid/photo.png',1)",
      )
      .run(template, sourceImage);
    sqlite
      .prepare("INSERT INTO miniature_template_schemes(template_id,scheme_id,sort_order) VALUES(?,?,0)")
      .run(template, scheme);
    sqlite
      .prepare(
        "INSERT INTO miniature_template_paints(template_id,paint_id,step,notes,sort_order) VALUES(?,?,'OTHER','template notes',0)",
      )
      .run(template, paint);

    let id = "";
    await t.test("create copies a template recipe/photo and reports one committed revision", async () => {
      const before = cursor();
      const payload = envelope(
        await gql(create, { input: { templateId: template, status: "WISHLIST" } }),
        "createMiniature",
      );
      id = payload.miniatureId;
      assert.equal(payload.clientMutationId, "fixture");
      const saved = row(id);
      assert.equal(saved.title, "Template");
      assert.equal(saved.manufacturer, "Maker");
      assert.equal(saved.faction, "Faction");
      assert.equal(saved.status, "WISHLIST");
      assert.notEqual(saved.image_key, sourceImage);
      assert.equal(await imageExists(saved.image_key as string), true);
      assert.equal(saved.source_image_url, "https://example.invalid/photo.png");
      assert.equal(requirements(id)[0].notes, "template notes");
      assert.equal(
        sqlite.prepare("SELECT count(*) FROM miniature_color_schemes WHERE miniature_id=?").pluck().get(id),
        1,
      );
      assert.deepEqual(payload.invalidatedFamilies, invalidationSince(before).families);
      for (const family of ["MINIATURES", "HOME", "WISHLIST", "PAINT", "SCHEMES"] as const)
        assert.ok(payload.invalidatedFamilies.includes(family));
    });

    await t.test(
      "failed image-backed creation cleans prepared files; deletion preserves template originals",
      async () => {
        const images = () => readdirSync(path.join(directory, "images")).sort();
        const beforeFiles = images();
        const before = cursor();
        const failed = await gql(create, { input: { templateId: template, title: "x".repeat(1000) } });
        assert.equal(failed.errors?.[0].extensions.code, "BAD_USER_INPUT");
        assert.deepEqual(images(), beforeFiles);
        assert.equal(currentChangeSeq(sqlite), before.since);
        const missing = await gql(create, { input: { templateId: "unavailable" } });
        assert.equal(missing.errors?.[0].extensions.code, "BAD_USER_INPUT");
        assert.equal((await rest("/miniatures", "POST", { templateId: "unavailable" })).status, 400);
        const payload = envelope(await gql(create, { input: { templateId: template } }), "createMiniature");
        const copy = row(payload.miniatureId).image_key as string;
        envelope(await gql(remove, { id: payload.miniatureId }), "deleteMiniature");
        assert.equal(await imageExists(copy), false);
        assert.equal(await imageExists(sourceImage), true);
        assert.deepEqual(images(), beforeFiles);
      },
    );

    await t.test("REST and GraphQL metadata edits produce the same persisted defaults", async () => {
      const body = {
        title: "  Saved title  ",
        status: "OWNED",
        paintingStatus: "COMPLETE",
        notes: "  Notes  ",
        manufacturer: " X ",
        faction: " Y ",
        scale: " 28 mm ",
      };
      assert.equal((await rest(`/miniatures/${id}`, "PUT", body)).status, 200);
      const fromRest = row(id);
      envelope(await gql(edit, { id, input: body }), "updateMiniature");
      const fromGraphql = row(id);
      delete fromRest.updated_at;
      delete fromGraphql.updated_at;
      assert.deepEqual(fromGraphql, fromRest);
      assert.equal(fromGraphql.painting_status, "COMPLETE");
      assert.equal(fromGraphql.notes, "Notes");
      const before = cursor();
      const invalid = await gql(edit, { id, input: { title: " " } });
      assert.equal(invalid.errors?.[0].extensions.code, "BAD_USER_INPUT");
      assert.equal(currentChangeSeq(sqlite), before.since);
      assert.equal((await rest(`/miniatures/${id}`, "PUT", { title: " " })).status, 400);
      assert.equal(
        (await gql(edit, { id, input: { title: "x".repeat(1000) } })).errors?.[0].extensions.code,
        "BAD_USER_INPUT",
      );
    });

    await t.test("whole recipe, explicit empty steps and scheme attach/detach are atomic", async () => {
      const entry = {
        id: crypto.randomUUID(),
        paintId: paint,
        step: "OTHER",
        notes: " new note ",
        sortOrder: 4,
      };
      const payload = envelope(
        await gql(recipe, {
          id,
          entries: [entry, { ...entry, id: crypto.randomUUID() }],
          steps: ["OTHER"],
          schemes: [],
        }),
        "setMiniatureRecipe",
      );
      assert.equal(requirements(id).length, 1);
      assert.equal(requirements(id)[0].id, entry.id);
      assert.equal(requirements(id)[0].notes, "new note");
      assert.equal(
        sqlite.prepare("SELECT count(*) FROM miniature_recipe_steps WHERE miniature_id=?").pluck().get(id),
        1,
      );
      assert.equal(
        sqlite.prepare("SELECT count(*) FROM miniature_color_schemes WHERE miniature_id=?").pluck().get(id),
        0,
      );
      assert.ok(payload.invalidatedFamilies.includes("SCHEMES"));
      const before = cursor();
      const saved = requirements(id);
      const failed = await gql(recipe, { id, entries: [], steps: [], schemes: ["missing"] });
      assert.equal(failed.errors?.[0].extensions.code, "NOT_FOUND");
      assert.deepEqual(requirements(id), saved);
      assert.equal(
        sqlite.prepare("SELECT count(*) FROM miniature_recipe_steps WHERE miniature_id=?").pluck().get(id),
        1,
      );
      assert.equal(currentChangeSeq(sqlite), before.since);
      envelope(await gql(schemes, { id, ids: [scheme] }), "setMiniatureSchemes");
      assert.equal(
        sqlite.prepare("SELECT count(*) FROM miniature_color_schemes WHERE miniature_id=?").pluck().get(id),
        1,
      );
      assert.equal((await rest("/miniature-schemes", "PUT", { miniatureId: id, schemeIds: [] })).status, 200);
      assert.equal((await rest("/requirements", "PUT", { miniatureId: id, entries: [entry] })).status, 200);
      assert.equal((await rest("/recipe-steps", "PUT", { miniatureId: id, steps: [] })).status, 200);
      assert.equal(
        sqlite.prepare("SELECT count(*) FROM miniature_recipe_steps WHERE miniature_id=?").pluck().get(id),
        0,
      );
      const invalidPaint = await gql(recipe, { id, entries: [{ paintId: "missing" }] });
      assert.equal(invalidPaint.errors?.[0].extensions.code, "BAD_USER_INPUT");
      assert.equal(requirements(id)[0].id, entry.id);
    });

    await t.test("incremental REST recipe commands retain validation and duplicates", async () => {
      assert.equal(
        (await rest("/requirements", "POST", { miniatureId: id, paintId: paint, step: "OTHER" })).status,
        409,
      );
      assert.equal(
        (await rest("/requirements", "POST", { miniatureId: id, paintId: paint, step: "NOT_A_STEP" })).status,
        400,
      );
      const entryId = requirements(id)[0].id;
      assert.equal((await rest("/requirements", "PATCH", { id: entryId, notes: "changed" })).status, 200);
      assert.equal(requirements(id)[0].notes, "changed");
      assert.equal((await rest("/requirements", "DELETE", { id: entryId })).status, 200);
      assert.equal((await rest("/requirements", "DELETE", { id: entryId })).status, 404);
    });

    await t.test("REST image metadata removal and deletion cascade invalidate projections", async () => {
      const key = row(id).image_key as string;
      assert.equal((await rest(`/miniatures/${id}/image`, "DELETE")).status, 200);
      assert.equal(row(id).image_key, null);
      assert.equal(row(id).source_image_url, null);
      assert.equal(await imageExists(key), false);
      assert.equal(await imageExists(sourceImage), true);
      envelope(
        await gql(recipe, { id, entries: [{ paintId: paint }], steps: ["OTHER"], schemes: [scheme] }),
        "setMiniatureRecipe",
      );
      const before = cursor();
      const payload = envelope(await gql(remove, { id }), "deleteMiniature");
      assert.equal(row(id), undefined);
      for (const table of ["miniature_required_paints", "miniature_recipe_steps", "miniature_color_schemes"])
        assert.equal(sqlite.prepare(`SELECT count(*) FROM ${table} WHERE miniature_id=?`).pluck().get(id), 0);
      assert.deepEqual(payload.invalidatedFamilies, invalidationSince(before).families);
      for (const family of ["MINIATURES", "HOME", "WISHLIST", "PAINT", "SCHEMES"] as const)
        assert.ok(payload.invalidatedFamilies.includes(family));
      envelope(await gql(remove, { id }), "deleteMiniature"); // existing REST no-op parity
      const response = await rest("/miniatures", "POST", {
        title: "REST new",
        templateId: template,
        includeTemplateImage: false,
      });
      assert.equal(response.status, 201);
      const saved = (await response.json()) as {
        id: string;
        imageKey: string | null;
        sourceImageUrl: string | null;
      };
      assert.equal(saved.imageKey, null);
      assert.equal(saved.sourceImageUrl, null);
      assert.equal((await rest(`/miniatures/${saved.id}`, "DELETE")).status, 200);
    });
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
