import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { applyVaultChanges, vaultRowKey, type VaultCursor } from "@paint-vault/core/vault-changes";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-changes-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getDb, getSqlite } = await import("../db");
const {
  catalogSourceItems,
  catalogSources,
  colorSchemePaints,
  colorSchemes,
  miniatures,
  paintCatalog,
  paintInventory,
} = await import("../db/schema");
const { vaultChangesSince, vaultSnapshot } = await import("./vault-state");
const { changedKeysSince } = await import("../db/change-log");
const { testId, testUserId } = await import("./test-ids");

const A = testId("a"),
  B = testId("b"),
  M1 = testId("m1"),
  S1 = testUserId("s1");

await test("vault change log", async (t) => {
  try {
    const db = getDb();
    const paint = (id: string) =>
      db.insert(paintCatalog).values({ id, brand: "Test", range: "Base", name: id }).run();
    const trackedDelta = (cursor: VaultCursor) => {
      const sqlite = getSqlite();
      const prepare = sqlite.prepare.bind(sqlite);
      const statements: string[] = [];
      sqlite.prepare = function (...args: Parameters<typeof prepare>) {
        statements.push(args[0]);
        return prepare(...args);
      };
      try {
        return { delta: vaultChangesSince(cursor.epoch, cursor.seq), statements };
      } finally {
        sqlite.prepare = prepare;
      }
    };
    const assertMatchesSnapshot = (cursor: VaultCursor) => {
      const logged = changedKeysSince(getSqlite(), cursor.epoch, cursor.seq);
      assert.equal(logged.reload, false);
      if (logged.reload) throw new Error("Expected a delta");
      const snapshot = vaultSnapshot();
      const rows = new Map(
        [...new Set(logged.keys.map(({ table }) => table))].map((table) => [
          table,
          new Map(
            (table === "paintRecords" ? db.select().from(paintInventory).all() : snapshot[table]).map(
              (row) => [vaultRowKey(table, row), row],
            ),
          ),
        ]),
      );
      const result = trackedDelta(cursor);
      assert.equal(result.delta.reload, false);
      assert.deepEqual(
        result.delta.changes,
        logged.keys.map(({ table, key }) => ({
          table,
          key,
          row: rows.get(table)?.get(vaultRowKey(table, key)) ?? null,
        })),
      );
      // Covers the legacy 999-variable limit for both single and composite keys.
      for (const statement of result.statements) assert.ok((statement.match(/\?/g) ?? []).length <= 900);
      return result;
    };

    await t.test("a snapshot plus its changes matches a fresh snapshot", () => {
      paint(A);
      const before = vaultSnapshot();
      paint(B);
      db.insert(paintInventory).values({ paintId: B, state: "OWNED" }).run();
      db.insert(miniatures)
        .values({
          id: M1,
          title: "Mini",
          status: "OWNED",
          imageKey: `${testId("k1")}.webp`,
          createdAt: 1,
          updatedAt: 1,
        })
        .run();
      const changes = vaultChangesSince(before.cursor.epoch, before.cursor.seq);
      assert.equal(changes.reload, false);
      const { cursor: _after, ...merged } = { ...applyVaultChanges(before, changes.changes), cursor: null };
      const { cursor: _fresh, ...fresh } = vaultSnapshot();
      assert.deepEqual(merged, fresh);
      assert.equal(fresh.miniatures[0].imageUrl, `/api/miniatures/${M1}/image?v=${testId("k1")}.webp`);
    });

    await t.test("rows removed by foreign-key cascades are reported as deleted", () => {
      db.insert(colorSchemes).values({ id: S1, name: "Scheme", createdAt: 1, updatedAt: 1 }).run();
      db.insert(colorSchemePaints).values({ schemeId: S1, paintId: A, sortOrder: 1 }).run();
      const { cursor } = vaultSnapshot();
      getSqlite().prepare("DELETE FROM paint_catalog WHERE id = ?").run(A);
      const { changes } = vaultChangesSince(cursor.epoch, cursor.seq);
      assert.deepEqual(
        changes.map(({ table, key, row }) => ({ table, key, row })),
        [
          { table: "colorSchemePaints", key: { schemeId: S1, sortOrder: 1 }, row: null },
          { table: "catalog", key: { id: A }, row: null },
        ],
      );
    });

    await t.test(
      "template metadata and recipe writes reload remote clients, but no-op updates do not",
      () => {
        const sqlite = getSqlite();
        const templateId = testUserId("reload-template");
        const check = (sql: string, parameters: unknown[] = [], reload = true) => {
          const { cursor } = vaultSnapshot();
          sqlite.prepare(sql).run(...parameters);
          assert.equal(vaultChangesSince(cursor.epoch, cursor.seq).reload, reload, sql);
        };
        check("INSERT INTO miniature_templates (id, name, created_at) VALUES (?, 'Reload test', 1)", [
          templateId,
        ]);
        check("UPDATE miniature_templates SET name = name WHERE id = ?", [templateId], false);
        check("UPDATE miniature_templates SET name = 'Renamed' WHERE id = ?", [templateId]);
        check("INSERT INTO miniature_template_schemes (template_id, scheme_id) VALUES (?, ?)", [
          templateId,
          S1,
        ]);
        check(
          "UPDATE miniature_template_schemes SET sort_order = sort_order WHERE template_id = ?",
          [templateId],
          false,
        );
        check("UPDATE miniature_template_schemes SET sort_order = 3 WHERE template_id = ?", [templateId]);
        check("INSERT INTO miniature_template_paints (template_id, paint_id, sort_order) VALUES (?, ?, 0)", [
          templateId,
          B,
        ]);
        check(
          "UPDATE miniature_template_paints SET notes = notes WHERE template_id = ?",
          [templateId],
          false,
        );
        check("UPDATE miniature_template_paints SET notes = 'New note' WHERE template_id = ?", [templateId]);
        check("DELETE FROM miniature_template_schemes WHERE template_id = ?", [templateId]);
        check("DELETE FROM miniature_template_paints WHERE template_id = ?", [templateId]);
        check("DELETE FROM miniature_templates WHERE id = ?", [templateId]);
      },
    );

    await t.test("source name changes ask for a reload; bookkeeping updates do not", () => {
      db.insert(catalogSources)
        .values({
          id: testId("src"),
          repository: "example/src",
          url: "u",
          branch: "main",
          name: "Src",
          version: "1.0.0",
          dependencies: [],
          updatedAt: 1,
        })
        .run();
      const { cursor } = vaultSnapshot();
      getSqlite().prepare("UPDATE catalog_sources SET last_error = NULL, updated_at = 2").run();
      assert.equal(vaultChangesSince(cursor.epoch, cursor.seq).reload, false);
      getSqlite().prepare("UPDATE catalog_sources SET name = 'Renamed'").run();
      assert.equal(vaultChangesSince(cursor.epoch, cursor.seq).reload, true);
    });

    await t.test("no-op updates are ignored and ordinary updates log each key only once", () => {
      const sqlite = getSqlite();
      const { cursor } = vaultSnapshot();
      sqlite
        .prepare("UPDATE paint_inventory SET state = state, quantity = quantity WHERE paint_id = ?")
        .run(B);
      sqlite
        .prepare("UPDATE miniatures SET image_key = image_key, source_image_url = NULL WHERE id = ?")
        .run(M1);
      const unchanged = vaultChangesSince(cursor.epoch, cursor.seq);
      assert.equal(unchanged.seq, cursor.seq);
      assert.deepEqual(unchanged.changes, []);

      sqlite.prepare("UPDATE paint_inventory SET quantity = 2 WHERE paint_id = ?").run(B);
      assert.equal(vaultChangesSince(cursor.epoch, cursor.seq).seq, cursor.seq + 1);
      // NULL-safe comparisons must still notice transitions to and from NULL.
      sqlite.prepare("UPDATE miniatures SET image_key = NULL WHERE id = ?").run(M1);
      assert.equal(vaultChangesSince(cursor.epoch, cursor.seq).seq, cursor.seq + 2);
      sqlite.prepare("UPDATE miniatures SET image_key = ? WHERE id = ?").run(`${testId("k2")}.webp`, M1);
      assert.equal(vaultChangesSince(cursor.epoch, cursor.seq).seq, cursor.seq + 3);
    });

    await t.test("primary-key edits report both keys, without duplicate unchanged-key entries", () => {
      const sqlite = getSqlite();
      const C = testId("c");
      paint(C);
      const { cursor } = vaultSnapshot();
      sqlite.prepare("UPDATE paint_inventory SET paint_id = ? WHERE paint_id = ?").run(C, B);
      const delta = vaultChangesSince(cursor.epoch, cursor.seq);
      assert.equal(delta.seq, cursor.seq + 2);
      assert.deepEqual(
        delta.changes.map(({ key }) => key),
        [{ paintId: B }, { paintId: C }],
      );
      assert.equal(delta.changes[0].row, null);
      assert.equal(delta.changes[1].row?.paintId, C);
      sqlite.prepare("UPDATE paint_inventory SET paint_id = ? WHERE paint_id = ?").run(B, C);
    });

    await t.test("no-op source-item updates do not force a reload", () => {
      db.insert(catalogSourceItems)
        .values({ sourceId: testId("src"), kind: "paint", itemId: B })
        .run();
      const { cursor } = vaultSnapshot();
      getSqlite().prepare("UPDATE catalog_source_items SET item_id = item_id").run();
      const delta = vaultChangesSince(cursor.epoch, cursor.seq);
      assert.equal(delta.reload, false);
      assert.equal(delta.seq, cursor.seq);
    });

    await t.test("large single-key deltas batch row and source lookups at the reload boundary", () => {
      const sqlite = getSqlite();
      const ids = Array.from({ length: 2000 }, (_, i) => testId(`batch-paint-${i}`));
      const source2 = testId("src-2");
      sqlite
        .prepare(
          "INSERT INTO catalog_sources (id, repository, url, branch, name, version, dependencies, updated_at) VALUES (?, 'example/second', 'u', 'main', 'Second', '1', '[]', 1)",
        )
        .run(source2);
      sqlite.transaction(() => {
        const insert = sqlite.prepare(
          "INSERT INTO paint_catalog (id, brand, range, name, discontinued) VALUES (?, 'Batch', 'Base', ?, 1)",
        );
        const item = sqlite.prepare(
          "INSERT INTO catalog_source_items (source_id, kind, item_id) VALUES (?, 'paint', ?)",
        );
        for (const id of ids) {
          insert.run(id, id);
          item.run(testId("src"), id);
          item.run(source2, id);
        }
      })();
      const { cursor } = vaultSnapshot();
      sqlite.transaction(() => {
        const update = sqlite.prepare("UPDATE paint_catalog SET name = 'Updated' WHERE id = ?");
        // Reverse key order must not become the batch SELECT's primary-key order.
        for (const id of ids.toReversed()) update.run(id);
      })();
      const { delta, statements } = assertMatchesSnapshot(cursor);
      assert.equal(delta.changes.length, 2000);
      assert.deepEqual(
        delta.changes.map(({ key }) => key.id),
        ids.toReversed(),
      );
      assert.equal(statements.filter((sql) => sql.includes('from "paint_catalog"')).length, 3);
      assert.equal(statements.filter((sql) => sql.includes('from "catalog_source_items"')).length, 3);
      assert.ok(delta.changes.every(({ row }) => row?.discontinued === true && row.sourceName));
      const empty = trackedDelta({ epoch: delta.epoch, seq: delta.seq });
      assert.deepEqual(empty.delta.changes, []);
      assert.ok(!empty.statements.some((sql) => sql.includes('from "paint_catalog"')));
      sqlite.prepare("UPDATE paint_catalog SET name = 'Another' WHERE id = ?").run(B);
      assert.equal(vaultChangesSince(cursor.epoch, cursor.seq).reload, true);
    });

    await t.test(
      "large composite deltas keep numeric keys, deletions, key edits and interleaved order",
      () => {
        const sqlite = getSqlite();
        const S2 = testUserId("batch-scheme-2");
        db.insert(colorSchemes).values({ id: S2, name: "Second", createdAt: 1, updatedAt: 1 }).run();
        sqlite.transaction(() => {
          const insert = sqlite.prepare(
            "INSERT INTO color_scheme_paints (scheme_id, paint_id, sort_order) VALUES (?, ?, ?)",
          );
          for (let i = 0; i < 600; i++) {
            insert.run(S1, B, i);
            insert.run(S2, B, i);
          }
        })();
        const { cursor } = vaultSnapshot();
        sqlite.transaction(() => {
          const update = sqlite.prepare(
            "UPDATE color_scheme_paints SET updated_at = updated_at + 1 WHERE scheme_id = ? AND sort_order = ?",
          );
          for (let i = 599; i >= 0; i--) {
            update.run(S2, i);
            update.run(S1, i);
          }
          sqlite.prepare("UPDATE paint_inventory SET quantity = quantity + 1 WHERE paint_id = ?").run(B);
          sqlite
            .prepare(
              "UPDATE color_scheme_paints SET sort_order = 9999 WHERE scheme_id = ? AND sort_order = 0",
            )
            .run(S1);
          sqlite.prepare("DELETE FROM color_scheme_paints WHERE scheme_id = ? AND sort_order = 1").run(S2);
        })();
        const { delta, statements } = assertMatchesSnapshot(cursor);
        assert.equal(delta.changes.length, 1202);
        assert.equal(statements.filter((sql) => sql.includes('from "color_scheme_paints"')).length, 3);
        assert.deepEqual(
          delta.changes.slice(-4).map(({ table, key, row }) => ({ table, key, deleted: !row })),
          [
            { table: "paintRecords", key: { paintId: B }, deleted: false },
            { table: "colorSchemePaints", key: { schemeId: S1, sortOrder: 0 }, deleted: true },
            { table: "colorSchemePaints", key: { schemeId: S1, sortOrder: 9999 }, deleted: false },
            { table: "colorSchemePaints", key: { schemeId: S2, sortOrder: 1 }, deleted: true },
          ],
        );
      },
    );

    await t.test("all composite table shapes use full keys and preserve snapshot formatting", () => {
      const sqlite = getSqlite();
      const S2 = testUserId("batch-scheme-2");
      const sharedId = testId("shared-entry");
      const substitution = testId("substitution");
      sqlite.transaction(() => {
        sqlite.prepare("INSERT INTO miniature_recipe_steps (miniature_id, step) VALUES (?, 'OTHER')").run(M1);
        sqlite
          .prepare("INSERT INTO miniature_color_schemes (miniature_id, scheme_id) VALUES (?, ?)")
          .run(M1, S1);
        sqlite
          .prepare(
            "INSERT INTO paint_substitutions (id, target_paint_id, name, created_at) VALUES (?, ?, 'Mix', 1)",
          )
          .run(substitution, B);
        sqlite
          .prepare("INSERT INTO paint_substitution_ingredients (substitution_id, paint_id) VALUES (?, ?)")
          .run(substitution, B);
        sqlite
          .prepare(
            "INSERT INTO miniature_paint_substitutions (miniature_id, target_paint_id, substitution_id) VALUES (?, ?, ?)",
          )
          .run(M1, B, substitution);
        for (const scheme of [S1, S2]) {
          sqlite
            .prepare("INSERT INTO color_scheme_dividers (scheme_id, id, label) VALUES (?, ?, 'Divider')")
            .run(scheme, sharedId);
          sqlite
            .prepare(
              "INSERT INTO color_scheme_images (scheme_id, id, image_url) VALUES (?, ?, 'https://example.test/image')",
            )
            .run(scheme, sharedId);
        }
      })();
      const { cursor } = vaultSnapshot();
      sqlite.transaction(() => {
        for (const table of [
          "miniature_recipe_steps",
          "miniature_color_schemes",
          "paint_substitution_ingredients",
          "miniature_paint_substitutions",
          "color_scheme_dividers",
          "color_scheme_images",
        ])
          sqlite.exec(`UPDATE ${table} SET updated_at = updated_at + 1`);
        sqlite
          .prepare(
            "UPDATE miniatures SET image_key = NULL, source_image_url = 'https://example.test/mini' WHERE id = ?",
          )
          .run(M1);
        sqlite.prepare("UPDATE color_schemes SET name = 'Changed' WHERE id = ?").run(S1);
        sqlite.prepare("DELETE FROM color_scheme_images WHERE scheme_id = ?").run(S2);
      })();
      const { delta } = assertMatchesSnapshot(cursor);
      assert.equal(
        delta.changes.find(({ table }) => table === "miniatures")?.row?.imageUrl,
        "https://example.test/mini",
      );
      assert.equal(delta.changes.find(({ table }) => table === "colorSchemes")?.row?.isSystem, false);
      assert.equal(
        delta.changes.find(({ table }) => table === "miniaturePaintSubstitutions")?.row?.useOriginal,
        false,
      );
      assert.equal(
        delta.changes.find(({ table, key }) => table === "colorSchemeImages" && key.schemeId === S2)?.row,
        null,
      );
    });

    await t.test("delta-only syncing prunes the log and reloads cursors older than retention", () => {
      const sqlite = getSqlite();
      const { cursor } = vaultSnapshot();
      const update = sqlite.prepare("UPDATE paint_inventory SET quantity = ? WHERE paint_id = ?");
      sqlite.transaction(() => {
        for (let i = 0; i < 40_010; i++) update.run(i % 2 ? 2 : 1, B);
      })();
      const delta = vaultChangesSince(cursor.epoch, cursor.seq);
      assert.equal(delta.reload, true);
      assert.equal(sqlite.prepare("SELECT count(*) FROM vault_changes").pluck().get(), 20_000);
      const recent = vaultChangesSince(cursor.epoch, delta.seq - 1);
      assert.equal(recent.reload, false);
      assert.equal(recent.changes.length, 1);
      assert.deepEqual(recent.changes[0].key, { paintId: B });
      assert.equal(vaultChangesSince(cursor.epoch, delta.seq - 20_000).reload, false);
      assert.equal(vaultChangesSince(cursor.epoch, delta.seq - 20_001).reload, true);
      assert.deepEqual(vaultChangesSince(cursor.epoch, delta.seq).changes, []);
    });

    await t.test("a cursor from another server run asks for a reload", () => {
      assert.equal(vaultChangesSince("previous-run", 0).reload, true);
      const { cursor } = vaultSnapshot();
      assert.equal(vaultChangesSince(cursor.epoch, cursor.seq + 5).reload, true);
    });
  } finally {
    getSqlite().close();
    rmSync(directory, { recursive: true, force: true });
  }
});
