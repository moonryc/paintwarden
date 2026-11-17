#!/usr/bin/env node
// Render existing real Storybook fixtures without their English-only interactions.
// The fixtures' own delays exercise both initial placeholders and settled content.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { freePort, launchOwned, waitForOutput, stopOwned } from "./smoke-library-native.mjs";
const evidence = path.resolve(process.argv[2]);
await mkdir(evidence, { recursive: true });
const port = await freePort();
const owned = launchOwned(
  process.execPath,
  [
    path.resolve("node_modules/.bin/storybook"),
    "dev",
    "--port",
    String(port),
    "--host",
    "127.0.0.1",
    "--ci",
    "--no-open",
    "--disable-telemetry",
  ],
  { cwd: path.resolve("packages/vault-ui"), env: { ...process.env, CI: "1" } },
  path.join(evidence, "storybook.log"),
);
await waitForOutput(owned, /Storybook.*started|Local:/, "isolated Storybook", 120000);
const base = `http://127.0.0.1:${port}`;
const defaultStories = [
  "components-bulkdeletedialog--long-list",
  "components-bulkdeletedialog--templates",
  "components-addminiaturetile--folder",
  "dialogs-paintdetailsmodal--loading",
  "dialogs-plugins--loading",
  "modals-apollo-project-drawer--loading",
  "modals-apollo-scheme-dialogs--loading",
  "components-folderbrowser--loading",
  "components-folderpicker--choose-nested-folder",
  "miniatures-form-templates--distant-initial-template",
  "paint-tools-layout--loading",
  "pages-settings--loading",
  "pages-settings--desktop-metadata-loading",
  "pages-settings--desktop-phone-initially-enabled",
];
const stories = process.env.AUDIT_STORIES?.split(",") || defaultStories;
const locales = (
  process.env.AUDIT_LANGUAGES || "en,de,es,fr,it,ja,ko,nl,pl,pt-BR,ru,zh-Hans,zh-Hant,en-XA"
).split(",");
const widths = (process.env.AUDIT_WIDTHS || "320,360,390,768,1024,1280,1440").split(",").map(Number);
const tasks = locales.flatMap((locale) => widths.map((width) => ({ locale, width })));
const report = { startedAt: new Date().toISOString(), rows: [], errors: [] };
const browser = await chromium.launch({ headless: true });
try {
  async function lane() {
    for (let task; (task = tasks.shift());) {
      const { locale, width } = task;
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => report.errors.push({ locale, width, error: error.message }));
      for (const story of stories) {
        await page.goto(
          `${base}/iframe.html?id=${story}&viewMode=story&embed=true&globals=locale:${locale}`,
          { waitUntil: "domcontentloaded" },
        );
        await page.waitForFunction(() => window.__STORYBOOK_PREVIEW__?.currentRender?.phase === "finished");
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => {
          const elements = [
            ...document.querySelectorAll(
              "[data-page-header],[data-modal-header],[data-filter-toolbar],.MuiDialog-paper input,.MuiDialog-paper button,.MuiDialog-paper [role=combobox]",
            ),
          ].filter((el) => el.getBoundingClientRect().height);
          window.__overlayProbe = elements.map((el) => ({ el, box: el.getBoundingClientRect().toJSON() }));
        });
        // Delayed Storybook responses settle within 750 ms; also allow dialog entry.
        await page.waitForTimeout(1000);
        const result = await page.evaluate(() => {
          const movement = window.__overlayProbe.map(({ el, box }) => ({
            name: el.textContent.slice(0, 100),
            removed: !el.isConnected,
            delta: Math.max(
              ...["x", "y", "width", "height"].map((k) => Math.abs(el.getBoundingClientRect()[k] - box[k])),
            ),
          }));
          const papers = [...document.querySelectorAll(".MuiDialog-paper")].map((el) => ({
            width: el.clientWidth,
            scroll: el.scrollWidth,
          }));
          return {
            documentWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body.scrollWidth,
            movement,
            papers,
            text: document.body.innerText.slice(0, 3000),
          };
        });
        const row = { story, locale, width, ...result };
        report.rows.push(row);
        assert.ok(result.documentWidth <= width + 1 && result.bodyWidth <= width + 1, JSON.stringify(row));
        assert.ok(
          result.papers.every((p) => p.scroll <= p.width + 1),
          JSON.stringify(row),
        );
        assert.ok(
          result.movement.every((m) => !m.removed && m.delta <= 1),
          JSON.stringify(row),
        );
        if (locale === "en" && [390, 1440].includes(width))
          await page.screenshot({ path: path.join(evidence, `${story}-${width}.png`) });
      }
      await context.close();
      console.log(JSON.stringify({ locale, width, cases: report.rows.length }));
      await writeFile(path.join(evidence, "results.json"), JSON.stringify(report, null, 2));
    }
  }
  await Promise.all(Array.from({ length: 3 }, lane));
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(evidence, "results.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await stopOwned(owned.child);
}
