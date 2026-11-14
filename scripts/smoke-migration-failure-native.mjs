#!/usr/bin/env node
// Run after build, package-desktop-server, electron-builder --dir on macOS.
// Mutates only the packaged artifact's migration inputs, restoring them in finally.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { _electron as electron } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(root, "apps/paintwarden/package.json"));
const Database = require("better-sqlite3");
const { drizzle } = require("drizzle-orm/better-sqlite3");
const { migrate } = require("drizzle-orm/better-sqlite3/migrator");
assert.equal(process.version, "v22.22.2");
assert.equal(process.platform, "darwin");
const evidence = process.argv[2];
assert.ok(evidence, "pass an evidence directory");
await mkdir(evidence, { recursive: true });
const resources = path.join(root, "dist/electron/mac-arm64/Paintwarden.app/Contents/Resources");
const executablePath = path.resolve(resources, "../MacOS/Paintwarden");
const migrationsFolder = path.join(resources, "server/drizzle");
const journalPath = path.join(migrationsFolder, "meta/_journal.json");
const savedJournal = await readFile(journalPath);
const tag = "9999_synthetic_failure_smoke";
const sqlPath = path.join(migrationsFolder, `${tag}.sql`);
const data = await mkdtemp(path.join(os.tmpdir(), "paintwarden-migration-failure-"));
const databasePath = path.join(data, "paintwarden.sqlite");
const report = {
  checks: [],
  errors: [],
  data,
  signing: "unsigned macOS arm64 package; not distribution certification",
};
let app;
async function closeApp() {
  const child = app.process();
  await app.close();
  assert.equal(child.exitCode, 0, "intentional app quit must exit cleanly");
  app = undefined;
}
function inspect(file = databasePath) {
  const db = new Database(file, { readonly: true });
  try {
    assert.deepEqual(db.pragma("foreign_key_check"), []);
    assert.deepEqual(db.prepare("SELECT * FROM synthetic_parent").all(), [{ id: "parent" }]);
    assert.deepEqual(db.prepare("SELECT * FROM synthetic_child").all(), [
      { id: "child", parent_id: "parent" },
    ]);
    return db.prepare("SELECT * FROM __drizzle_migrations").all();
  } finally {
    db.close();
  }
}
async function launch() {
  app = await electron.launch({
    executablePath,
    args: [],
    env: {
      ...process.env,
      DATA_DIR: "",
      DATABASE_PATH: "",
      NODE_ENV: "production",
      PAINTWARDEN_DESKTOP_DATA_DIR: data,
      PAINTWARDEN_DISABLE_UPDATES: "1",
      PAINTWARDEN_TEST_STARTUP: "0",
      PAINTWARDEN_DESKTOP_PORT: "0",
    },
    timeout: 45_000,
  });
  assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
  const page = await app.firstWindow();
  page.on("pageerror", (error) => report.errors.push(error.message));
  return page;
}
async function phase(page, name) {
  await page.waitForFunction(
    async (phase) => (await window.paintwardenDesktop.getStartupState()).phase === phase,
    name,
    { timeout: 30_000 },
  );
}
try {
  // All fixture values are synthetic. Drizzle seeds the released schema in a scratch database.
  const db = new Database(databasePath);
  migrate(drizzle(db), { migrationsFolder });
  db.exec(`CREATE TABLE synthetic_parent (id text PRIMARY KEY);
    CREATE TABLE synthetic_child (id text PRIMARY KEY, parent_id text REFERENCES synthetic_parent(id));
    INSERT INTO synthetic_parent VALUES ('parent'); INSERT INTO synthetic_child VALUES ('child','parent');`);
  db.close();
  const before = inspect();
  await writeFile(
    path.join(data, "client-connection.json"),
    JSON.stringify({ mode: "local", language: "de" }),
  );
  const journal = JSON.parse(savedJournal);
  const last = journal.entries.at(-1);
  journal.entries.push({ ...last, idx: last.idx + 1, when: last.when + 1, tag });
  await writeFile(journalPath, JSON.stringify(journal));
  const brokenSql = `CREATE TABLE __new_synthetic_parent (id text PRIMARY KEY);
--> statement-breakpoint
DROP TABLE synthetic_parent;
--> statement-breakpoint
ALTER TABLE __new_synthetic_parent RENAME TO synthetic_parent;`;
  await writeFile(sqlPath, brokenSql);
  report.injectedMigrationSha256 = createHash("sha256").update(brokenSql).digest("hex");
  let backup;
  for (let attempt = 0; attempt < 2; attempt++) {
    const page = await launch();
    await phase(page, "failed");
    await page.getByRole("heading", { name: "Dein Tresor konnte nicht gestartet werden" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Erneut versuchen" }).isEnabled(), true);
    await page.screenshot({ path: path.join(evidence, `packaged-failed-migration-${attempt}.png`) });
    assert.deepEqual(inspect(), before, "failed migration cannot advance journal or damage rows");
    await app.evaluate(({ shell }) => {
      shell.openPath = async (folder) => {
        globalThis.smokeLogs = folder;
        return "";
      };
    });
    await page.getByRole("button", { name: "Protokollordner öffnen" }).click();
    const logs = await app.evaluate(() => globalThis.smokeLogs);
    assert.equal(await realpath(logs), await realpath(path.join(data, "electron/logs")));
    const log = await readFile(path.join(logs, "vault-server.log"), "utf8");
    assert.match(log, /1 records with broken links \(synthetic_child\)/);
    assert.match(log, /remove the database -wal and -shm sidecars/);
    assert.match(log, /Restart with the previous working app or a corrected update/);
    assert.doesNotMatch(log, /"phase":"ready"/);
    const copies = (await readdir(path.join(data, "backups"))).filter((file) => file.includes(tag)).sort();
    backup = path.join(data, "backups", copies.at(-1));
    assert.deepEqual(inspect(backup), before);
    if (attempt === 0) {
      const failuresBefore = log.match(/"phase":"failed"/g).length;
      await page.evaluate(() => {
        window.__retryFailed = false;
        let starting = false;
        window.paintwardenDesktop.onStartupState((state) => {
          if (state.phase === "starting") starting = true;
          if (state.phase === "failed" && starting) window.__retryFailed = true;
        });
      });
      await page.getByRole("button", { name: "Erneut versuchen" }).click();
      await page.waitForFunction(() => window.__retryFailed);
      const retriedLog = await readFile(path.join(logs, "vault-server.log"), "utf8");
      assert.ok(retriedLog.match(/"phase":"failed"/g).length > failuresBefore);
      assert.deepEqual(inspect(), before);
    }
    report.checks.push({
      attempt,
      failureVisible: true,
      openLogs: logs,
      rollbackAndBackupIntact: true,
      status: "PASS",
    });
    await closeApp();
  }
  // Exercise the documented restore, with the old working migration set (not a destructive reset).
  await rm(`${databasePath}-wal`, { force: true });
  await rm(`${databasePath}-shm`, { force: true });
  await copyFile(backup, databasePath);
  await writeFile(journalPath, savedJournal);
  await rm(sqlPath);
  const recovered = await launch();
  await phase(recovered, "ready");
  await recovered.getByRole("button", { name: "Konto erstellen" }).waitFor();
  assert.deepEqual(inspect(), before);
  await recovered.screenshot({ path: path.join(evidence, "packaged-restored-startup.png") });
  report.checks.push({
    restoredBackup: backup,
    oldWorkingMigrations: true,
    rowsAndJournalExact: true,
    status: "PASS",
  });
  await closeApp();
  assert.deepEqual(report.errors, []);
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.stack;
  throw error;
} finally {
  await app?.close();
  await writeFile(journalPath, savedJournal);
  await rm(sqlPath, { force: true });
  await writeFile(
    path.join(evidence, "native-migration-failure-results.json"),
    JSON.stringify(report, null, 2),
  );
}
