#!/usr/bin/env node
// Render-only full story sweep. embed=true disables English play assertions;
// the normal storybook:test gate separately runs all interactions and a11y checks.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { freePort, launchOwned, waitForOutput, stopOwned } from "./smoke-library-native.mjs";
import { root, translationDictionary, measureLayout, platformFonts } from "./i18n-layout-checks.mjs";

assert.equal(process.version, "v22.22.2");
const [evidence, language, offset = "0", limit = "10000"] = process.argv.slice(2);
assert.ok(evidence && ["de", "ja", "zh-Hans", "pl", "en-XA"].includes(language));
await mkdir(evidence, { recursive: true });
const port = await freePort();
const owned = launchOwned(
  process.execPath,
  [
    path.join(root, "node_modules/.bin/storybook"),
    "dev",
    "--port",
    String(port),
    "--host",
    "127.0.0.1",
    "--ci",
    "--no-open",
    "--disable-telemetry",
  ],
  { cwd: path.join(root, "packages/vault-ui"), env: { ...process.env, CI: "1" } },
  path.join(evidence, `storybook-${language}.log`),
);
const report = {
  language,
  viewport: { width: 1600, height: 1100 },
  scope:
    "All indexed stories, render-only, English interactions intentionally disabled; translated leaf clipping and document overflow",
  results: [],
};
let browser;
try {
  await waitForOutput(owned, /Local:|Storybook.*started/, "isolated Storybook", 60000);
  const origin = `http://127.0.0.1:${port}`;
  const index = await (await fetch(`${origin}/index.json`)).json();
  const stories = Object.values(index.entries)
    .filter((entry) => entry.type === "story")
    .slice(Number(offset), Number(offset) + Number(limit));
  report.totalIndexedStories = Object.values(index.entries).filter((entry) => entry.type === "story").length;
  const translations = await translationDictionary(language);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: report.viewport });
  // External sample images do not affect translated label layout and should not
  // make this offline-compatible sweep depend on third-party hosts.
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin || /^(data|blob):/.test(route.request().url())
      ? route.continue()
      : route.abort(),
  );
  for (const [position, story] of stories.entries()) {
    let row = { id: story.id, title: story.title, name: story.name };
    try {
      await page.goto(
        `${origin}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story&embed=true&globals=locale:${language}`,
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForFunction(
        (language) =>
          document.documentElement.lang === language &&
          document.querySelector("#storybook-root")?.children.length &&
          window.__STORYBOOK_PREVIEW__?.currentRender?.phase === "finished",
        language,
        { timeout: 12000 },
      );
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      row = { ...row, ...(await page.evaluate(measureLayout, translations)) };
      if (story.id === "app-vault--workbench") row.platformFonts = await platformFonts(page, "h2");
      if (row.overflow || row.clipped.length || row.unresolvedKeys.length) {
        const file = `${language}-${story.id}.png`;
        await page.screenshot({ path: path.join(evidence, file), fullPage: false });
        row.screenshot = file;
      }
    } catch (error) {
      row.error = error.message;
      row.debug = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        text: document.body.innerText.slice(0, 1500),
        previewKeys: Object.keys(window.__STORYBOOK_PREVIEW__ || {}),
        phase: window.__STORYBOOK_PREVIEW__?.currentRender?.phase,
      }));
    }
    report.results.push(row);
    if (position % 50 === 0) console.log(`${language}: ${position + 1}/${stories.length}: ${story.id}`);
  }
  report.failures = report.results.filter(
    (row) => row.error || row.overflow || row.clipped?.length || row.unresolvedKeys?.length,
  );
  console.log(`${language}: rendered ${report.results.length}; ${report.failures.length} flagged for review`);
} finally {
  await browser?.close();
  await stopOwned(owned.child);
  await owned.save();
  await writeFile(path.join(evidence, `stories-${language}-${offset}.json`), JSON.stringify(report, null, 2));
}
