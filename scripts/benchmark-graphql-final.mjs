#!/usr/bin/env node
// Existing production artifact only; exact Phase0 synthetic rows, isolated loopback server.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";
import { createLibraryFixture } from "./library-fixture.mjs";
import { attachLibraryRecorder } from "./library-smoke-support.mjs";
import { root, sourceManifest } from "./graphql-phase4-support.mjs";
import {
  freePort,
  launchOwned,
  waitForOutput,
  stopOwned,
  fixtureCredentials,
  identity,
} from "./smoke-library-native.mjs";

assert.equal(process.version, "v22.22.2");
const [profile, output] = process.argv.slice(2);
assert.ok(["large", "stress"].includes(profile) && output, "large|stress EVIDENCE_DIR");
const dir = path.resolve(output);
await mkdir(dir, { recursive: true });
const report = {
  node: process.version,
  profile,
  startedAt: new Date().toISOString(),
  method:
    "Exact unchanged Phase0 synthetic rows, no focused probes. Existing production build, Chromium1440x1000. Fresh server+browser context for each of 3 default Home observations (cold derived cache, not cold disk). Per-screen first navigation in a fresh browser context after Home; server warmed by Home and prior screens. Browser navigation-relative performance clock to first real miniature tile plus two animation frames (injected MutationObserver, independent of recorder body parsing), plus 800ms completed API capture window for viewport prefetch. Bytes are decoded JSON bodies (not compressed transfer); open SSE, images, JS/CSS/fonts excluded from API bytes and separately resource-inventoried. Phase0 has no equivalent browser time baseline. RSS from ps includes runtime/JIT/cache, not heap attribution.",
  artifacts: [],
  defaultHome: [],
  screens: [],
  checks: [],
};
let browser;
const owned = [];
const raw = [];
const rss = (pid) =>
  Number(execFileSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8" }).trim()) * 1024;
const visibleHome = async (page, recorder) => {
  await page.getByRole("list", { name: "Miniature shelf", exact: true }).waitFor({ timeout: 30000 });
  await recorder.waitFor((entries) => entries.some((e) => e.data?.data?.home));
  await page.waitForFunction(
    () =>
      Number(document.querySelector('[aria-label="Miniature shelf"]')?.getAttribute("data-loaded-count")) > 0,
  );
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
};
const summarize = (entries) => ({
  completedApiBytes: entries.reduce((sum, e) => sum + (e.bytes ?? 0), 0),
  graphqlBytes: entries.filter((e) => e.path === "/api/graphql").reduce((sum, e) => sum + (e.bytes ?? 0), 0),
  requests: entries.map((e) => ({
    path: e.path,
    status: e.status,
    bytes: e.bytes,
    operation: e.body?.operationName,
    variables: e.body?.variables,
    durationMs: e.durationMs,
    roots: e.data?.data ? Object.keys(e.data.data) : undefined,
  })),
});
try {
  report.source = await sourceManifest();
  report.fixture = await createLibraryFixture(root, profile);
  report.phase0 = JSON.parse(
    await readFile(path.join(root, `docs/benchmarks/graphql-baseline-${profile}.json`), "utf8"),
  );
  const dist = path.join(root, "apps/paint-vault/dist");
  for (const file of ["server.mjs", "schema.graphql"])
    report.artifacts.push(await identity(path.join(dist, file)));
  for (const entry of await readdir(path.join(dist, "web-dist"), { recursive: true, withFileTypes: true }))
    if (entry.isFile()) report.artifacts.push(await identity(path.join(entry.parentPath, entry.name)));
  const port = await freePort(),
    host = `phase5-metrics-${profile}.localhost`,
    base = `http://${host}:${port}`;
  let server, token;
  browser = await chromium.launch({ headless: true, args: [`--host-resolver-rules=MAP ${host} 127.0.0.1`] });
  const start = async () => {
    server = launchOwned(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        'process.env.NODE_ENV="test";const {startServer}=await import("./server.mjs");process.env.NODE_ENV="production";await startServer();console.log("FINAL_METRICS_READY");',
      ],
      {
        cwd: dist,
        env: {
          ...process.env,
          NODE_ENV: "production",
          DATA_DIR: report.fixture.dataDir,
          DATABASE_PATH: "",
          HOST: "127.0.0.1",
          PORT: String(port),
          PAINT_VAULT_ALLOWED_HOSTS: host,
          PAINT_VAULT_DISABLE_UPDATES: "1",
        },
      },
      path.join(dir, `server-${owned.length}.log`),
    );
    owned.push(server);
    await waitForOutput(server, /FINAL_METRICS_READY/, "final metrics server");
  };
  const context = async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([
      { name: "pv_session", value: token, url: base, httpOnly: true, sameSite: "Strict" },
    ]);
    return context;
  };
  for (let sample = 0; sample < 3; sample++) {
    await start();
    if (!token) {
      const setup = await fetch(`http://127.0.0.1:${port}/api/auth/setup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fixtureCredentials),
      });
      assert.equal(setup.status, 200);
      ({ token } = await setup.json());
      assert.ok(token);
    }
    const beforeRss = rss(server.child.pid);
    const ctx = await context(),
      page = await ctx.newPage(),
      recorder = attachLibraryRecorder(page);
    await page.addInitScript((selector) => {
      const observer = new MutationObserver(() => {
        if (!document.querySelector(selector) || window.__benchmarkVisibleMs !== undefined) return;
        observer.disconnect();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            window.__benchmarkVisibleMs = performance.now();
          }),
        );
      });
      observer.observe(document, { childList: true, subtree: true });
    }, "[data-miniature-index]");
    await page.goto(base);
    await visibleHome(page, recorder);
    await page.waitForFunction(() => window.__benchmarkVisibleMs !== undefined);
    const visibleMs = await page.evaluate(() => window.__benchmarkVisibleMs);
    await page.waitForTimeout(800);
    await recorder.settle();
    const entry = {
      sample,
      elapsedToVisibleDataMs: visibleMs,
      rssBeforeBrowser: beforeRss,
      rssAfterHome: rss(server.child.pid),
      ...summarize(recorder.requests),
      loaded: await page
        .getByRole("list", { name: "Miniature shelf", exact: true })
        .getAttribute("data-loaded-count"),
      resources: await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .filter((e) => !e.name.includes("/api/"))
          .map((e) => ({
            url: new URL(e.name).pathname,
            type: e.initiatorType,
            transferSize: e.transferSize,
            encodedBodySize: e.encodedBodySize,
            decodedBodySize: e.decodedBodySize,
          })),
      ),
    };
    raw.push({ label: `home-${sample}`, requests: recorder.requests, errors: recorder.errors });
    assert.deepEqual(recorder.errors, []);
    assert.ok(recorder.requests.some((e) => e.path === "/api/graphql/stream" && e.status === 200));
    report.defaultHome.push(entry);
    await ctx.close();
    await stopOwned(server.child);
    await server.save();
  }
  await start();
  const screens = [
    ["Miniatures", "Miniatures", "miniatures"],
    ["Paints", "Paints", "library"],
    ["Wishlist", "Wishlist", "wishlist"],
    ["Schemes", "Schemes", "schemes"],
    ["Templates", "Miniature templates", "templates"],
    ["Paint Tools", "Paint Tools", null],
    ["Data & settings", "Data & settings", null],
    ["Plugins", "Plugins", "sources"],
  ];
  for (const [name, heading, field] of screens) {
    const ctx = await context(),
      page = await ctx.newPage(),
      recorder = attachLibraryRecorder(page);
    await page.goto(base);
    await visibleHome(page, recorder);
    await page.waitForTimeout(300);
    await recorder.settle();
    let mark = recorder.mark();
    const started = performance.now();
    const settings = () =>
      page
        .getByRole("button", { name: /Data & settings$/ })
        .first()
        .click();
    if (name === "Plugins") {
      await settings();
      await page.getByRole("heading", { name: "Data & settings", exact: true, level: 2 }).waitFor();
      await recorder.settle();
      mark = recorder.mark();
      await page.getByRole("button", { name: "Manage plugins", exact: true }).click();
      await page.getByRole("dialog", { name: "Plugins", exact: true }).waitFor();
    } else {
      const button =
        name === "Data & settings"
          ? page.getByRole("button", { name: /Data & settings$/ })
          : ["Paints", "Wishlist"].includes(name)
            ? page.getByRole("button", { name: new RegExp(`^${name}(?:\\s|$)`) })
            : page.getByRole("button", { name, exact: true });
      await button.first().click();
      await page.getByRole("heading", { name: heading, exact: true, level: 2 }).waitFor({ timeout: 30000 });
    }
    if (field) await recorder.waitFor((entries) => entries.some((e) => e.data?.data?.[field]), mark);
    const elapsedMs = performance.now() - started;
    await page.waitForTimeout(800);
    await recorder.settle();
    const entries = recorder.slice(mark);
    report.screens.push({
      name,
      elapsedToHeadingAndFirstProjectionMs: elapsedMs,
      ...summarize(entries),
      rss: rss(server.child.pid),
    });
    raw.push({ label: name, requests: recorder.requests, errors: recorder.errors });
    assert.deepEqual(recorder.errors, []);
    await page.screenshot({
      path: path.join(dir, `${profile}-${name.replaceAll(/[^a-z0-9]/gi, "-")}.png`),
      animations: "disabled",
    });
    await ctx.close();
  }
  const requests = raw.flatMap((r) => r.requests);
  assert.deepEqual(
    requests.filter((e) => ["/api/state", "/api/changes"].includes(e.path)),
    [],
  );
  assert.deepEqual(
    requests.filter((e) => e.data?.errors?.length || e.status >= 500 || e.readError),
    [],
  );
  report.checks.push({ name: "Every measurement recording error-free and snapshot-free", status: "PASS" });
  report.sourceAfter = await sourceManifest();
  assert.equal(
    report.source.manifestSha256,
    report.sourceAfter.manifestSha256,
    "Source must stay stable during final metrics",
  );
  for (const artifact of report.artifacts)
    assert.equal((await identity(artifact.path)).sha256, artifact.sha256);
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const item of owned) {
    await stopOwned(item.child);
    await item.save();
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(dir, `${profile}-raw.json`), JSON.stringify(raw, null, 2) + "\n");
  await writeFile(path.join(dir, `${profile}-final.json`), JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        result: report.result,
        error: report.error,
        home: report.defaultHome.map((e) => ({ ms: e.elapsedToVisibleDataMs, bytes: e.completedApiBytes })),
        screens: report.screens.map((e) => ({ name: e.name, bytes: e.completedApiBytes })),
      },
      null,
      2,
    ),
  );
}
