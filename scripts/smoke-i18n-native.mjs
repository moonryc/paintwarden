#!/usr/bin/env node
// Quick unsigned packaged macOS smoke. No personal preferences or vault files.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright";
import { root } from "./i18n-layout-checks.mjs";

assert.equal(process.version, "v22.22.2");
assert.equal(process.platform, "darwin");
const [
  evidence,
  executable = path.join(root, "dist/electron/mac-arm64/Paint Vault.app/Contents/MacOS/Paint Vault"),
] = process.argv.slice(2);
assert.ok(evidence);
await mkdir(evidence, { recursive: true });
const data = await mkdtemp(path.join(os.tmpdir(), "paint-vault-i18n-native-"));
await writeFile(path.join(data, "client-connection.json"), JSON.stringify({ mode: "local", language: "de" }));
const report = {
  executable,
  dataDirectory: data,
  signing: "Unsigned isolated test package; no notarization/release",
  checks: [],
  errors: [],
};
const env = {
  ...process.env,
  DATA_DIR: "",
  DATABASE_PATH: "",
  PAINT_VAULT_DESKTOP_DATA_DIR: data,
  PAINT_VAULT_DISABLE_UPDATES: "1",
  NODE_ENV: "production",
};
let app;
async function snapshot(language) {
  const page = await app.firstWindow();
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.waitForFunction((language) => document.documentElement.lang === language, language);
  const native = await app.evaluate(({ app, Menu }) => ({
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    menu: Menu.getApplicationMenu().items.map((item) => ({
      label: item.label,
      role: item.role,
      items: item.submenu?.items.map(({ label, role }) => ({ label, role })),
    })),
  }));
  assert.equal(native.isPackaged, true);
  assert.ok(
    native.menu.some((item) => item.label === (language === "de" ? "Datei" : "ファイル")),
    JSON.stringify(native),
  );
  const preference = JSON.parse(await readFile(path.join(data, "client-connection.json"), "utf8"));
  assert.equal(preference.language, language);
  assert.equal(preference.mode, "local");
  const screenshot = `native-${language}.png`;
  await page.screenshot({ path: path.join(evidence, screenshot) });
  report.checks.push({
    language,
    ...native,
    preference,
    rendererLanguage: await page.locator("html").getAttribute("lang"),
    screenshot,
  });
  return page;
}
try {
  app = await electron.launch({ executablePath: executable, env, timeout: 45000 });
  const page = await snapshot("de");
  // The same secured IPC used by the settings selector must immediately rebuild
  // native menus and persist without overwriting the local connection.
  assert.equal(await page.evaluate(() => window.paintVaultDesktop.setLanguage("ja")), "ja");
  const changed = await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map(({ label }) => label));
  assert.ok(changed.includes("ファイル"));
  report.checks.push({ language: "ja", liveMenuChange: changed });
  await app.close();
  app = undefined;
  app = await electron.launch({ executablePath: executable, env, timeout: 45000 });
  await snapshot("ja");
  assert.deepEqual(report.errors, []);
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.stack;
  throw error;
} finally {
  await app?.close();
  await writeFile(path.join(evidence, "native-results.json"), JSON.stringify(report, null, 2));
}
