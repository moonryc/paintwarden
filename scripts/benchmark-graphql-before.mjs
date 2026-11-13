#!/usr/bin/env node
// Reconstruct pre-migration browser launch from an explicit private git-archive build.
// Never checks out a revision, builds, touches a dev server, or reuses a personal vault.
import assert from "node:assert/strict";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
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
const [profile, baselineTree, output] = process.argv.slice(2);
assert.ok(
  ["large", "stress"].includes(profile) && baselineTree && output,
  "large|stress PRIVATE_BASELINE_TREE EVIDENCE_DIR",
);
const baseline = path.resolve(baselineTree),
  dir = path.resolve(output);
assert.notEqual(baseline, root);
assert.equal(
  execFileSync("git", ["rev-parse", "ea86dd1"], { cwd: root, encoding: "utf8" }).trim().length,
  40,
);
await mkdir(dir, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  profile,
  node: process.version,
  reconstructedRevision: execFileSync("git", ["rev-parse", "ea86dd1"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  baselineTree: baseline,
  method:
    "Newly reconstructed pre-migration main@ea86dd1 private git archive, not the original Phase0 run. Locked clean install and clean web/server builds supplied explicitly. Exact unchanged synthetic Phase0 seed rows. Three new server+Chromium1440x1000 contexts, cold process derived state but not cold disk. Browser navigation-relative performance clock to first real miniature tile plus two animation frames (injected MutationObserver, independent of recorder body parsing). 800ms completed API capture window after visible tile. Bytes decoded JSON, excluding open streams/assets. Unlike the canonical Phase0 in-process timings, these browser observations can be compared to final browser launch with the same harness conditions. Does not isolate individual source changes or prove remote performance.",
  artifacts: [],
  defaultHome: [],
};
const owned = [],
  raw = [];
let browser;
try {
  report.source = await sourceManifest();
  report.fixture = await createLibraryFixture(root, profile);
  const dist = path.join(baseline, "apps/paint-vault/dist");
  report.artifacts.push(await identity(path.join(dist, "server.mjs")));
  for (const entry of await readdir(path.join(dist, "web-dist"), { recursive: true, withFileTypes: true }))
    if (entry.isFile()) report.artifacts.push(await identity(path.join(entry.parentPath, entry.name)));
  const port = await freePort(),
    host = `phase5-before-${profile}.localhost`,
    base = `http://${host}:${port}`;
  browser = await chromium.launch({ headless: true, args: [`--host-resolver-rules=MAP ${host} 127.0.0.1`] });
  let token;
  for (let sample = 0; sample < 3; sample++) {
    const server = launchOwned(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        'process.env.NODE_ENV="test";const {startServer}=await import("./server.mjs");process.env.NODE_ENV="production";await startServer();console.log("BEFORE_METRICS_READY");',
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
        },
      },
      path.join(dir, `server-${sample}.log`),
    );
    owned.push(server);
    await waitForOutput(server, /BEFORE_METRICS_READY/, "pre-migration metrics server");
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
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([
      { name: "pv_session", value: token, url: base, httpOnly: true, sameSite: "Strict" },
    ]);
    const page = await context.newPage();
    // The old stress response is ~45MB, larger than Chromium's default per-resource
    // inspector cache. Enlarge observation buffers, not application/cache behavior.
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable", {
      maxResourceBufferSize: 100 * 1024 * 1024,
      maxTotalBufferSize: 300 * 1024 * 1024,
    });
    let snapshotRequestId;
    cdp.on("Network.responseReceived", (event) => {
      if (new URL(event.response.url).pathname === "/api/state") snapshotRequestId = event.requestId;
    });
    const recorder = attachLibraryRecorder(page);
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
    }, "[data-mini-index]");
    await page.goto(base);
    await page.getByRole("heading", { name: "Workbench", exact: true, level: 2 }).waitFor({ timeout: 30000 });
    await recorder.waitFor((entries) => entries.some((e) => e.path === "/api/state" && e.status === 200));
    await page.locator("[data-mini-index]").first().waitFor({ timeout: 30000 });
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await page.waitForFunction(() => window.__benchmarkVisibleMs !== undefined);
    const elapsedToVisibleDataMs = await page.evaluate(() => window.__benchmarkVisibleMs);
    await page.waitForTimeout(800);
    await recorder.settle();
    // Playwright's independent default inspector cache can still evict the huge
    // resource. Recover only from this exact successful resource in our enlarged
    // CDP buffer; retain the original diagnostic transparently in raw evidence.
    for (const entry of recorder.requests) {
      if (entry.path === "/api/state" && entry.status === 200 && entry.readError) {
        assert.match(entry.readError, /evicted from inspector cache/);
        assert.ok(snapshotRequestId);
        const captured = await cdp.send("Network.getResponseBody", { requestId: snapshotRequestId });
        entry.bytes = Buffer.byteLength(captured.body, captured.base64Encoded ? "base64" : "utf8");
        entry.observationDiagnostic = entry.readError;
        entry.observationRecovery =
          "Exact same resource captured by independently enlarged CDP Network buffer";
        delete entry.readError;
      }
    }
    assert.deepEqual(recorder.errors, []);
    assert.deepEqual(
      recorder.requests.filter((e) => e.status >= 400 || e.readError),
      [],
    );
    report.defaultHome.push({
      sample,
      elapsedToVisibleDataMs,
      completedApiBytes: recorder.requests.reduce((sum, e) => sum + (e.bytes ?? 0), 0),
      snapshotBytes: recorder.requests
        .filter((e) => e.path === "/api/state")
        .reduce((sum, e) => sum + (e.bytes ?? 0), 0),
      rssAfterHome:
        Number(
          execFileSync("ps", ["-o", "rss=", "-p", String(server.child.pid)], { encoding: "utf8" }).trim(),
        ) * 1024,
      requests: recorder.requests.map((e) => ({
        path: e.path,
        status: e.status,
        bytes: e.bytes,
        durationMs: e.durationMs,
      })),
    });
    raw.push({ sample, requests: recorder.requests, errors: recorder.errors });
    if (!sample)
      await page.screenshot({ path: path.join(dir, `${profile}-before-home.png`), animations: "disabled" });
    await context.close();
    await stopOwned(server.child);
    await server.save();
  }
  for (const artifact of report.artifacts)
    assert.equal((await identity(artifact.path)).sha256, artifact.sha256);
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const server of owned) {
    await stopOwned(server.child);
    await server.save();
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(dir, `${profile}-before.json`), JSON.stringify(report, null, 2) + "\n");
  await writeFile(path.join(dir, `${profile}-before-raw.json`), JSON.stringify(raw, null, 2) + "\n");
  console.log(
    JSON.stringify({ result: report.result, error: report.error, home: report.defaultHome }, null, 2),
  );
}
