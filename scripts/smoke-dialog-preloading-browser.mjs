#!/usr/bin/env node
// Production Chromium checks. Fresh synthetic vault + owned random-port server;
// hold actual lazy entry requests, not test substitutes or the user's server.
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { init, parse } from "es-module-lexer";
import { chromium } from "playwright";

import { createLibraryFixture } from "./library-fixture.mjs";
import {
  fixtureCredentials,
  freePort,
  launchOwned,
  stopOwned,
  waitForOutput,
} from "./smoke-library-native.mjs";

assert.equal(process.version, "v22.22.2");
const root = path.resolve(import.meta.dirname, "..");
const evidence = process.argv[2];
assert.ok(evidence, "Provide an evidence directory");
await mkdir(evidence, { recursive: true });
const web = path.join(root, "apps/paint-vault-web/dist");
const assetNames = await readdir(path.join(web, "assets"));
const entries = Object.fromEntries(
  Object.entries({
    paint: "PaintForm-",
    miniature: "MiniatureForm-",
    schemes: "ColorSchemesDialog-",
    plugins: "PluginsModal-",
    project: "ApolloProjectDrawer-",
  }).map(([kind, prefix]) => {
    const entry = assetNames.find((name) => name.startsWith(prefix) && name.endsWith(".js"));
    assert.ok(entry, `Missing split ${kind} chunk`);
    return [kind, `/assets/${entry}`];
  }),
);
const fixture = await createLibraryFixture(root, "large");
const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const report = {
  measuredAt: new Date().toISOString(),
  fixture,
  origin,
  web,
  entries,
  checks: [],
  errors: [],
};
const server = launchOwned(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    'process.env.NODE_ENV="test";const {startServer}=await import("./server.mjs");process.env.NODE_ENV="production";await startServer();console.log("DIALOG_SMOKE_READY");',
  ],
  {
    cwd: path.join(root, "apps/paint-vault/dist"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATA_DIR: fixture.dataDir,
      DATABASE_PATH: "",
      HOST: "127.0.0.1",
      PORT: String(port),
      WEB_DIST: web,
      PAINT_VAULT_ALLOWED_HOSTS: "",
      PAINT_VAULT_DISABLE_UPDATES: "1",
    },
  },
  path.join(evidence, "browser-server.log"),
);
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
let browser;
let token;
async function fresh({ width = 1440, saveData = true, reducedMotion = "reduce" } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    locale: "en-US",
    reducedMotion,
    serviceWorkers: "block",
  });
  await context.addCookies([
    { name: "pv_session", value: token, url: origin, httpOnly: true, sameSite: "Strict" },
  ]);
  await context.addInitScript(
    ({ saveData }) => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData, effectiveType: "4g" },
      });
      window.__dialogSmoke = { idle: [] };
      const idle = window.requestIdleCallback?.bind(window);
      if (idle)
        window.requestIdleCallback = (callback, options) => {
          window.__dialogSmoke.idle.push({
            scheduled: performance.now(),
            pageSkeleton: Boolean(document.querySelector('[data-skeleton="home"]')),
          });
          return idle((deadline) => {
            window.__dialogSmoke.idle.at(-1).ran = performance.now();
            callback(deadline);
          }, options);
        };
    },
    { saveData },
  );
  const page = await context.newPage();
  const requests = [];
  page.on("request", (request) => {
    if (Object.values(entries).some((entry) => request.url().endsWith(entry)))
      requests.push({ path: new URL(request.url()).pathname, at: Date.now() });
  });
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`);
  });
  return { context, page, requests };
}
async function ready(page) {
  await page.locator("main .MuiCardActionArea-root").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function openControl(page, kind) {
  if (kind === "miniature") return page.getByRole("button", { name: /Add miniature/ }).first();
  if (kind === "project") return page.locator("main .MuiCardActionArea-root").first();
  if (kind === "plugins") {
    await page.getByRole("button", { name: /Data & settings/ }).click();
    return page.getByRole("button", { name: "Manage plugins", exact: true });
  }
  await page.getByRole("button", { name: "More add options", exact: true }).click();
  return page.getByRole("menuitem", { name: kind === "paint" ? "Add paint" : "Add scheme", exact: true });
}
async function narrowNavigation(page, width, kind) {
  if (width < 1024 && ["paint", "schemes", "plugins"].includes(kind))
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
}
async function assertNoCodeFallback(page, action) {
  await page.evaluate(() => {
    window.__codeFallbacks = [];
    window.__codeObserver = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches("[data-dialog-code-loading]"))
            window.__codeFallbacks.push(node.getAttribute("data-dialog-code-loading"));
          node
            .querySelectorAll("[data-dialog-code-loading]")
            .forEach((marker) =>
              window.__codeFallbacks.push(marker.getAttribute("data-dialog-code-loading")),
            );
        }
    });
    window.__codeObserver.observe(document.body, { childList: true, subtree: true });
  });
  await action();
  await page.getByRole("dialog").last().waitFor();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const fallbacks = await page.evaluate(() => {
    window.__codeObserver.disconnect();
    return window.__codeFallbacks;
  });
  assert.deepEqual(fallbacks, [], "A fulfilled preload must never mount the code fallback");
}
try {
  await waitForOutput(server, /DIALOG_SMOKE_READY/, "isolated production server");
  const setup = await fetch(`${origin}/api/auth/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fixtureCredentials),
  });
  assert.equal(setup.status, 200);
  ({ token } = await setup.json());
  browser = await chromium.launch({ headless: true });

  // The HTML's transitive static graph must not contain any dialog entry.
  await init;
  const html = await readFile(path.join(web, "index.html"), "utf8");
  const roots = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((match) => match[1]);
  const graph = new Set();
  async function visit(asset) {
    const normalized = asset.startsWith("/") ? asset : `/${asset.replace(/^\.\//, "")}`;
    if (graph.has(normalized)) return;
    graph.add(normalized);
    const source = await readFile(path.join(web, normalized), "utf8");
    const [imports] = parse(source);
    for (const item of imports)
      if (item.d === -1 && item.n?.endsWith(".js"))
        await visit(path.posix.join(path.posix.dirname(normalized), item.n));
  }
  for (const entry of roots) await visit(entry);
  for (const entry of Object.values(entries))
    assert.ok(!graph.has(entry), `Dialog entered startup graph: ${entry}`);
  const bytes = await Promise.all(
    [...graph].map(async (asset) => {
      const source = await readFile(path.join(web, asset));
      return { asset, bytes: source.length, gzip: gzipSync(source).length };
    }),
  );
  report.checks.push({
    name: "lazy-startup-graph",
    status: "PASS",
    staticGraph: bytes,
    initialGzip: bytes.reduce((sum, file) => sum + file.gzip, 0),
    note: "Exact before/after startup byte comparison is in the coordinator's bundle report; this checks split boundaries.",
  });

  // Hold the first screen's actual data query. No code preload may start yet.
  {
    const { context, page, requests } = await fresh({ saveData: false });
    const query = deferred();
    const release = deferred();
    await page.route("**/api/graphql", async (route) => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.operationName === "MiniatureList") {
        query.resolve();
        await release.promise;
      }
      await route.continue();
    });
    await page.goto(origin);
    await query.promise;
    assert.equal(requests.length, 0);
    assert.equal((await page.evaluate(() => window.__dialogSmoke.idle)).length, 0);
    const responses = Object.values(entries).map((entry) =>
      page.waitForResponse((response) => response.url().endsWith(entry)),
    );
    release.resolve();
    await ready(page);
    await page.waitForFunction(() => window.__dialogSmoke.idle.some((event) => event.ran));
    await Promise.all(responses);
    const idle = await page.evaluate(() => window.__dialogSmoke.idle);
    assert.ok(idle.every((event) => !event.pageSkeleton));
    for (const entry of Object.values(entries))
      assert.equal(requests.filter((request) => request.path === entry).length, 1);
    report.checks.push({ name: "idle-after-first-screen-once", status: "PASS", idle, requests });
    await context.close();
  }

  for (const width of [1440, 390])
    for (const kind of Object.keys(entries)) {
      const { context, page, requests } = await fresh({ width });
      const requested = deferred();
      const release = deferred();
      const finished = deferred();
      await page.route(`**${entries[kind]}`, async (route) => {
        requested.resolve();
        await release.promise;
        await route.continue();
      });
      page.on("requestfinished", (request) => {
        if (request.url().endsWith(entries[kind])) finished.resolve();
      });
      await page.goto(origin);
      await ready(page);
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      assert.equal(requests.length, 0, "Save-Data skips idle imports");
      assert.equal((await page.evaluate(() => window.__dialogSmoke.idle)).length, 0);
      await narrowNavigation(page, width, kind);
      let control = await openControl(page, kind);
      // Native click bypasses hover to exercise the genuinely cold render path.
      await control.evaluate((element) => element.click());
      await requested.promise;
      await page.locator(`[data-dialog-code-loading="${kind}"]`).waitFor({ state: "attached" });
      const dialog = page.getByRole("dialog").last();
      await dialog.waitFor();
      const name =
        (await dialog.getAttribute("aria-label")) ?? (await dialog.getAttribute("aria-labelledby"));
      assert.ok(name, `${kind} has a name`);
      assert.equal(await dialog.getByRole("status").count(), 1);
      assert.equal(await dialog.getByRole("status").getAttribute("aria-live"), "polite");
      assert.ok((await dialog.locator('[aria-busy="true"]').count()) > 0);
      const animations = await dialog.locator(".MuiSkeleton-root").evaluateAll((shapes) =>
        shapes.map((shape) => ({
          hidden: shape.getAttribute("aria-hidden"),
          animation: getComputedStyle(shape).animationName,
        })),
      );
      assert.ok(animations.length > 0);
      assert.ok(animations.every((shape) => shape.hidden === "true" && shape.animation === "none"));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflow, false);
      const screenshot = `browser-${width}-${kind}-loading.png`;
      await page.screenshot({ path: path.join(evidence, screenshot), animations: "disabled" });
      await page.keyboard.press("Escape");
      await page.locator("[data-dialog-code-loading]").waitFor({ state: "detached" });
      release.resolve();
      await finished.promise;
      // Module evaluation is sequenced by a dynamic import of the exact same URL.
      await page.evaluate((entry) => import(entry), entries[kind]);
      await narrowNavigation(page, width, kind);
      control = await openControl(page, kind);
      await assertNoCodeFallback(page, () => control.evaluate((element) => element.click()));
      assert.equal(requests.filter((request) => request.path === entries[kind]).length, 1);
      report.checks.push({
        name: "cold-delay-accessibility-escape-reduced-motion-and-warm-open",
        status: "PASS",
        width,
        kind,
        screenshot,
        requests,
        animations: animations.length,
      });
      await context.close();
    }

  // Exercise actual intent-bearing controls before click, with fresh module caches.
  for (const [kind, event] of [
    ["miniature", "hover"],
    ["paint", "focus"],
    ["schemes", "pointerdown"],
    ["plugins", "hover"],
    ["project", "focus"],
  ]) {
    const { context, page, requests } = await fresh();
    await page.goto(origin);
    await ready(page);
    const response = page.waitForResponse((response) => response.url().endsWith(entries[kind]));
    const control = await openControl(page, kind);
    if (event === "hover") await control.hover();
    else if (event === "focus") await control.focus();
    else await control.dispatchEvent("pointerdown");
    await response;
    await page.evaluate((entry) => import(entry), entries[kind]);
    await control.hover();
    await control.focus();
    await control.dispatchEvent("pointerdown");
    await assertNoCodeFallback(page, () => control.evaluate((element) => element.click()));
    assert.equal(requests.filter((request) => request.path === entries[kind]).length, 1);
    report.checks.push({
      name: "intent-preload-once-and-no-fallback",
      status: "PASS",
      kind,
      event,
      requests,
    });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await browser?.close();
  await server.save();
  await stopOwned(server.child);
  await writeFile(path.join(evidence, "browser-results.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      checks: report.checks.length,
      errors: report.errors.length,
      failure: report.failure ?? null,
    }),
  );
}
