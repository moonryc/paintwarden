import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-schema-"));
process.env.DATA_DIR = directory;
const { getSqlite } = await import("./index.ts");
const { testId } = await import("../lib/test-ids.ts");

// Statements name rows with short quoted names such as 'p' or 's1'; run() swaps each for a UUID.
const withIds = (statement: string) =>
  statement.replace(/'(p|q|m|t|t2|s\d)'/g, (_, name: string) => `'${testId(name)}'`);

// The database itself rejects rows the app should never write, so a bug or a hand-edited backup
// can't store them.
test("schema constraints", async (t) => {
  const sqlite = getSqlite();
  const run = (statement: string) => sqlite.prepare(withIds(statement)).run();
  const rejects = (statement: string, constraint: RegExp) => assert.throws(() => run(statement), constraint);
  try {
    run("INSERT INTO paint_catalog (id, brand, range, name) VALUES ('p', 'B', 'R', 'Target')");
    run("INSERT INTO paint_catalog (id, brand, range, name) VALUES ('q', 'B', 'R', 'Other')");
    run("INSERT INTO miniatures (id, title, status, created_at) VALUES ('m', 'Mini', 'OWNED', 1)");

    await t.test("paint colors are #rrggbb", () => {
      run("UPDATE paint_catalog SET color_hex = '#A1b2C3' WHERE id = 'p'");
      for (const value of ["'abc'", "'#abc'", "'#12345g'", "'#1234567'"])
        rejects(`UPDATE paint_catalog SET color_hex = ${value} WHERE id = 'p'`, /color_hex_check/);
      rejects("UPDATE paint_catalog SET discontinued = 2 WHERE id = 'p'", /discontinued_check/);
    });

    await t.test("a paint has at most one default substitution", () => {
      const add = (id: string, isDefault: number) =>
        `INSERT INTO paint_substitutions (id, target_paint_id, name, is_default, created_at)
          VALUES ('${id}', 'p', '${id}', ${isDefault}, 1)`;
      run(add("s1", 1));
      run(add("s2", 0));
      run(add("s3", 0));
      rejects(add("s4", 1), /UNIQUE constraint failed/);
      rejects("UPDATE paint_substitutions SET is_default = 1 WHERE id = 's2'", /UNIQUE constraint failed/);
    });

    await t.test("a miniature's choice is the original paint or one substitution", () => {
      const choose = (substitution: string, useOriginal: number) =>
        `INSERT OR REPLACE INTO miniature_paint_substitutions
          (miniature_id, target_paint_id, substitution_id, use_original) VALUES ('m', 'p', ${substitution}, ${useOriginal})`;
      run(choose("'s1'", 0));
      run(choose("NULL", 1));
      rejects(choose("NULL", 0), /choice_check/);
      rejects(choose("'s1'", 1), /choice_check/);
    });

    await t.test("a template repeats a paint across steps but not within one", () => {
      run("INSERT INTO miniature_templates (id, name, created_at) VALUES ('t', 'Template', 1)");
      const add = (sortOrder: number, step: string) =>
        `INSERT INTO miniature_template_paints (template_id, sort_order, paint_id, step)
          VALUES ('t', ${sortOrder}, 'q', '${step}')`;
      run(add(0, "BASECOAT"));
      run(add(1, "GLAZE"));
      rejects(add(2, "BASECOAT"), /UNIQUE constraint failed/);
    });

    await t.test("JSON list columns hold arrays", () => {
      rejects(
        "INSERT INTO miniature_templates (id, name, categories, created_at) VALUES ('t2', 'T', '{}', 1)",
        /categories_check/,
      );
      rejects(
        "INSERT INTO miniature_templates (id, name, categories, created_at) VALUES ('t2', 'T', 'nope', 1)",
        /categories_check|malformed JSON/,
      );
    });

    await t.test("integer columns hold integers", () => {
      rejects("UPDATE paint_catalog SET updated_at = 'yesterday' WHERE id = 'p'", /integers_check/);
      rejects(
        "INSERT INTO paint_inventory (paint_id, state, quantity) VALUES ('q', 'OWNED', 'lots')",
        /integers_check/,
      );
      rejects(
        "INSERT INTO paint_inventory (paint_id, state, quantity) VALUES ('q', 'OWNED', 1.5)",
        /integers_check/,
      );
      // Numbers bound from JavaScript are stored as integers.
      sqlite
        .prepare(withIds("INSERT INTO paint_inventory (paint_id, state, quantity) VALUES ('q', 'OWNED', ?)"))
        .run(3);
    });

    await t.test("a new vault frees deleted pages incrementally", () => {
      assert.equal(sqlite.pragma("auto_vacuum", { simple: true }), 2);
    });

    await t.test("record IDs are UUIDs, with user: allowed on owner items", () => {
      run(
        "INSERT INTO paint_catalog (id, brand, range, name) VALUES ('user:" +
          testId("own") +
          "', 'B', 'R', 'Own')",
      );
      for (const id of [
        "citadel/base/red",
        "user:mine",
        testId("upper").toUpperCase(),
        "custom-" + testId("x"),
      ])
        rejects(
          `INSERT INTO paint_catalog (id, brand, range, name) VALUES ('${id}', 'B', 'R', 'N')`,
          /paint_catalog_id_check/,
        );
      rejects(
        "INSERT INTO miniatures (id, title, status, created_at) VALUES ('mini-1', 'M', 'OWNED', 1)",
        /miniatures_id_check/,
      );
      rejects(
        `INSERT INTO miniatures (id, title, status, created_at) VALUES ('user:${testId("m2")}', 'M', 'OWNED', 1)`,
        /miniatures_id_check/,
      );
    });

    await t.test("an owner scheme has at most one start and one completion milestone", () => {
      run(
        "INSERT INTO color_schemes (id, name, created_at) VALUES ('user:" + testId("scheme") + "', 'S', 1)",
      );
      const divider = (name: string, role: string, tone = "MILESTONE") =>
        `INSERT INTO color_scheme_dividers (id, scheme_id, label, tone, role)
          VALUES ('${testId(name)}', 'user:${testId("scheme")}', 'GET READY!', '${tone}', ${role})`;
      run(divider("start", "'START'"));
      run(divider("plain", "NULL"));
      rejects(divider("start again", "'START'"), /UNIQUE constraint failed/);
      rejects(divider("bad role", "'MIDDLE'"), /role_check/);
      rejects(divider("step role", "'COMPLETE'", "SECTION"), /role_tone_check/);
      rejects(
        `INSERT INTO color_scheme_dividers (id, scheme_id, label) VALUES ('step-1', 'user:${testId("scheme")}', 'BASECOAT')`,
        /color_scheme_dividers_id_check/,
      );
    });

    await t.test("text columns hold at most their limit", () => {
      const insert = (name: string) =>
        sqlite
          .prepare(
            withIds(
              "INSERT INTO paint_catalog (id, brand, range, name) VALUES ('user:" +
                testId("long") +
                "', 'B', 'R', ?)",
            ),
          )
          .run(name);
      assert.throws(() => insert("x".repeat(201)), /paint_catalog_lengths_check/);
      insert("x".repeat(200));
      rejects(
        `UPDATE miniatures SET notes = '${"n".repeat(10_001)}' WHERE id = 'm'`,
        /miniatures_lengths_check/,
      );
    });

    await t.test("image keys are a UUID and an image extension", () => {
      run(`UPDATE miniatures SET image_key = '${testId("photo")}.webp' WHERE id = 'm'`);
      for (const key of ["photo.webp", `${testId("photo")}.svg`, `../${testId("photo")}.png`])
        rejects(`UPDATE miniatures SET image_key = '${key}' WHERE id = 'm'`, /miniatures_image_key_check/);
    });
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
