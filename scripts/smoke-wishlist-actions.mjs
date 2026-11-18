#!/usr/bin/env node
// Isolated sample-vault Storybook only: never connects to a real server or profile.
// Capture before: EVIDENCE --capture-only
// Seed reviewed pixels: EVIDENCE --update-baselines; replay: EVIDENCE
// CI across platforms: EVIDENCE --geometry-only (palette, contrast, axe and geometry).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { PNG } from "pngjs";

import { freePort, launchOwned, waitForOutput, stopOwned } from "./smoke-library-native.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
assert.ok(args[0] && !args[0].startsWith("--"), "Pass an evidence directory");
const evidence = path.resolve(args[0]);
const capture = args.includes("--capture-only");
const update = args.includes("--update-baselines");
const geometryOnly = args.includes("--geometry-only");
const baselines = path.join(evidence, "baselines");
await mkdir(evidence, { recursive: true });
if (update) await mkdir(baselines, { recursive: true });
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
const report = { captureOnly: capture, results: [] };
let browser;
try {
  await waitForOutput(owned, /Local:|Storybook.*started/, "isolated Storybook", 60000);
  browser = await chromium.launch({ headless: true });
  for (const width of [320, 360, 390, 714, 768, 1024, 1280, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 300 }, reducedMotion: "reduce" });
    const origin = `http://127.0.0.1:${port}`;
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin || /^(data|blob):/.test(route.request().url())
        ? route.continue()
        : route.abort(),
    );
    try {
      await page.goto(`${origin}/iframe.html?id=components-wishlistpaintrow--project-actions&viewMode=story`);
      await page.waitForFunction(() => window.__STORYBOOK_PREVIEW__?.currentRender?.phase === "finished");
      await page.evaluate(() => document.fonts.ready);
      await page.addScriptTag({ path: createRequire(import.meta.url).resolve("axe-core/axe.min.js") });
      // Disable only animation, not interaction states, for deterministic screenshots.
      await page.addStyleTag({
        content: "*, *::before, *::after { transition: none !important; animation: none !important; }",
      });
      const buttons = [
        page.getByRole("button", { name: "Used in 1 project", exact: true }),
        page.getByRole("button", { name: "Mark Antique Gold as bought", exact: true }),
        page.getByRole("button", { name: "Remove Antique Gold from wishlist", exact: true }),
      ];
      const initial = await page.locator("#storybook-root li").boundingBox();
      const rects = await Promise.all(buttons.map((button) => button.boundingBox()));
      for (const state of [
        "rest",
        "count-hover",
        "count-pressed",
        "count-focus",
        "add-hover",
        "remove-hover",
      ]) {
        await page.mouse.move(width - 1, 290);
        await page.evaluate(() => document.activeElement?.blur());
        const index = state.startsWith("add") ? 1 : state.startsWith("remove") ? 2 : 0;
        if (state.endsWith("focus")) {
          // Actual keyboard focus, not a forced CSS class.
          await page.locator("#storybook-root li button").first().focus();
          await page.keyboard.press("Tab");
          assert.equal(await buttons[0].evaluate((button) => button.matches(":focus-visible")), true);
        } else if (state !== "rest") await buttons[index].hover();
        if (state.endsWith("pressed")) await page.mouse.down();
        const result = await page.evaluate(async () => {
          const rect = (element) => {
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height };
          };
          const token = (name) => {
            const span = document.createElement("span");
            span.style.color = `var(--${name})`;
            document.body.append(span);
            const color = getComputedStyle(span).color;
            span.remove();
            return color;
          };
          const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
          const luminance = (color) => {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
            return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).reduce((sum, byte, i) => {
              const channel = byte / 255;
              return (
                sum +
                (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) *
                  [0.2126, 0.7152, 0.0722][i]
              );
            }, 0);
          };
          const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          const actions = [...document.querySelectorAll("#storybook-root li button")]
            .slice(-3)
            .map((button) => {
              const style = getComputedStyle(button);
              return {
                rect: rect(button),
                color: style.color,
                contrast: contrast(luminance(style.color), luminance(style.backgroundColor)),
                background: style.backgroundColor,
                border: style.borderColor,
                outline: style.outlineColor,
                outlineWidth: style.outlineWidth,
              };
            });
          const axe = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] });
          return {
            actions,
            palette: { info: token("sky"), add: token("ok"), remove: token("rust"), rest: token("ink-soft") },
            overflow: document.documentElement.scrollWidth > innerWidth,
            violations: axe.violations.map(({ id, nodes }) => ({
              id,
              targets: nodes.map((node) => node.target),
            })),
          };
        });
        const row = { width, state, ...result };
        if (!capture) {
          assert.equal(result.overflow, false, "horizontal overflow");
          assert.deepEqual(result.violations, [], "axe WCAG AA violations");
          assert.deepEqual(await page.locator("#storybook-root li").boundingBox(), initial, "row shifted");
          assert.deepEqual(
            await Promise.all(buttons.map((button) => button.boundingBox())),
            rects,
            "action geometry shifted",
          );
          for (const [actionIndex, action] of result.actions.entries()) {
            assert.equal(action.rect.width, width < 768 ? 40 : 32);
            // Count is small text (AA 4.5:1); + and × are SVG icons (AA non-text 3:1).
            const minimum = actionIndex === 0 ? 4.5 : 3;
            assert.ok(
              action.contrast >= minimum,
              `${state}: action contrast ${action.contrast} below AA ${minimum}`,
            );
          }
          if (state !== "rest") {
            const action = result.actions[index];
            const color = result.palette[index === 0 ? "info" : index === 1 ? "add" : "remove"];
            assert.equal(action.color, color, `${state}: incorrect semantic color`);
            assert.equal(action.border, color, `${state}: incorrect border`);
            if (state.endsWith("focus")) {
              assert.equal(action.outline, color);
              assert.equal(action.outlineWidth, "2px");
            }
          } else for (const action of result.actions) assert.equal(action.color, result.palette.rest);
        }
        const filename = `${width}-${state}.png`;
        const screenshot = await page
          .locator("#storybook-root ul")
          .screenshot({ path: path.join(evidence, filename), animations: "disabled" });
        if (update) await writeFile(path.join(baselines, filename), screenshot);
        else if (!capture && !geometryOnly) {
          const expected = PNG.sync.read(await readFile(path.join(baselines, filename)));
          const actual = PNG.sync.read(screenshot);
          assert.equal(actual.width, expected.width);
          assert.equal(actual.height, expected.height);
          let changed = 0;
          for (let i = 0; i < actual.data.length; i += 4)
            if ([0, 1, 2, 3].some((c) => Math.abs(actual.data[i + c] - expected.data[i + c]) > 8)) changed++;
          row.changedPixels = changed;
          assert.equal(changed, 0, `visual regression: ${filename}`);
        }
        report.results.push(row);
        if (state.endsWith("pressed")) await page.mouse.up();
      }
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  await stopOwned(owned.child);
  await owned.save();
  await writeFile(path.join(evidence, "report.json"), JSON.stringify(report, null, 2));
}
console.log(`${capture ? "CAPTURE" : "PASS"}: ${report.results.length} wishlist action states`);
