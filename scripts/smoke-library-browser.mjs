#!/usr/bin/env node
// node scripts/smoke-library-browser.mjs large EVIDENCE_DIR [WEB_DIST]
// Pinned Node. Fresh synthetic fixture, fresh Chromium context, owned random-port server.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";
import { createLibraryFixture } from "./library-fixture.mjs";
import { attachLibraryRecorder, libraryReads, runLibraryScenario } from "./library-smoke-support.mjs";
import {
  freePort,
  launchOwned,
  waitForOutput,
  stopOwned,
  fixtureCredentials,
  independentWriter,
} from "./smoke-library-native.mjs";

assert.equal(process.version, "v22.22.2");
const root = fileURLToPath(new URL("..", import.meta.url));
const profile = process.argv[2] ?? "large";
assert.ok(
  process.argv[3],
  "Usage: node scripts/smoke-library-browser.mjs large|stress EVIDENCE_DIR [WEB_DIST]",
);
const evidence = path.resolve(process.argv[3]);
await mkdir(evidence, { recursive: true });
const webDist = path.resolve(process.argv[4] ?? path.join(root, "apps/paintwarden-web/dist"));
const fixture = await createLibraryFixture(root, profile);
const port = await freePort();
const host = "phase2-library.localhost";
const base = `http://${host}:${port}`;
const serverBase = `http://127.0.0.1:${port}`;
const report = {
  measuredAt: new Date().toISOString(),
  node: process.version,
  profile,
  fixture,
  base,
  webDist,
  checks: [],
};
const server = launchOwned(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    'process.env.NODE_ENV="test"; const {startServer}=await import("./server.mjs"); process.env.NODE_ENV="production"; await startServer(); console.log("PHASE2_READY_LISTENING");',
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
      WEB_DIST: webDist,
      PAINTWARDEN_ALLOWED_HOSTS: host,
      PAINTWARDEN_DISABLE_UPDATES: "1",
    },
  },
  path.join(evidence, `${profile}-server.log`),
);
let browser, page, recorder;
try {
  await waitForOutput(server, /PHASE2_READY_LISTENING/, "isolated production server listening");
  const setup = await fetch(`${serverBase}/api/auth/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fixtureCredentials),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(setup.status, 200);
  const { token } = await setup.json();
  browser = await chromium.launch({ headless: true, args: [`--host-resolver-rules=MAP ${host} 127.0.0.1`] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([
    { name: "pv_session", value: token, url: base, httpOnly: true, sameSite: "Strict" },
  ]);
  page = await context.newPage();
  recorder = attachLibraryRecorder(page);
  const result = await runLibraryScenario({
    page,
    recorder,
    evidenceDir: evidence,
    label: profile,
    initialNavigate: () => page.goto(`${base}/#paints`),
    secondClientWrite: await independentWriter(serverBase),
  });
  report.checks.push(...result.checks);
  report.metrics = result.metrics;

  // Warm derived cache, fresh document/React tree; same browser HTTP cache.
  const warmMark = recorder.mark();
  const warmStart = performance.now();
  await page.goto(`${base}/#paints`);
  await page.reload();
  await page.getByRole("list", { name: "Paint library", exact: true }).waitFor();
  await recorder.waitFor((entries) => libraryReads(entries).length > 0, warmMark);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  report.metrics.warmDocumentLibraryMs = performance.now() - warmStart;
  assert.ok(!recorder.slice(warmMark).some((entry) => entry.path === "/api/state"));
  report.checks.push({
    status: "PASS",
    name: "Fresh Library document with warm server cache avoids snapshot",
    evidence: { elapsedMs: report.metrics.warmDocumentLibraryMs },
  });

  // Represent an imported empty recipe: REST correctly refuses creating one, so inject
  // only into this newly-created synthetic SQLite fixture, never a caller-supplied path.
  const candidate = libraryReads(recorder.slice(warmMark))[0].data.data.library.nodes.find(
    (node) => node.inventory?.quantity > 0,
  );
  assert.ok(candidate);
  const require = createRequire(import.meta.url);
  const Database = require("better-sqlite3");
  const sqlite = new Database(path.join(fixture.dataDir, "paintwarden.sqlite"));
  try {
    sqlite.pragma("busy_timeout = 5000");
    sqlite
      .prepare(
        "INSERT INTO paint_substitutions(id,target_paint_id,name,is_default,created_at,updated_at) VALUES (?,?,?,1,?,?)",
      )
      .run(randomUUID(), candidate.id, "Imported empty smoke recipe", Date.now(), Date.now());
  } finally {
    sqlite.close();
  }
  // Change-log triggers are connection-local; the synthetic import injection is not
  // an app write. Issue an ordinary stock command to publish the new fixture revision.
  await (
    await independentWriter(serverBase)
  )(candidate.id, candidate.inventory.quantity);
  const brokenMark = recorder.mark();
  await page.getByPlaceholder("Search brand, range, or paint…").fill(candidate.name);
  const broken = page.getByText("Broken: Imported empty smoke recipe", { exact: true });
  await broken.waitFor({ timeout: 20000 });
  const chip = broken.locator("..");
  assert.ok((await chip.getAttribute("class")).includes("MuiChip-colorError"));
  const row = page.locator("[data-paint-index]").filter({ has: broken });
  await row.getByRole("button").first().click();
  await page.getByText("Broken substitution: empty recipe.", { exact: true }).waitFor();
  assert.ok(!recorder.slice(brokenMark).some((entry) => entry.path === "/api/state"));
  report.checks.push({
    status: "PASS",
    name: "Imported empty active substitution shows red broken chip and details warning",
    evidence: { paintId: candidate.id, physicalQuantity: candidate.inventory.quantity, noNewSnapshot: true },
  });
  await page.getByRole("dialog", { name: candidate.name, exact: true }).waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".MuiDialog-container")].some(
      (element) => getComputedStyle(element).opacity === "1",
    ),
  );
  await page.screenshot({
    path: path.join(evidence, `${profile}-broken-open-details.png`),
    animations: "disabled",
  });
  await recorder.settle();
  report.metrics.brokenSearchResponseBytes = libraryReads(recorder.slice(brokenMark))
    .filter((entry) => entry.body.variables.search === candidate.name)
    .map((entry) => entry.bytes);
  report.metrics.brokenDetailResponseBytes = recorder
    .slice(brokenMark)
    .filter((entry) => entry.body?.operationName === "PaintDetails")
    .map((entry) => entry.bytes);
  assert.deepEqual(recorder.errors, []);
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  if (!report.metrics && recorder?.scenario) {
    report.checks.push(...recorder.scenario.checks);
    report.metrics = recorder.scenario.metrics;
  }
  report.error = error.stack;
  if (error.cause) report.cause = String(error.cause);
  process.exitCode = 1;
  if (page) {
    report.body = await page
      .locator("body")
      .innerText()
      .catch(() => "unavailable");
    await page.screenshot({ path: path.join(evidence, `${profile}-failure.png`) }).catch(() => {});
  }
} finally {
  if (recorder) {
    await recorder.settle();
    report.requests = recorder.requests;
    report.pageErrors = recorder.errors;
  }
  if (browser) await browser.close();
  await stopOwned(server.child);
  await server.save();
  report.finishedAt = new Date().toISOString();
  report.counts = report.checks.reduce(
    (counts, check) => ({ ...counts, [check.status]: (counts[check.status] ?? 0) + 1 }),
    {},
  );
  await writeFile(path.join(evidence, `${profile}-results.json`), JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify(
      { result: report.result, counts: report.counts, metrics: report.metrics, error: report.error },
      null,
      2,
    ),
  );
}
