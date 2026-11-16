#!/usr/bin/env node
/** Production-only layout audit. Never builds/starts the app or reads a vault.
 * Node 22.22.2: node scripts/audit-site-layout.mjs EVIDENCE_DIR [--quick]
 * Snapshots existing site dist, serves an owned random loopback port, and closes it.
 * Full mode: all 13 locales x 5 routes x every integer CSS viewport width 320..1440.
 * The pixel sweep changes a same-origin iframe viewport and forces CSS layout at
 * every pixel (not a screenshot approximation); cold-load checks use real top-level
 * viewports, fresh contexts, disabled cache, and both saved/browser locale sources.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

assert.equal(process.version, "v22.22.2", "Use pinned Node 22.22.2");
assert.ok(process.argv[2], "Usage: node scripts/audit-site-layout.mjs EVIDENCE_DIR [--quick]");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.resolve(process.argv[2]);
const quick = process.argv.includes("--quick");
const allCodes = ["en", "es", "fr", "de", "it", "pt-BR", "nl", "pl", "ru", "ja", "ko", "zh-Hans", "zh-Hant"];
const selectedCodes = process.argv
  .find((arg) => arg.startsWith("--locales="))
  ?.slice(10)
  .split(",");
const codes = selectedCodes || allCodes;
assert.ok(
  codes.every((code) => allCodes.includes(code)),
  "Unknown locale",
);
const routes = ["/", "/docs/", "/phone/", "/faq/", "/download/"];
const widths = quick ? [320, 1440] : [320, 390, 640, 768, 1024, 1280, 1440];
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  quick,
  widths,
  cold: [],
  sweep: [],
  selection: [],
  failures: [],
  runtimeErrors: [],
};
await mkdir(evidence, { recursive: true });
const temporary = await mkdtemp(path.join(os.tmpdir(), "paintwarden-site-layout-"));
const snapshot = path.join(temporary, "site");
await cp(path.join(root, "apps/paintwarden-site/dist"), snapshot, { recursive: true });
report.indexSha256 = createHash("sha256")
  .update(await readFile(path.join(snapshot, "index.html")))
  .digest("hex");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
const server = createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (pathname === "/__layout_audit__") {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(
        '<!doctype html><html><body style="margin:0"><iframe style="display:block;border:0;height:900px" title="audit"></iframe></body></html>',
      );
      return;
    }
    let filename = path.resolve(snapshot, `.${pathname}`);
    if (filename !== snapshot && !filename.startsWith(`${snapshot}/`)) throw new Error("Invalid path");
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, "index.html");
    response.writeHead(200, {
      "Content-Type": types[path.extname(filename)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(await readFile(filename));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
function observe() {
  window.__layout = { shifts: [], errors: [] };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      window.__layout.shifts.push({
        value: entry.value,
        recentInput: entry.hadRecentInput,
        time: entry.startTime,
        sources: (entry.sources || []).map((source) => ({
          node: source.node?.outerHTML?.slice(0, 160),
          previous: source.previousRect.toJSON(),
          current: source.currentRect.toJSON(),
        })),
      });
  }).observe({ type: "layout-shift", buffered: true });
}
function geometry() {
  const width = document.documentElement.clientWidth;
  const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - width;
  const clipped = [];
  for (const element of document.querySelectorAll("body *")) {
    if (element.closest('[aria-hidden="true"],svg,style,script') || !element.getClientRects().length)
      continue;
    if (getComputedStyle(element).visibility !== "visible") continue;
    const text = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
    if (!text && !element.matches("img,input,button,[role=combobox]")) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width && (rect.left < -1 || rect.right > width + 1))
      clipped.push({
        tag: element.tagName,
        text: element.textContent.slice(0, 100),
        left: rect.left,
        right: rect.right,
      });
  }
  return {
    width,
    overflow,
    clipped,
    header: document.querySelector("header").getBoundingClientRect().toJSON(),
    picker: document.querySelector('[role="combobox"]').getBoundingClientRect().toJSON(),
    rawShift: window.__layout.shifts.reduce((sum, entry) => sum + entry.value, 0),
    cls: window.__layout.shifts
      .filter((entry) => !entry.recentInput)
      .reduce((sum, entry) => sum + entry.value, 0),
    shifts: window.__layout.shifts,
  };
}
async function ready(page, code) {
  await page.waitForFunction(
    (code) =>
      document.documentElement.lang === code &&
      !document.documentElement.hasAttribute("data-site-pending") &&
      document.querySelector("main h1"),
    code,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}
async function pause(page) {
  // A bounded observation window, not a process/job polling wait.
  await page.waitForTimeout(600);
}
async function save() {
  await writeFile(
    path.join(evidence, quick ? "quick-report.json" : "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
try {
  browser = await chromium.launch({ headless: true });
  // Each worker consumes a separate context; no browser profile/app/server is reused.
  const queue = codes.flatMap((code) => ["saved", "browser"].map((source) => ({ code, source })));
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const { code, source } = queue.shift();
        const context = await browser.newContext({
          locale: source === "browser" ? code : "en-US",
          reducedMotion: "reduce",
          serviceWorkers: "block",
        });
        await context.addInitScript(observe);
        if (source === "saved")
          await context.addInitScript((code) => localStorage.setItem("paintwarden-language", code), code);
        const page = await context.newPage();
        page.on("pageerror", (error) => report.runtimeErrors.push({ code, source, error: error.message }));
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        for (const route of routes) {
          for (const width of widths) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(`${origin}${route}`, { waitUntil: "load" });
            await ready(page, code);
            await page.evaluate(async () => {
              await Promise.all(
                [...document.images].map(async (image) => {
                  image.loading = "eager";
                  try {
                    await image.decode();
                  } catch {
                    /* Report layout independently of network errors. */
                  }
                }),
              );
            });
            await pause(page);
            const row = { code, source, route, ...(await page.evaluate(geometry)) };
            report.cold.push(row);
            if (row.overflow > 0 || row.clipped.length || row.rawShift !== 0)
              report.failures.push({
                phase: "cold",
                code,
                source,
                route,
                width,
                overflow: row.overflow,
                clipped: row.clipped,
                rawShift: row.rawShift,
              });
          }
          if (source !== "saved") continue;
          // Sweep the iframe's actual layout viewport, including all CSS media queries.
          await page.goto(`${origin}/__layout_audit__`);
          await page.evaluate((route) => {
            const frame = document.querySelector("iframe");
            frame.style.width = "1440px";
            frame.src = route;
          }, route);
          const frame = page.frames().find((frame) => frame !== page.mainFrame());
          await ready(frame, code);
          const sweep = await page.evaluate(
            ({ quick, widths }) => {
              const iframe = document.querySelector("iframe");
              const doc = iframe.contentDocument;
              const failures = [];
              let count = 0;
              for (let width = 320; width <= 1440; width++) {
                if (quick && !widths.includes(width)) continue;
                iframe.style.width = `${width}px`;
                const actual = doc.documentElement.clientWidth;
                const scroll = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth);
                if (actual !== width || scroll > width) failures.push({ width, actual, scroll });
                count++;
              }
              return { count, failures };
            },
            { quick, widths },
          );
          report.sweep.push({ code, route, ...sweep });
          if (sweep.failures.length) report.failures.push({ phase: "sweep", code, route, ...sweep });
        }
        // Real MUI language picker; measure raw shifts, not only input-excluded CLS.
        if (source === "saved") {
          for (const width of [320, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(`${origin}/`);
            await ready(page, code);
            const before = await page.evaluate(geometry);
            await page.getByRole("combobox").click();
            const next = code === "en" ? "de" : "en";
            const catalog = JSON.parse(
              await readFile(path.join(root, `packages/paint-i18n/locales/${next}/site.json`), "utf8"),
            );
            const names = { en: "English", de: "Deutsch" };
            await page.getByRole("option", { name: names[next], exact: true }).click();
            await ready(page, next);
            await pause(page);
            const after = await page.evaluate(geometry);
            const headerStable =
              before.header.height === after.header.height &&
              before.picker.x === after.picker.x &&
              before.picker.width === after.picker.width &&
              before.picker.height === after.picker.height;
            const row = { code, next, width, before, after, headerStable };
            row.translatedTitle = await page.title();
            assert.equal(row.translatedTitle, catalog["meta.homeTitle"]);
            report.selection.push(row);
            if (!headerStable || after.overflow > 0 || after.clipped.length || after.cls !== 0)
              report.failures.push({
                phase: "selection",
                code,
                width,
                headerStable,
                overflow: after.overflow,
                clipped: after.clipped,
                cls: after.cls,
              });
            // Reset storage explicitly before the next cold document.
            await page.evaluate((code) => localStorage.setItem("paintwarden-language", code), code);
          }
        }
        await context.close();
        console.log(`${code}/${source} complete; failures=${report.failures.length}`);
        await save();
      }
    }),
  );
  // JavaScript-disabled visitors get usable SSR, with no invisible-page gate.
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const noJsPage = await noJs.newPage();
  await noJsPage.goto(origin);
  report.noJavaScript = {
    heading: await noJsPage.locator("h1").innerText(),
    visible: await noJsPage.locator("h1").isVisible(),
  };
  assert.ok(report.noJavaScript.visible);
  await noJs.close();
  report.faults = [];
  for (const fault of ["fonts", "catalog", "javascript"]) {
    const context = await browser.newContext({ locale: "de", reducedMotion: "reduce" });
    await context.addInitScript(observe);
    const page = await context.newPage();
    if (fault === "fonts") await page.route("**/*.woff2", (route) => route.abort());
    if (fault === "catalog") await page.route("**/site.*.js", (route) => route.abort());
    if (fault === "javascript") await page.route("**/_astro/*.js", (route) => route.abort());
    await page.goto(origin);
    const expected = fault === "fonts" ? "de" : "en";
    await ready(page, expected);
    await pause(page);
    const result = {
      fault,
      language: await page.locator("html").getAttribute("lang"),
      visible: await page.locator("h1").isVisible(),
      ...(await page.evaluate(geometry)),
    };
    report.faults.push(result);
    assert.ok(result.visible, `${fault}: readiness gate must fail open`);
    assert.equal(result.rawShift, 0, `${fault}: no raw loading shift`);
    assert.equal(result.overflow, 0);
    await context.close();
  }
  report.finishedAt = new Date().toISOString();
  report.pass = report.failures.length === 0 && report.runtimeErrors.length === 0;
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await save();
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
console.log(
  JSON.stringify({
    pass: report.pass,
    cold: report.cold.length,
    sweep: report.sweep.length,
    selection: report.selection.length,
    failures: report.failures.length,
    error: report.error,
  }),
);
if (!report.pass) process.exitCode = 1;
