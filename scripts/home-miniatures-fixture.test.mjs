import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { seedHomeMiniaturesFixture } from "./home-miniatures-fixture.mjs";

void test("fixture refuses unbounded or undersized inputs before using a page", async () => {
  for (const miniatures of [0, 359, 2001, 360.5])
    await assert.rejects(seedHomeMiniaturesFixture(null, { miniatures }), assert.AssertionError);
});

void test("portable fixture commands create a physically-owned broken substitution and >five pages", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
    import assert from "node:assert/strict";
    import { mkdtemp } from "node:fs/promises";
    import { tmpdir } from "node:os";
    import path from "node:path";
    process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), "pv-phase3-smoke-fixture-test-"));
    delete process.env.DATABASE_PATH;
    process.env.NODE_ENV = "test";
    process.env.HOST = "127.0.0.1";
    const { routeApi } = await import("./server/api-router.ts");
    const { getSqlite } = await import("./db/index.ts");
    const sqlite = getSqlite();
    sqlite.prepare("INSERT INTO vault_account(id,username,password_hash,require_sign_in) VALUES(1,'fixture','fake',0)").run();
    // In-process production routing, not a listening server or user hostname.
    globalThis.fetch = (url, options) => routeApi(new Request(new URL(url, "http://127.0.0.1:19387"), options));
    const { seedHomeMiniaturesFixture } = await import("../../scripts/home-miniatures-fixture.mjs");
    const fixture = await seedHomeMiniaturesFixture({ evaluate: (fn, arg) => fn(arg) });
    const { readMiniature, readHome, readMiniatures } = await import("./graphql/miniatures.ts");
    const broken = readMiniature(fixture.brokenMiniatureId);
    assert.equal(broken.miniature.readiness.brokenSubstitution, 1);
    assert.equal(broken.miniature.readiness.missing, 1);
    assert.equal(sqlite.prepare("SELECT quantity FROM paint_inventory WHERE paint_id=?").get(fixture.brokenPaintId).quantity, 2);
    assert.equal(readMiniature(fixture.miniatureId).miniature.readiness.missing, 0);
    let after = null, rows = [], pages = 0;
    do {
      const view = readMiniatures({ first: 48, after, search: fixture.prefix });
      assert.equal(view.miniatures.totalCount, 360);
      rows.push(...view.miniatures.nodes);
      after = view.miniatures.pageInfo.hasNextPage ? view.miniatures.pageInfo.endCursor : null;
      pages++;
    } while (after);
    assert.equal(rows.length, 360);
    assert.ok(pages > 5);
    assert.equal(rows.at(-1).title, fixture.finalTitle);
    assert.equal(readHome({ first: 48 }).counts.ready, 1);
    console.log(JSON.stringify({ result: "PASS", retainedDataDir: process.env.DATA_DIR, pages, finalTitle: fixture.finalTitle }));
    sqlite.close();
  `,
    ],
    {
      cwd: fileURLToPath(new URL("../apps/paint-vault", import.meta.url)),
      env: { ...process.env, DATA_DIR: "", DATABASE_PATH: "" },
      encoding: "utf8",
      timeout: 60000,
    },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /"result":"PASS"/);
});
