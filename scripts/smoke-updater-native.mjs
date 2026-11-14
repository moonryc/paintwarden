#!/usr/bin/env node
// Actual unsigned macOS package + in-memory injected updater. No artifact edits/test hooks,
// published feeds or real installers. All connection/vault data lives in retained temp dirs.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const evidence = path.resolve(process.argv[2] || "");
assert.ok(process.argv[2], "Usage: node scripts/smoke-updater-native.mjs EVIDENCE_DIR");
assert.equal(process.version, "v22.22.2");
assert.equal(process.platform, "darwin");
await mkdir(evidence, { recursive: true });
const executable = path.join(root, "dist/electron/mac-arm64/Paintwarden.app/Contents/MacOS/Paintwarden");
const asar = path.join(executable, "../../Resources/app.asar");
const report = {
  startedAt: new Date().toISOString(),
  executable,
  asarSha256: createHash("sha256")
    .update(await readFile(asar))
    .digest("hex"),
  scope:
    "Unsigned packaged macOS arm64; injected updater methods, real main/preload/renderer and quit policy. No actual signed installer or published feed.",
  checks: [],
  errors: [],
  profiles: [],
};
const servers = [];
let app;
async function server(name) {
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const data = await mkdtemp(path.join(os.tmpdir(), `pv-updater-server-${name}-`));
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: path.join(root, "apps/paintwarden/dist"),
    env: {
      ...process.env,
      DATA_DIR: data,
      DATABASE_PATH: "",
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const entry = { name, data, port, child, log: "" };
  servers.push(entry);
  child.stderr.on("data", (chunk) => {
    entry.log += chunk;
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Fixture server startup timeout")), 30000);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Fixture exited ${code}: ${entry.log}`));
    });
    child.stdout.on("data", (chunk) => {
      entry.log += chunk;
      if (entry.log.includes('PAINTWARDEN_STARTUP {"phase":"ready"}')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  return `http://127.0.0.1:${port}`;
}
async function launch(name, choice) {
  const data = await mkdtemp(path.join(os.tmpdir(), `pv-updater-${name}-`));
  const resultFile = path.join(data, "injected-updater.json");
  await writeFile(path.join(data, "client-connection.json"), JSON.stringify({ ...choice, language: "en" }));
  report.profiles.push({ name, data, resultFile });
  app = await electron.launch({
    executablePath: executable,
    env: {
      ...process.env,
      DATA_DIR: "",
      DATABASE_PATH: "",
      PAINTWARDEN_DESKTOP_DATA_DIR: data,
      // Policy must be enabled. Inject immediately, before its first 10-second check.
      PAINTWARDEN_DISABLE_UPDATES: "0",
      NODE_ENV: "production",
    },
    timeout: 45000,
  });
  const native = await app.evaluate(({ app }, resultFile) => {
    const require = process.mainModule.require.bind(process.mainModule);
    const fs = require("node:fs");
    const updater = require("electron-updater").autoUpdater;
    const stats = {
      checks: 0,
      downloads: 0,
      installs: 0,
      autoDownload: updater.autoDownload,
      autoInstallOnAppQuit: updater.autoInstallOnAppQuit,
    };
    const save = () => fs.writeFileSync(resultFile, JSON.stringify(stats));
    // Keep real EventEmitter and the production policy's registered listeners.
    // No method here can contact GitHub or stage an OS installation.
    updater.checkForUpdates = async () => {
      stats.checks++;
      save();
      updater.emit("checking-for-update");
      updater.emit("update-available", { version: "1.1.0" });
      return { isUpdateAvailable: true };
    };
    updater.downloadUpdate = async () => {
      stats.downloads++;
      save();
      updater.emit("download-progress", { percent: 42 });
      updater.emit("update-downloaded", { version: "1.1.0" });
      return [];
    };
    updater.quitAndInstall = () => {
      stats.installs++;
      save();
      setImmediate(() => app.quit());
    };
    globalThis.updaterSmoke = { stats, save };
    app.on("before-quit", save);
    save();
    return { packaged: app.isPackaged, appPath: app.getAppPath(), ...stats };
  }, resultFile);
  assert.equal(native.packaged, true);
  assert.equal(native.autoDownload, false);
  assert.equal(native.autoInstallOnAppQuit, false);
  const page = await app.firstWindow();
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.waitForFunction(async () => (await fetch("/api/auth/status")).ok);
  const authenticated = await page.evaluate(async () => {
    const status = await (await fetch("/api/auth/status")).json();
    const response = await fetch(`/api/auth/${status.setupRequired ? "setup" : "login"}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "updater-smoke", password: "isolated-updater-smoke-password" }),
    });
    return response.status;
  });
  assert.equal(authenticated, 200);
  await page.reload();
  await page.getByRole("heading", { name: "Workbench", exact: true }).waitFor();
  await page.waitForFunction(
    async () => (await window.paintwardenDesktop.getUpdateState()).status !== "disabled",
  );
  report.checks.push({
    name: `${name}: actual packaged app and safe native flags`,
    status: "PASS",
    ...native,
  });
  return { page, resultFile };
}
const stats = () => app.evaluate(() => ({ ...globalThis.updaterSmoke.stats }));
async function close(resultFile, installs) {
  const child = app.process();
  await app.close();
  app = undefined;
  assert.equal(child.exitCode, 0, "Intentional quit must exit cleanly");
  const result = { ...JSON.parse(await readFile(resultFile, "utf8")), exitCode: child.exitCode };
  assert.equal(result.installs, installs);
  assert.equal(result.autoInstallOnAppQuit, false);
  return result;
}
const getState = (page) => page.evaluate(() => window.paintwardenDesktop.getUpdateState());
const check = (page) => page.evaluate(() => window.paintwardenDesktop.checkForUpdates());
async function prompt(page) {
  const dialog = page.getByRole("dialog", { name: "Update may disconnect from server" });
  await dialog.waitFor();
  assert.match(await dialog.textContent(), /Server 1\.0\.0.*App update 1\.1\.0/);
  assert.match(await dialog.textContent(), /until the server is upgraded/);
  return dialog;
}
async function ready(page) {
  await page.waitForFunction(
    async () => (await window.paintwardenDesktop.getUpdateState()).status === "ready",
  );
}
try {
  const remoteA = await server("a");
  const remoteB = await server("b");
  {
    const { page, resultFile } = await launch("remote-defer-switch", { mode: "remote", serverUrl: remoteA });
    await check(page);
    let dialog = await prompt(page);
    assert.equal((await stats()).downloads, 0);
    await page.screenshot({ path: path.join(evidence, "remote-consent.png"), animations: "disabled" });
    await dialog.getByRole("button", { name: "Not now" }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal((await getState(page)).status, "deferred");
    assert.equal((await stats()).downloads, 0);
    await check(page);
    dialog = await prompt(page);
    const old = await getState(page);
    await dialog.getByRole("button", { name: "Update anyway" }).click();
    await ready(page);
    assert.equal((await stats()).downloads, 1);
    await page.evaluate(
      (serverUrl) => window.paintwardenDesktop.setConnection({ mode: "remote", serverUrl }),
      remoteB,
    );
    dialog = await prompt(page);
    const switched = await getState(page);
    assert.notEqual(old.consentId, switched.consentId);
    await page.evaluate(
      (old) =>
        window.paintwardenDesktop.respondToUpdate({
          version: old.version,
          consentId: old.consentId,
          action: "download",
        }),
      old,
    );
    assert.equal((await getState(page)).status, "consent-required");
    assert.equal(await page.evaluate(() => window.paintwardenDesktop.installUpdate()), false);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    const result = await close(resultFile, 0);
    report.checks.push({
      name: "remote consent/defer/manual reminder; downloaded consent revoked on server switch; stale response and Restart blocked; Escape + ordinary quit do not install",
      status: "PASS",
      result,
    });
  }
  {
    const { page, resultFile } = await launch("remote-consented-quit", {
      mode: "remote",
      serverUrl: remoteA,
    });
    await check(page);
    const dialog = await prompt(page);
    await dialog.getByRole("button", { name: "Update anyway" }).click();
    await ready(page);
    const result = await close(resultFile, 1);
    report.checks.push({
      name: "remote explicit consent downloads and authorizes exactly one install on quit",
      status: "PASS",
      result,
    });
  }
  {
    const { page, resultFile } = await launch("local-ready-switch", { mode: "local" });
    await page.waitForFunction(
      async () => (await window.paintwardenDesktop.getStartupState()).phase === "ready",
    );
    await check(page);
    await ready(page);
    assert.equal((await stats()).downloads, 1);
    assert.equal(await page.getByRole("dialog", { name: "Update may disconnect from server" }).count(), 0);
    await page.screenshot({ path: path.join(evidence, "local-automatic-ready.png"), animations: "disabled" });
    await page.evaluate(
      (serverUrl) => window.paintwardenDesktop.setConnection({ mode: "remote", serverUrl }),
      remoteA,
    );
    await prompt(page);
    await page.screenshot({
      path: path.join(evidence, "local-ready-switched-remote.png"),
      animations: "disabled",
    });
    const result = await close(resultFile, 0);
    report.checks.push({
      name: "local automatically downloads without consent; switching ready local update to remote prompts and prevents install-on-quit",
      status: "PASS",
      result,
    });
  }
  {
    const { page, resultFile } = await launch("local-automatic-quit", { mode: "local" });
    await page.waitForFunction(
      async () => (await window.paintwardenDesktop.getStartupState()).phase === "ready",
    );
    await check(page);
    await ready(page);
    const result = await close(resultFile, 1);
    report.checks.push({
      name: "local automatic download and ordinary quit install remain intact",
      status: "PASS",
      result,
    });
  }
  assert.deepEqual(report.errors, []);
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.stack;
  throw error;
} finally {
  await app?.close();
  for (const entry of servers) {
    entry.child.kill();
    await writeFile(path.join(evidence, `native-server-${entry.name}.log`), entry.log);
  }
  report.servers = servers.map(({ name, data, port }) => ({ name, data, port }));
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(evidence, "native-results.json"), JSON.stringify(report, null, 2));
}
