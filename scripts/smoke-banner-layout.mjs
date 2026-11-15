#!/usr/bin/env node
// Real Storybook fixtures, isolated loopback server, no backend/vault access.
// Seed reviewed screenshots: node scripts/smoke-banner-layout.mjs EVIDENCE --update-baselines
// Replay pixel + geometry regression: node scripts/smoke-banner-layout.mjs EVIDENCE
// Cross-platform CI geometry gate: node scripts/smoke-banner-layout.mjs EVIDENCE --geometry-only
// Baselines live in EVIDENCE/baselines (or --baseline-dir DIR), not the user's vault.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
// pngjs is supplied by the existing @vitest/browser Storybook test stack.
import { PNG } from "pngjs";

import { freePort, launchOwned, waitForOutput, stopOwned } from "./smoke-library-native.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
assert.ok(args[0] && !args[0].startsWith("--"), "Pass an evidence directory");
const evidence = path.resolve(args[0]);
const baselineIndex = args.indexOf("--baseline-dir");
const baselineDir =
  baselineIndex >= 0 ? path.resolve(args[baselineIndex + 1]) : path.join(evidence, "baselines");
const update = args.includes("--update-baselines");
const geometryOnly = args.includes("--geometry-only");
assert.ok(!(update && geometryOnly), "Choose --geometry-only or --update-baselines, not both");
await mkdir(evidence, { recursive: true });
if (!geometryOnly) await mkdir(baselineDir, { recursive: true });
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
  path.join(evidence, "storybook.log"),
);
const report = {
  scope: "Storybook Chromium renderer only; native hidden-inset simulated, not a packaged Electron pass",
  updateBaselines: update,
  comparison: geometryOnly ? "geometry-only (no pixel comparison)" : "geometry and reviewed pixels",
  results: [],
};
let browser;
try {
  await waitForOutput(owned, /Local:|Storybook.*started/, "isolated Storybook", 60000);
  const origin = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 1024, 390]) {
    for (const story of [
      "layout-vaultlayout--all-notices",
      "layout-vaultlayout--hidden-inset",
      "layout-vaultlayout--toast",
      "layout-vaultlayout--update",
      "app-vault--live-updates-disconnected",
    ]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      // No external images/services are needed for the sample-vault stories.
      await page.route("**/*", (route) =>
        new URL(route.request().url()).origin === origin || /^(data|blob):/.test(route.request().url())
          ? route.continue()
          : route.abort(),
      );
      const row = { width, story };
      try {
        await page.goto(`${origin}/iframe.html?id=${story}&viewMode=story&embed=true`, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForFunction(() => window.__STORYBOOK_PREVIEW__?.currentRender?.phase === "finished");
        if (story === "app-vault--live-updates-disconnected") {
          await page.getByRole("heading", { name: "Workbench", level: 2 }).waitFor();
          await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        }
        await page.locator("[data-app-banner]").first().waitFor({ state: "visible" });
        await page.evaluate(() => document.fonts.ready);
        // Finish all CSS/React transitions without a wall-clock sleep.
        await page.evaluate(() =>
          Promise.all(
            document.getAnimations().map((animation) => {
              animation.finish();
              return animation.finished;
            }),
          ),
        );
        const measurements = await page.evaluate(() => {
          const rect = (element) => {
            const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
            return { x, y, width, height, right, bottom };
          };
          const main = document.querySelector("main");
          const gutter = innerWidth >= 1024 ? 40 : innerWidth >= 768 ? 32 : 16;
          return {
            main: rect(main),
            gutter,
            overflow: document.documentElement.scrollWidth > innerWidth,
            titlebarBottom:
              document.querySelector("[data-native-titlebar]")?.getBoundingClientRect().bottom ?? 0,
            banners: [...document.querySelectorAll("[data-app-banner], [data-content-snackbar]")].map(
              (element) => ({
                ...rect(element),
                kind: element.hasAttribute("data-app-banner") ? "banner" : "snackbar",
                text: element.textContent,
                controls: [...element.querySelectorAll("button")].map(rect),
              }),
            ),
          };
        });
        Object.assign(row, measurements);
        const floatingNotice = story.endsWith("--toast") || story.endsWith("--update");
        const expectedBanners = story.startsWith("app-vault--") ? 1 : 3;
        assert.equal(
          measurements.banners.filter((banner) => banner.kind === "banner").length,
          expectedBanners,
          "expected global banner missing",
        );
        assert.equal(
          measurements.banners.filter((banner) => banner.kind === "snackbar").length,
          floatingNotice ? 1 : 0,
          "expected floating notice missing",
        );
        assert.equal(measurements.overflow, false, "document overflows horizontally");
        assert.equal(measurements.main.x, width >= 1024 ? 264 : 0, "unexpected content/sidebar boundary");
        for (const banner of measurements.banners) {
          assert.ok(
            banner.x >= measurements.main.x + measurements.gutter - 1,
            "notice under nav/outside left gutter",
          );
          assert.ok(
            banner.right <= measurements.main.right - measurements.gutter + 1,
            "notice outside right gutter",
          );
          assert.ok(
            banner.y >= Math.max(56, measurements.titlebarBottom),
            "notice under app/native titlebar",
          );
          assert.ok(banner.bottom <= 1000, "notice clipped by viewport");
          for (const control of banner.controls) {
            assert.ok(
              control.x >= banner.x && control.right <= banner.right + 1,
              "notice action clipped horizontally",
            );
            assert.ok(
              control.y >= banner.y && control.bottom <= banner.bottom + 1,
              "notice action clipped vertically",
            );
          }
        }
        assert.deepEqual(errors, [], "renderer error");
        const filename = `${story}-${width}.png`;
        const screenshot = await page.screenshot({
          path: path.join(evidence, filename),
          animations: "disabled",
        });
        const baseline = path.join(baselineDir, filename);
        if (update) await writeFile(baseline, screenshot);
        else if (!geometryOnly) {
          const actual = PNG.sync.read(screenshot);
          const expected = PNG.sync.read(await readFile(baseline));
          assert.equal(actual.width, expected.width);
          assert.equal(actual.height, expected.height);
          let changedPixels = 0;
          for (let pixel = 0; pixel < actual.data.length; pixel += 4) {
            // Ignore at most eight channel levels of rasterizer rounding noise;
            // layout shifts, clipping, missing text and palette changes fail.
            if (
              [0, 1, 2, 3].some(
                (channel) => Math.abs(actual.data[pixel + channel] - expected.data[pixel + channel]) > 8,
              )
            )
              changedPixels += 1;
          }
          row.changedPixels = changedPixels;
          assert.equal(changedPixels, 0, `visual regression: ${filename} differs from reviewed baseline`);
        }
        row.screenshot = filename;
        row.pass = true;
      } catch (error) {
        row.pass = false;
        row.error = error.message;
        row.body = (await page.locator("body").innerText()).slice(0, 2500);
        await page.screenshot({
          path: path.join(evidence, `${story}-${width}-failure.png`),
          animations: "disabled",
        });
      } finally {
        report.results.push(row);
        await page.close();
      }
    }
  }
} finally {
  await browser?.close();
  await stopOwned(owned.child);
  await owned.save();
  report.failures = report.results.filter((row) => !row.pass).length;
  await writeFile(path.join(evidence, "layout-report.json"), JSON.stringify(report, null, 2));
}
assert.equal(
  report.failures,
  0,
  `${report.failures} banner layout/visual regression failures; see layout-report.json`,
);
console.log(
  `PASS: ${report.results.length} banner ${geometryOnly ? "geometry regressions (pixels not compared)" : "viewport/visual regressions"}`,
);
