#!/usr/bin/env node
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { _electron as electron } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(root, "apps/paint-vault/package.json"));
const Database = require("better-sqlite3");
const evidence = process.argv[2];
assert.ok(evidence);
assert.equal(process.version, "v22.22.2");
assert.equal(process.platform, "darwin");
await mkdir(evidence, { recursive: true });
const report = process.argv.includes("--recovery-only")
  ? JSON.parse(await readFile(path.join(evidence, "native-results.json"), "utf8"))
  : {
      checks: [],
      errors: [],
      signing: "Unsigned isolated macOS app; not distribution certification",
    };
const packaged = path.join(root, "dist/electron/mac-arm64/Paint Vault.app/Contents/MacOS/Paint Vault");
const development = createRequire(path.join(root, "apps/paint-vault-electron/package.json"))("electron");
async function fixture(name, broken = false) {
  const data = await mkdtemp(path.join(os.tmpdir(), `paint-vault-${name}-`));
  const db = new Database(path.join(data, "paint-vault.sqlite"));
  db.exec("CREATE TABLE fixture_notes(body text); INSERT INTO fixture_notes VALUES ('keep me');");
  db.close();
  await writeFile(
    path.join(data, "client-connection.json"),
    JSON.stringify({ mode: "local", language: "de" }),
  );
  if (broken) await writeFile(path.join(data, "backups"), "deliberate backup directory collision");
  return data;
}
async function launch(executablePath, data, delay) {
  return electron.launch({
    executablePath,
    args: executablePath === development ? [path.join(root, "apps/paint-vault-electron")] : [],
    env: {
      ...process.env,
      DATA_DIR: "",
      DATABASE_PATH: "",
      NODE_ENV: "production",
      PAINT_VAULT_DESKTOP_DATA_DIR: data,
      PAINT_VAULT_DISABLE_UPDATES: "1",
      PAINT_VAULT_TEST_STARTUP: "1",
      PAINT_VAULT_TEST_STARTUP_DELAY_MS: String(delay),
      PAINT_VAULT_DESKTOP_PORT: "0",
    },
    timeout: 45_000,
  });
}
async function phase(page, name, timeout = 120_000) {
  await page.evaluate(async () => {
    if (window.__startupSmoke) return;
    window.__startupSmoke = { phase: "unknown" };
    let received = false;
    window.paintVaultDesktop.onStartupState((state) => {
      received = true;
      window.__startupSmoke = state;
    });
    const state = await window.paintVaultDesktop.getStartupState();
    if (!received) window.__startupSmoke = state;
  });
  await page.waitForFunction((name) => window.__startupSmoke.phase === name, name, { timeout });
  assert.equal((await page.evaluate(() => window.paintVaultDesktop.getStartupState())).phase, name);
}
let app;
try {
  if (!process.argv.includes("--recovery-only"))
    for (const [mode, executable] of [
      ["development", development],
      ["packaged", packaged],
    ]) {
      const data = await fixture(mode);
      app = await launch(executable, data, 45_000);
      const page = await app.firstWindow();
      page.on("pageerror", (error) => report.errors.push(`${mode}: ${error.message}`));
      const info = await app.evaluate(({ app }) => ({
        packaged: app.isPackaged,
        appPath: app.getAppPath(),
        logs: app.getPath("logs"),
      }));
      assert.equal(info.packaged, mode === "packaged");
      const started = Date.now();
      await phase(page, "backing-up");
      await page.getByRole("heading", { name: "Dein Tresor wird aktualisiert…" }).waitFor();
      assert.equal(await page.locator('[aria-busy="true"]').count(), 1);
      await page.screenshot({ path: path.join(evidence, `${mode}-backing-up.png`) });
      await phase(page, "migrating");
      await page.screenshot({ path: path.join(evidence, `${mode}-migrating.png`) });
      await phase(page, "ready");
      const elapsed = Date.now() - started;
      assert.ok(elapsed >= 80_000, `deliberately slow operations completed: ${elapsed}ms`);
      await page.screenshot({ path: path.join(evidence, `${mode}-ready.png`) });
      const log = await readFile(path.join(info.logs, "vault-server.log"), "utf8");
      assert.match(log, /"phase":"backing-up","status":"started"/);
      assert.match(log, /"phase":"migrating","status":"started"/);
      assert.match(log, /"phase":"ready"/);
      const copies = await readdir(path.join(data, "backups"));
      assert.equal(copies.length, 1);
      const backup = new Database(path.join(data, "backups", copies[0]), { readonly: true });
      assert.equal(backup.prepare("SELECT body FROM fixture_notes").pluck().get(), "keep me");
      assert.equal(
        backup.prepare("SELECT count(*) FROM sqlite_schema WHERE name='__drizzle_migrations'").pluck().get(),
        0,
      );
      backup.close();
      const db = new Database(path.join(data, "paint-vault.sqlite"), { readonly: true });
      assert.equal(db.prepare("SELECT body FROM fixture_notes").pluck().get(), "keep me");
      assert.ok(db.prepare("SELECT count(*) FROM __drizzle_migrations").pluck().get() > 0);
      db.close();
      report.checks.push({ mode, data, ...info, elapsed, preservedBackup: copies[0], status: "PASS" });
      await app.close();
      app = undefined;
      app = await launch(executable, data, 45_000);
      const restarted = await app.firstWindow();
      await phase(restarted, "ready", 20_000);
      report.checks.push({ mode: `${mode}-relaunch`, noPendingMigrationDelay: true, status: "PASS" });
      await app.close();
      app = undefined;
    }
  const data = await fixture("failure", true);
  app = await launch(packaged, data, 0);
  const page = await app.firstWindow();
  await phase(page, "failed");
  await page.getByRole("heading", { name: "Dein Tresor konnte nicht gestartet werden" }).waitFor();
  await page.screenshot({ path: path.join(evidence, "packaged-failure-recovery.png") });
  // Exercise the real renderer/preload IPC, without opening Finder on the person's desktop.
  await app.evaluate(({ shell }) => {
    shell.openPath = async (folder) => {
      globalThis.smokeOpenedLogs = folder;
      return "";
    };
  });
  await page.getByRole("button", { name: "Protokollordner öffnen" }).click();
  const opened = await app.evaluate(() => globalThis.smokeOpenedLogs);
  assert.equal(await realpath(opened), await realpath(path.join(data, "electron", "logs")));
  const log = await readFile(path.join(opened, "vault-server.log"), "utf8");
  assert.match(log, /EEXIST/);
  assert.match(log, /"phase":"failed"/);
  await rm(path.join(data, "backups"));
  await page.getByRole("button", { name: "Erneut versuchen" }).click();
  await phase(page, "ready", 20_000);
  report.checks.push({
    mode: "packaged-failure-retry",
    data,
    openLogsFolder: opened,
    stderrRetained: true,
    status: "PASS",
  });
  await app.close();
  app = undefined;
  const quitData = await fixture("deferred-quit");
  app = await launch(packaged, quitData, 2000);
  const quitPage = await app.firstWindow();
  await phase(quitPage, "backing-up");
  const processHandle = app.process();
  const exited = once(processHandle, "exit");
  const requested = Date.now();
  await app.evaluate(({ app }) => app.quit());
  assert.equal(processHandle.exitCode, null, "quit does not interrupt a protected backup");
  await exited;
  const quitElapsed = Date.now() - requested;
  assert.ok(quitElapsed > 1500, `quit waited for backup and migration: ${quitElapsed}`);
  const quitLog = await readFile(path.join(quitData, "electron", "logs", "vault-server.log"), "utf8");
  assert.match(quitLog, /"phase":"migrating","status":"completed"/);
  assert.match(quitLog, /"phase":"ready"/);
  report.checks.push({ mode: "packaged-deferred-quit", data: quitData, quitElapsed, status: "PASS" });
  app = undefined;
  assert.deepEqual(report.errors, []);
  delete report.error;
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.stack;
  throw error;
} finally {
  await app?.close();
  await writeFile(path.join(evidence, "native-results.json"), JSON.stringify(report, null, 2));
}
