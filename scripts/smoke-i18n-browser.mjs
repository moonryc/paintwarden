#!/usr/bin/env node
// Production Chromium app smoke. Uses a newly seeded temporary vault, random
// loopback port, and a separate browser context. Never accesses the user's vault.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { languages } from "../packages/paint-i18n/languages.ts";
import { createLibraryFixture } from "./library-fixture.mjs";
import {
  freePort,
  launchOwned,
  waitForOutput,
  stopOwned,
  fixtureCredentials,
} from "./smoke-library-native.mjs";
import { root, translationDictionary, measureLayout, platformFonts } from "./i18n-layout-checks.mjs";

assert.equal(process.version, "v22.22.2");
const [evidence] = process.argv.slice(2);
assert.ok(evidence);
await mkdir(evidence, { recursive: true });
const fixture = await createLibraryFixture(root, "large");
const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const server = launchOwned(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    'process.env.NODE_ENV="test";const {startServer}=await import("./server.mjs");process.env.NODE_ENV="production";await startServer();console.log("I18N_SMOKE_READY");',
  ],
  {
    cwd: path.join(root, "apps/paintwarden/dist"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATA_DIR: fixture.dataDir,
      DATABASE_PATH: "",
      HOST: "127.0.0.1",
      PORT: String(port),
      WEB_DIST: path.join(root, "apps/paintwarden-web/dist"),
      PAINTWARDEN_ALLOWED_HOSTS: "",
      PAINTWARDEN_DISABLE_UPDATES: "1",
    },
  },
  path.join(evidence, "browser-server.log"),
);
const report = {
  scope:
    "13 languages × 8 main pages + Plugins; live Settings picker, device persistence, four-language mobile/font/screenshots",
  fixture,
  origin,
  checks: [],
  runtimeErrors: [],
  javascriptRequests: [],
};
const regex = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
let browser;
try {
  await waitForOutput(server, /I18N_SMOKE_READY/, "isolated production server");
  const setup = await fetch(`${origin}/api/auth/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fixtureCredentials),
  });
  assert.equal(setup.status, 200);
  const { token } = await setup.json();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, locale: "en-US" });
  await context.addCookies([
    { name: "pv_session", value: token, url: origin, httpOnly: true, sameSite: "Strict" },
  ]);
  const page = await context.newPage();
  page.on("pageerror", (error) => report.runtimeErrors.push(error.message));
  page.on("request", (request) => {
    if (/\.js(?:\?|$)/.test(request.url())) report.javascriptRequests.push(request.url().replace(origin, ""));
  });
  const catalogs = {};
  for (const { code } of languages)
    catalogs[code] = Object.fromEntries(
      await Promise.all(
        ["pages", "common", "shell", "components"].map(async (namespace) => [
          namespace,
          JSON.parse(
            await readFile(path.join(root, "packages/paint-i18n/locales", code, `${namespace}.json`), "utf8"),
          ),
        ]),
      ),
    );
  let current = "en";
  await page.goto(origin);
  const settings = async () => {
    await page.getByRole("button", { name: regex(catalogs[current].pages.layoutSettings) }).click();
    await page.getByRole("combobox", { name: catalogs[current].common.language, exact: true }).waitFor();
  };
  const settle = async () => {
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  };
  const record = async (language, route, dictionary) => {
    await settle();
    const result = { language, route, ...(await page.evaluate(measureLayout, dictionary)) };
    assert.equal(result.language, language);
    assert.equal(result.overflow, false, JSON.stringify(result));
    assert.deepEqual(result.clipped, [], JSON.stringify(result));
    assert.deepEqual(result.unresolvedKeys, [], JSON.stringify(result));
    report.checks.push(result);
    if (
      ["de", "ja", "zh-Hans", "es"].includes(language) &&
      ["dashboard", "paints", "settings"].includes(route)
    ) {
      const file = `${language}-${route}.png`;
      await page.screenshot({ path: path.join(evidence, file), fullPage: false });
      result.screenshot = file;
    }
    if (["ja", "ko", "zh-Hans", "zh-Hant"].includes(language) && route === "dashboard") {
      result.platformFonts = await platformFonts(page, "h2");
      result.platformSansFonts = await platformFonts(page, "nav .MuiListItemText-primary");
      if (process.platform === "darwin") {
        const faces = {
          ja: ["Hiragino Mincho ProN", "Hiragino Sans"],
          ko: ["AppleMyungjo", "Apple SD Gothic Neo"],
          "zh-Hans": ["Songti SC", "PingFang SC"],
          "zh-Hant": ["Songti TC", "PingFang TC"],
        }[language];
        for (const [index, fonts] of [result.platformFonts, result.platformSansFonts].entries())
          assert.ok(
            fonts.some(
              (font) =>
                (font.familyName === faces[index] ||
                  font.postScriptName.startsWith(faces[index].replaceAll(" ", ""))) &&
                font.glyphCount > 0,
            ),
            `${language}: expected regional ${faces[index]}, got ${JSON.stringify(fonts)}`,
          );
      }
    }
  };
  for (const { code, name } of [...languages.slice(1), languages[0]]) {
    await settings();
    await page.getByRole("combobox", { name: catalogs[current].common.language, exact: true }).click();
    await page.getByRole("option", { name, exact: true }).click();
    await page.getByRole("option", { name, exact: true }).waitFor({ state: "hidden" });
    current = code;
    await page.waitForFunction((language) => document.documentElement.lang === language, code);
    assert.equal(await page.evaluate(() => localStorage.getItem("paintwarden-language")), code);
    const dictionary = await translationDictionary(code);
    await record(code, "settings", dictionary);
    await page.getByRole("button", { name: catalogs[code].pages.settingsManagePlugins, exact: true }).click();
    await page.getByRole("dialog", { name: catalogs[code].pages.sourcesPlugins, exact: true }).waitFor();
    await record(code, "plugins", dictionary);
    await page.keyboard.press("Escape");
    const routes = {
      dashboard: "layoutWorkbench",
      miniatures: "layoutMiniatures",
      paints: "layoutPaints",
      wishlist: "layoutWishlist",
      schemes: "layoutSchemes",
      templates: "layoutTemplates",
      "paint-tools": "layoutPaintTools",
    };
    for (const [route, key] of Object.entries(routes)) {
      await page
        .getByRole("navigation", { name: catalogs[code].pages.layoutPrimary, exact: true })
        .getByText(catalogs[code].pages[key], { exact: true })
        .click();
      await page.getByRole("heading", { level: 2 }).first().waitFor();
      await record(code, route, dictionary);
    }
    if (["de", "ja", "zh-Hans", "es"].includes(code)) {
      await settings();
      await page.setViewportSize({ width: 390, height: 844 });
      await settle();
      const mobile = {
        language: code,
        route: "settings-mobile",
        ...(await page.evaluate(measureLayout, dictionary)),
      };
      assert.equal(mobile.overflow, false, JSON.stringify(mobile));
      assert.deepEqual(mobile.clipped, [], JSON.stringify(mobile));
      report.checks.push(mobile);
      mobile.screenshot = `${code}-settings-mobile.png`;
      await page.screenshot({ path: path.join(evidence, mobile.screenshot) });
      await page.setViewportSize({ width: 1440, height: 1050 });
    }
    await page.reload();
    await page.waitForFunction((language) => document.documentElement.lang === language, code);
    report.checks.push({ language: code, route: "reload-persistence", status: "PASS" });
    console.log(`${code}: all main pages, Plugins and persistence passed`);
  }
  assert.deepEqual(report.runtimeErrors, []);
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.stack;
  throw error;
} finally {
  await browser?.close();
  await stopOwned(server.child);
  await server.save();
  await writeFile(path.join(evidence, "browser-results.json"), JSON.stringify(report, null, 2));
}
