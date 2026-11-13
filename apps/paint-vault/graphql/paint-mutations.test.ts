import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-paint-commands-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
process.env.HOST = "127.0.0.1";
process.env.NODE_ENV = "test";
const { routeApi } = await import("../server/api-router.ts");
const { getSqlite } = await import("../db/index.ts");
const { changeLogEpoch, currentChangeSeq } = await import("../db/change-log.ts");
const { invalidationSince } = await import("./changes.ts");
const sqlite = getSqlite();
const token = "c".repeat(64);
const base = "http://127.0.0.1:3000/api";
async function rest(endpoint: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return routeApi(
    new Request(base + endpoint, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
const selection = "revision{epoch seq} clientMutationId invalidatedFamilies";
const imports = `mutation Import($paints:[CustomPaintImportInput!]!){importCustomPaints(paints:$paints,clientMutationId:"fixture"){imported skipped ${selection}}}`;
const update = `mutation Update($id:ID!,$input:CustomPaintInput!){updateCustomPaint(id:$id,input:$input){paintId ${selection}}}`;
const removePaint = `mutation Delete($id:ID!){deleteCustomPaint(id:$id){paintId ${selection}}}`;
const create = `mutation Create($input:SubstitutionInput!){createSubstitution(input:$input){substitutionId ${selection}}}`;
const defaults = `mutation Default($id:ID!,$enabled:Boolean!){setSubstitutionDefault(id:$id,enabled:$enabled){substitutionId ${selection}}}`;
const remove = `mutation Delete($id:ID!){deleteSubstitution(id:$id){substitutionId ${selection}}}`;
const select = `mutation Select($miniatureId:ID!,$targetPaintId:ID!,$substitutionId:ID,$useOriginal:Boolean! = false){selectPaintSubstitution(miniatureId:$miniatureId,targetPaintId:$targetPaintId,substitutionId:$substitutionId,useOriginal:$useOriginal){miniatureId paintId substitutionId ${selection}}}`;
type Payload = {
  revision: { epoch: string; seq: string };
  invalidatedFamilies: string[];
  imported: number;
  skipped: number;
  substitutionId: string;
  clientMutationId?: string;
};
async function gql(query: string, variables: Record<string, unknown>) {
  const response = await rest("/graphql", "POST", { query, variables });
  return (await response.json()) as {
    data?: Record<string, Payload>;
    errors?: { message: string; extensions: { code: string } }[];
  };
}
function envelope(result: Awaited<ReturnType<typeof gql>>, name: string) {
  assert.equal(result.errors, undefined, JSON.stringify(result));
  const payload = result.data?.[name];
  assert.ok(payload);
  assert.equal(payload.revision.epoch, changeLogEpoch);
  assert.equal(Number(payload.revision.seq), currentChangeSeq(sqlite));
  return payload;
}
function cursor() {
  return { epoch: changeLogEpoch, since: currentChangeSeq(sqlite) };
}
function paint(name: string) {
  return sqlite.prepare("SELECT * FROM paint_catalog WHERE name=?").get(name) as {
    id: string;
    brand: string;
    range: string;
    color_hex: string | null;
    source_url: string | null;
  };
}
const source = "00000000-0000-4000-8000-000000000001";
const miniature = "00000000-0000-4000-8000-000000000003";

void test("paint/substitution commands preserve REST parity, rollback, invalidation and authorization", async (t) => {
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
      .prepare("INSERT INTO paint_catalog(id,brand,range,name) VALUES(?,'Source','Base','Source')")
      .run(source);
    sqlite
      .prepare("INSERT INTO miniatures(id,title,status,created_at) VALUES(?,'Fixture','OWNED',1)")
      .run(miniature);
    let a = "",
      b = "",
      c = "",
      ab = "",
      ba = "",
      ac = "";

    await t.test("imports skip duplicates/invalid rows and normalize like REST", async () => {
      const before = cursor();
      const payload = envelope(
        await gql(imports, {
          paints: [
            { brand: " Test ", name: "A", colorHex: "#ABC" },
            { brand: "test", range: "other", name: " a " },
            { brand: "Test", name: "B", colorHex: "not-a-color" },
            { brand: "Test", name: "C", type: "Mix", sourceUrl: " https://example.invalid " },
            { brand: "", name: "invalid" },
          ],
        }),
        "importCustomPaints",
      );
      assert.equal(payload.imported, 3);
      assert.equal(payload.skipped, 2);
      assert.equal(payload.clientMutationId, "fixture");
      assert.deepEqual(payload.invalidatedFamilies, invalidationSince(before).families);
      a = paint("A").id;
      b = paint("B").id;
      c = paint("C").id;
      assert.match(a, /^user:/);
      assert.equal(paint("A").color_hex, "#aabbcc");
      assert.equal(paint("B").color_hex, null);
      assert.equal(paint("C").range, "Mix");
      assert.equal(paint("C").source_url, "https://example.invalid");
      const response = await rest("/catalog", "POST", { paints: [{ brand: "TEST", name: "A" }] });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { imported: 0, skipped: 1 });
      assert.equal((await gql(imports, { paints: [] })).errors?.[0].extensions.code, "BAD_USER_INPUT");
    });

    await t.test("custom edits retain validation, source guards and last-save-wins", async () => {
      const input = { brand: "Updated", name: "A", colorHex: "123", range: "" };
      envelope(await gql(update, { id: a, input }), "updateCustomPaint");
      assert.equal(paint("A").brand, "Updated");
      assert.equal(paint("A").color_hex, "#112233");
      assert.equal((await rest(`/catalog/${a}`, "PUT", { ...input, brand: "Last REST save" })).status, 200);
      assert.equal(paint("A").brand, "Last REST save");
      const before = cursor();
      assert.equal(
        (await gql(update, { id: a, input: { ...input, colorHex: "invalid" } })).errors?.[0].extensions.code,
        "BAD_USER_INPUT",
      );
      assert.equal((await gql(update, { id: source, input })).errors?.[0].extensions.code, "FORBIDDEN");
      assert.equal((await gql(removePaint, { id: source })).errors?.[0].extensions.code, "FORBIDDEN");
      assert.equal((await rest(`/catalog/${source}`, "DELETE")).status, 403);
      assert.equal(currentChangeSeq(sqlite), before.since);
      assert.equal(paint("A").brand, "Last REST save");
    });

    await t.test(
      "substitution creation normalizes ordered parts and rejects invalid ingredients atomically",
      async () => {
        const input = {
          targetPaintId: a,
          name: " A mix ",
          ingredients: [
            { paintId: b, parts: 1000 },
            { paintId: c, parts: 0 },
          ],
        };
        const before = cursor();
        const payload = envelope(await gql(create, { input }), "createSubstitution");
        ab = payload.substitutionId;
        assert.deepEqual(payload.invalidatedFamilies, invalidationSince(before).families);
        assert.deepEqual(
          sqlite
            .prepare(
              "SELECT paint_id,parts,sort_order FROM paint_substitution_ingredients WHERE substitution_id=? ORDER BY sort_order",
            )
            .all(ab),
          [
            { paint_id: b, parts: 99, sort_order: 0 },
            { paint_id: c, parts: 1, sort_order: 1 },
          ],
        );
        const seq = currentChangeSeq(sqlite);
        for (const ingredients of [
          [],
          [{ paintId: a }],
          [{ paintId: b }, { paintId: b }],
          [{ paintId: "missing" }],
        ])
          assert.equal(
            (await gql(create, { input: { ...input, ingredients } })).errors?.[0].extensions.code,
            "BAD_USER_INPUT",
          );
        assert.equal(currentChangeSeq(sqlite), seq);
        const response = await rest("/paint-substitutions", "POST", {
          targetPaintId: b,
          name: "B mix",
          ingredients: [{ paintId: a, parts: 2.7 }],
        });
        assert.equal(response.status, 201);
        ba = (await response.json()).id;
        assert.equal(
          sqlite
            .prepare("SELECT parts FROM paint_substitution_ingredients WHERE substitution_id=?")
            .pluck()
            .get(ba),
          2,
        );
        ac = envelope(
          await gql(create, {
            input: { targetPaintId: a, name: "Other mix", ingredients: [{ paintId: c }] },
          }),
          "createSubstitution",
        ).substitutionId;
      },
    );

    await t.test("defaults reject cycles and legacy miniature choices preserve REST semantics", async () => {
      envelope(await gql(defaults, { id: ab, enabled: true }), "setSubstitutionDefault");
      const before = cursor();
      assert.equal(
        (await gql(defaults, { id: ba, enabled: true })).errors?.[0].extensions.code,
        "BAD_USER_INPUT",
      );
      assert.equal(currentChangeSeq(sqlite), before.since);
      assert.equal(
        sqlite.prepare("SELECT is_default FROM paint_substitutions WHERE id=?").pluck().get(ab),
        1,
      );
      assert.equal(
        (await rest("/paint-substitutions", "PUT", { action: "default", id: ba, enabled: true })).status,
        400,
      );
      envelope(
        await gql(select, { miniatureId: miniature, targetPaintId: b, useOriginal: true }),
        "selectPaintSubstitution",
      );
      assert.equal(
        (await gql(select, { miniatureId: miniature, targetPaintId: b, substitutionId: ab })).errors?.[0]
          .extensions.code,
        "NOT_FOUND",
      );
      assert.equal(
        sqlite
          .prepare(
            "SELECT use_original FROM miniature_paint_substitutions WHERE miniature_id=? AND target_paint_id=?",
          )
          .pluck()
          .get(miniature, b),
        1,
      );
      envelope(await gql(defaults, { id: ac, enabled: true }), "setSubstitutionDefault");
      envelope(
        await gql(select, { miniatureId: miniature, targetPaintId: b, substitutionId: ba }),
        "selectPaintSubstitution",
      );
    });

    await t.test(
      "SQL failure rolls back default switch, inserted recipe, and change-log revision",
      async () => {
        const before = cursor();
        sqlite.exec(
          `CREATE TEMP TRIGGER fail_default BEFORE UPDATE ON paint_substitutions WHEN NEW.id='${ab}' AND NEW.is_default=1 BEGIN SELECT RAISE(ABORT,'fixture SQL failure'); END;`,
        );
        try {
          const failed = await gql(defaults, { id: ab, enabled: true });
          assert.ok(failed.errors);
          assert.doesNotMatch(JSON.stringify(failed), /fixture SQL|sqlite|INSERT|UPDATE/);
          assert.equal(
            sqlite.prepare("SELECT is_default FROM paint_substitutions WHERE id=?").pluck().get(ac),
            1,
          );
          assert.equal(currentChangeSeq(sqlite), before.since);
        } finally {
          sqlite.exec("DROP TRIGGER fail_default");
        }
        const count = sqlite.prepare("SELECT count(*) FROM paint_substitutions").pluck().get();
        sqlite.exec(
          "CREATE TEMP TRIGGER fail_ingredient BEFORE INSERT ON paint_substitution_ingredients BEGIN SELECT RAISE(ABORT,'fixture SQL failure'); END;",
        );
        try {
          assert.ok(
            (await gql(create, { input: { targetPaintId: a, name: "Fails", ingredients: [{ paintId: b }] } }))
              .errors,
          );
          assert.equal(sqlite.prepare("SELECT count(*) FROM paint_substitutions").pluck().get(), count);
          assert.equal(currentChangeSeq(sqlite), before.since);
        } finally {
          sqlite.exec("DROP TRIGGER fail_ingredient");
        }
      },
    );

    await t.test("auth, origin/CSRF and ID bounds fail before mutation", async () => {
      const before = cursor();
      const body = { query: remove, variables: { id: ab } };
      assert.equal((await rest("/graphql", "POST", body, { authorization: "" })).status, 401);
      assert.equal((await rest("/graphql", "POST", body, { origin: "https://evil.invalid" })).status, 403);
      assert.equal((await gql(remove, { id: "x".repeat(257) })).errors?.[0].extensions.code, "QUERY_BUDGET");
      assert.equal(currentChangeSeq(sqlite), before.since);
    });

    await t.test("deletes cascade and preserve REST missing/no-op behavior", async () => {
      const before = cursor();
      const payload = envelope(await gql(remove, { id: ba }), "deleteSubstitution");
      assert.deepEqual(payload.invalidatedFamilies, invalidationSince(before).families);
      assert.equal(
        sqlite
          .prepare("SELECT count(*) FROM paint_substitution_ingredients WHERE substitution_id=?")
          .pluck()
          .get(ba),
        0,
      );
      assert.equal(
        sqlite
          .prepare("SELECT count(*) FROM miniature_paint_substitutions WHERE substitution_id=?")
          .pluck()
          .get(ba),
        0,
      );
      envelope(await gql(remove, { id: ba }), "deleteSubstitution");
      assert.equal((await rest(`/paint-substitutions?id=${ba}`, "DELETE")).status, 200);
      envelope(await gql(removePaint, { id: a }), "deleteCustomPaint");
      assert.equal(
        sqlite.prepare("SELECT count(*) FROM paint_substitutions WHERE target_paint_id=?").pluck().get(a),
        0,
      );
      assert.equal((await gql(removePaint, { id: a })).errors?.[0].extensions.code, "NOT_FOUND");
      assert.equal((await rest(`/catalog/${a}`, "DELETE")).status, 404);
    });
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
