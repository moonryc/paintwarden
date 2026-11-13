import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-change-log-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getSqlite } = await import("./index");
const { changedKeysSince, changeLogEpoch, currentChangeSeq, pruneChangeLog } = await import("./change-log");
const { testId, testUserId } = await import("../lib/test-ids");
const sqlite = getSqlite();
const A = testId("a"),
  B = testId("b"),
  M = testId("mini"),
  S = testUserId("scheme"),
  S2 = testUserId("scheme-2"),
  SOURCE = testId("source");
const cursor = () => currentChangeSeq(sqlite);
const changes = (since: number) => {
  const result = changedKeysSince(sqlite, changeLogEpoch, since);
  assert.equal(result.reload, false);
  if (result.reload) throw new Error("Expected invalidation keys");
  return result;
};
const paint = (id: string) =>
  sqlite.prepare("INSERT INTO paint_catalog(id,brand,range,name) VALUES(?,'Test','Base',?)").run(id, id);

void test("durable change-log keys drive invalidations without materializing vault rows", async (t) => {
  try {
    paint(A);
    paint(B);
    sqlite.prepare("INSERT INTO paint_inventory(paint_id,state) VALUES(?,'OWNED')").run(B);
    sqlite
      .prepare("INSERT INTO miniatures(id,title,status,created_at,updated_at) VALUES(?,'Mini','OWNED',1,1)")
      .run(M);
    for (const id of [S, S2])
      sqlite
        .prepare("INSERT INTO color_schemes(id,name,created_at,updated_at) VALUES(?,'Scheme',1,1)")
        .run(id);
    sqlite
      .prepare(
        "INSERT INTO catalog_sources(id,repository,url,branch,name,version,dependencies,updated_at) VALUES(?,'example/src','u','main','Src','1','[]',1)",
      )
      .run(SOURCE);

    await t.test("foreign-key cascades retain keys for removed children and parent", () => {
      sqlite
        .prepare("INSERT INTO color_scheme_paints(scheme_id,paint_id,sort_order) VALUES(?,?,1)")
        .run(S, A);
      const since = cursor();
      sqlite.prepare("DELETE FROM paint_catalog WHERE id=?").run(A);
      assert.deepEqual(changes(since).keys, [
        { table: "colorSchemePaints", key: { schemeId: S, sortOrder: 1 } },
        { table: "catalog", key: { id: A } },
      ]);
      assert.equal(
        sqlite.prepare("SELECT count(*) FROM color_scheme_paints WHERE paint_id=?").pluck().get(A),
        0,
      );
    });
    await t.test("template metadata and every recipe table reset projections, no-op updates do not", () => {
      const template = testUserId("template");
      const check = (sql: string, parameters: unknown[] = [], reload = true) => {
        const since = cursor();
        sqlite.prepare(sql).run(...parameters);
        assert.equal(changedKeysSince(sqlite, changeLogEpoch, since).reload, reload, sql);
        if (!reload) assert.equal(cursor(), since);
      };
      check("INSERT INTO miniature_templates(id,name,created_at) VALUES(?,'Fixture',1)", [template]);
      check("UPDATE miniature_templates SET name=name WHERE id=?", [template], false);
      check("UPDATE miniature_templates SET name='Renamed' WHERE id=?", [template]);
      check("INSERT INTO miniature_template_schemes(template_id,scheme_id) VALUES(?,?)", [template, S]);
      check(
        "UPDATE miniature_template_schemes SET sort_order=sort_order WHERE template_id=?",
        [template],
        false,
      );
      check("UPDATE miniature_template_schemes SET sort_order=3 WHERE template_id=?", [template]);
      check("INSERT INTO miniature_template_paints(template_id,paint_id,sort_order) VALUES(?,?,0)", [
        template,
        B,
      ]);
      check("UPDATE miniature_template_paints SET notes=notes WHERE template_id=?", [template], false);
      check("UPDATE miniature_template_paints SET notes='Changed' WHERE template_id=?", [template]);
      check("DELETE FROM miniature_template_schemes WHERE template_id=?", [template]);
      check("DELETE FROM miniature_template_paints WHERE template_id=?", [template]);
      check("DELETE FROM miniature_templates WHERE id=?", [template]);
    });
    await t.test(
      "source metadata has precise invalidation while display and membership changes reset",
      () => {
        let since = cursor();
        sqlite.prepare("UPDATE catalog_sources SET updated_at=2 WHERE id=?").run(SOURCE);
        assert.deepEqual(changes(since), { reload: false, seq: cursor(), sourcesChanged: true, keys: [] });
        since = cursor();
        sqlite.prepare("UPDATE catalog_sources SET name='Renamed' WHERE id=?").run(SOURCE);
        assert.equal(changedKeysSince(sqlite, changeLogEpoch, since).reload, true);
        since = cursor();
        sqlite
          .prepare("INSERT INTO catalog_source_items(source_id,kind,item_id) VALUES(?,'paint',?)")
          .run(SOURCE, B);
        assert.equal(changedKeysSince(sqlite, changeLogEpoch, since).reload, true);
        since = cursor();
        sqlite.prepare("UPDATE catalog_source_items SET item_id=item_id").run();
        assert.deepEqual(changes(since).keys, []);
        assert.equal(cursor(), since);
        sqlite.prepare("DELETE FROM catalog_source_items WHERE source_id=?").run(SOURCE);
        assert.equal(changedKeysSince(sqlite, changeLogEpoch, since).reload, true);
      },
    );
    await t.test("no-op and NULL-safe updates preserve sequence; repeated keys are deduplicated", () => {
      const since = cursor();
      sqlite.prepare("UPDATE paint_inventory SET state=state,quantity=quantity WHERE paint_id=?").run(B);
      sqlite.prepare("UPDATE miniatures SET image_key=image_key,source_image_url=NULL WHERE id=?").run(M);
      assert.equal(cursor(), since);
      assert.deepEqual(changes(since).keys, []);
      sqlite.prepare("UPDATE paint_inventory SET quantity=2 WHERE paint_id=?").run(B);
      sqlite.prepare("UPDATE paint_inventory SET quantity=3 WHERE paint_id=?").run(B);
      sqlite.prepare("UPDATE miniatures SET image_key=? WHERE id=?").run(`${testId("photo")}.webp`, M);
      sqlite.prepare("UPDATE miniatures SET image_key=NULL WHERE id=?").run(M);
      assert.equal(cursor(), since + 4);
      assert.deepEqual(changes(since).keys, [
        { table: "paintRecords", key: { paintId: B } },
        { table: "miniatures", key: { id: M } },
      ]);
    });
    await t.test("primary-key edits record old and new keys once each", () => {
      const C = testId("c");
      paint(C);
      const since = cursor();
      sqlite.prepare("UPDATE paint_inventory SET paint_id=? WHERE paint_id=?").run(C, B);
      assert.equal(cursor(), since + 2);
      assert.deepEqual(changes(since).keys, [
        { table: "paintRecords", key: { paintId: B } },
        { table: "paintRecords", key: { paintId: C } },
      ]);
      sqlite.prepare("UPDATE paint_inventory SET paint_id=? WHERE paint_id=?").run(B, C);
    });
    await t.test("all composite key shapes keep every string and numeric component", () => {
      const shared = testId("entry"),
        sub = testId("mix");
      sqlite.prepare("INSERT INTO miniature_recipe_steps(miniature_id,step) VALUES(?,'OTHER')").run(M);
      sqlite.prepare("INSERT INTO miniature_color_schemes(miniature_id,scheme_id) VALUES(?,?)").run(M, S);
      sqlite
        .prepare("INSERT INTO paint_substitutions(id,target_paint_id,name,created_at) VALUES(?,?,'Mix',1)")
        .run(sub, B);
      sqlite
        .prepare("INSERT INTO paint_substitution_ingredients(substitution_id,paint_id) VALUES(?,?)")
        .run(sub, B);
      sqlite
        .prepare(
          "INSERT INTO miniature_paint_substitutions(miniature_id,target_paint_id,substitution_id) VALUES(?,?,?)",
        )
        .run(M, B, sub);
      for (const scheme of [S, S2]) {
        sqlite
          .prepare("INSERT INTO color_scheme_dividers(scheme_id,id,label) VALUES(?,?,'Divider')")
          .run(scheme, shared);
        sqlite
          .prepare(
            "INSERT INTO color_scheme_images(scheme_id,id,image_url) VALUES(?,?,'https://example.test/image')",
          )
          .run(scheme, shared);
        sqlite
          .prepare("INSERT INTO color_scheme_paints(scheme_id,paint_id,sort_order) VALUES(?,?,5)")
          .run(scheme, B);
      }
      const since = cursor();
      for (const table of [
        "miniature_recipe_steps",
        "miniature_color_schemes",
        "paint_substitution_ingredients",
        "miniature_paint_substitutions",
        "color_scheme_dividers",
        "color_scheme_images",
        "color_scheme_paints",
      ])
        sqlite.exec(`UPDATE ${table} SET updated_at=updated_at+1`);
      const keys = changes(since).keys;
      for (const expected of [
        { table: "recipeSteps", key: { miniatureId: M, step: "OTHER" } },
        { table: "miniatureColorSchemes", key: { miniatureId: M, schemeId: S } },
        { table: "paintSubstitutionIngredients", key: { substitutionId: sub, paintId: B } },
        { table: "miniaturePaintSubstitutions", key: { miniatureId: M, targetPaintId: B } },
        ...[S, S2].flatMap((schemeId) => [
          { table: "colorSchemeDividers", key: { schemeId, id: shared } },
          { table: "colorSchemeImages", key: { schemeId, id: shared } },
          { table: "colorSchemePaints", key: { schemeId, sortOrder: 5 } },
        ]),
      ])
        assert.ok(
          keys.some((key) => JSON.stringify(key) === JSON.stringify(expected)),
          JSON.stringify(expected),
        );
      assert.equal(keys.length, 10);
    });
    await t.test(
      "large composite catchup preserves interleaved order, numeric key edits and deleted keys",
      () => {
        const insert = sqlite.prepare(
          "INSERT INTO color_scheme_paints(scheme_id,paint_id,sort_order) VALUES(?,?,?)",
        );
        sqlite.transaction(() => {
          for (let i = 1000; i < 1600; i++) {
            insert.run(S, B, i);
            insert.run(S2, B, i);
          }
        })();
        const since = cursor();
        sqlite.transaction(() => {
          const update = sqlite.prepare(
            "UPDATE color_scheme_paints SET updated_at=updated_at+1 WHERE scheme_id=? AND sort_order=?",
          );
          for (let i = 1599; i >= 1000; i--) {
            update.run(S2, i);
            update.run(S, i);
          }
          sqlite.prepare("UPDATE paint_inventory SET quantity=quantity+1 WHERE paint_id=?").run(B);
          sqlite
            .prepare("UPDATE color_scheme_paints SET sort_order=9999 WHERE scheme_id=? AND sort_order=1000")
            .run(S);
          sqlite.prepare("DELETE FROM color_scheme_paints WHERE scheme_id=? AND sort_order=1001").run(S2);
        })();
        const keys = changes(since).keys;
        assert.equal(keys.length, 1202);
        assert.deepEqual(keys.slice(0, 2), [
          { table: "colorSchemePaints", key: { schemeId: S2, sortOrder: 1599 } },
          { table: "colorSchemePaints", key: { schemeId: S, sortOrder: 1599 } },
        ]);
        assert.deepEqual(keys.slice(-4), [
          { table: "paintRecords", key: { paintId: B } },
          { table: "colorSchemePaints", key: { schemeId: S, sortOrder: 1000 } },
          { table: "colorSchemePaints", key: { schemeId: S, sortOrder: 9999 } },
          { table: "colorSchemePaints", key: { schemeId: S2, sortOrder: 1001 } },
        ]);
        assert.equal(
          sqlite
            .prepare("SELECT count(*) FROM color_scheme_paints WHERE scheme_id=? AND sort_order=1000")
            .pluck()
            .get(S),
          0,
        );
        assert.equal(
          sqlite
            .prepare("SELECT count(*) FROM color_scheme_paints WHERE scheme_id=? AND sort_order=1001")
            .pluck()
            .get(S2),
          0,
        );
      },
    );
    await t.test("2000 unique keys catch up in last-write order; overflow resets", () => {
      const ids = Array.from({ length: 2000 }, (_, i) => testId(`batch-${i}`));
      sqlite.transaction(() => {
        for (const id of ids) paint(id);
      })();
      const since = cursor();
      sqlite.transaction(() => {
        const update = sqlite.prepare("UPDATE paint_catalog SET name='Updated' WHERE id=?");
        for (const id of ids.toReversed()) update.run(id);
      })();
      assert.deepEqual(
        changes(since).keys,
        ids.toReversed().map((id) => ({ table: "catalog", key: { id } })),
      );
      sqlite.prepare("UPDATE paint_catalog SET name='Another' WHERE id=?").run(B);
      assert.equal(changedKeysSince(sqlite, changeLogEpoch, since).reload, true);
    });
    await t.test("retention pruning preserves the boundary and recent keys", () => {
      const since = cursor(),
        update = sqlite.prepare("UPDATE paint_inventory SET quantity=? WHERE paint_id=?");
      sqlite.transaction(() => {
        for (let i = 0; i < 40010; i++) update.run(i % 2 ? 2 : 1, B);
      })();
      pruneChangeLog(sqlite);
      const seq = cursor();
      assert.equal(changedKeysSince(sqlite, changeLogEpoch, since).reload, true);
      assert.equal(sqlite.prepare("SELECT count(*) FROM vault_changes").pluck().get(), 20000);
      assert.deepEqual(changes(seq - 1).keys, [{ table: "paintRecords", key: { paintId: B } }]);
      assert.equal(changedKeysSince(sqlite, changeLogEpoch, seq - 20000).reload, false);
      assert.equal(changedKeysSince(sqlite, changeLogEpoch, seq - 20001).reload, true);
      assert.deepEqual(changes(seq).keys, []);
    });
    await t.test("another epoch and impossible future cursors request reset", () => {
      assert.equal(changedKeysSince(sqlite, "previous-process", 0).reload, true);
      assert.equal(changedKeysSince(sqlite, changeLogEpoch, cursor() + 5).reload, true);
    });
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
