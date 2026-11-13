#!/usr/bin/env node
// Existing production build ONLY. No builds, personal data, or fixed dev ports.
// node scripts/smoke-home-miniatures-browser.mjs EVIDENCE_DIR --profile large|stress [--web-dist PATH] [--run]
import assert from "node:assert/strict";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createLibraryFixture } from "./library-fixture.mjs";
import { seedHomeMiniaturesFixture } from "./home-miniatures-fixture.mjs";
import { runHomeMiniaturesScenario, sourceSnapshot } from "./home-miniatures-smoke-support.mjs";
import { attachLibraryRecorder } from "./library-smoke-support.mjs";
import {
  freePort,
  launchOwned,
  waitForOutput,
  stopOwned,
  fixtureCredentials,
  independentWriter,
  identity,
} from "./smoke-library-native.mjs";

assert.equal(process.version, "v22.22.2");
const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
assert.ok(args[0] && !args[0].startsWith("--"), "An evidence directory is required");
const evidenceDir = path.resolve(args.shift());
let run = false,
  profile = "large",
  webDist = path.join(root, "apps/paint-vault-web/dist");
while (args.length) {
  const arg = args.shift();
  if (arg === "--run") run = true;
  else if (arg === "--profile") profile = args.shift();
  else if (arg === "--web-dist") {
    assert.ok(args[0], "Missing --web-dist value");
    webDist = path.resolve(args.shift());
  } else throw new Error(`Unknown argument ${arg}`);
}
assert.ok(["large", "stress"].includes(profile));
await mkdir(evidenceDir, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  profile,
  webDist,
  scope:
    "Default Home and migrated Miniatures production Chromium interactions; synthetic Phase0 baseline plus 360 focused smoke projects; not a full app control sweep.",
  checks: [],
};
let browser, server, page, recorder;
const owned = [];
try {
  if (!run) {
    report.checks.push({
      status: "NOT RUN",
      name: "Production default Home and Miniatures browser smoke",
      reason:
        "Planning only. Requires coordinator-approved existing production build and explicit --run; never builds implicitly.",
    });
  } else {
    report.source = sourceSnapshot();
    report.artifacts = [
      await identity(path.join(root, "apps/paint-vault/dist/server.mjs")),
      await identity(path.join(webDist, "index.html")),
    ];
    for (const entry of await readdir(webDist, { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) report.artifacts.push(await identity(path.join(entry.parentPath, entry.name)));
    }
    const baseline = await createLibraryFixture(root, profile);
    report.fixture = baseline;
    const port = await freePort(),
      host = "phase3-miniatures.localhost";
    const base = `http://${host}:${port}`,
      serverBase = `http://127.0.0.1:${port}`;
    report.base = base;
    const launch = (name) => {
      const ownedProcess = launchOwned(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          'process.env.NODE_ENV="test"; const {startServer}=await import("./server.mjs"); process.env.NODE_ENV="production"; await startServer(); console.log("PHASE3_READY_LISTENING");',
        ],
        {
          cwd: path.join(root, "apps/paint-vault/dist"),
          env: {
            ...process.env,
            NODE_ENV: "production",
            DATA_DIR: baseline.dataDir,
            DATABASE_PATH: "",
            HOST: "127.0.0.1",
            PORT: String(port),
            WEB_DIST: webDist,
            PAINT_VAULT_ALLOWED_HOSTS: host,
            PAINT_VAULT_DISABLE_UPDATES: "1",
          },
        },
        path.join(evidenceDir, `${profile}-${name}-server.log`),
      );
      owned.push(ownedProcess);
      return ownedProcess;
    };
    server = launch("seed");
    await waitForOutput(server, /PHASE3_READY_LISTENING/, "isolated seed server");
    const setup = await fetch(`${serverBase}/api/auth/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fixtureCredentials),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(setup.status, 200);
    const { token } = await setup.json();
    const context = async () => {
      browser = await chromium.launch({
        headless: true,
        args: [`--host-resolver-rules=MAP ${host} 127.0.0.1`],
      });
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.addCookies([
        { name: "pv_session", value: token, url: base, httpOnly: true, sameSite: "Strict" },
      ]);
      return context;
    };
    page = await (await context()).newPage();
    await page.goto(`${base}/`);
    const focusedFixture = await seedHomeMiniaturesFixture(page);
    report.focusedFixture = focusedFixture;
    await browser.close();
    browser = undefined;
    await stopOwned(server.child);
    await server.save();
    // Fresh server process AND fresh document/browser context after seeding. The
    // fixture was just written: this is explicitly not a cold-disk benchmark.
    server = launch("runtime");
    await waitForOutput(server, /PHASE3_READY_LISTENING/, "fresh production runtime");
    page = await (await context()).newPage();
    recorder = attachLibraryRecorder(page);
    const scenario = await runHomeMiniaturesScenario({
      page,
      recorder,
      fixture: focusedFixture,
      evidenceDir,
      label: profile,
      initialNavigate: () => page.goto(`${base}/`),
      secondClientWrite: await independentWriter(serverBase),
    });
    report.checks.push(...scenario.checks);
    report.metrics = scenario.metrics;
    report.result = "PASS";
  }
} catch (error) {
  report.result = "FAIL";
  report.error = error.stack;
  process.exitCode = 1;
  if (recorder?.scenario) {
    report.checks.push(...recorder.scenario.checks);
    report.metrics = recorder.scenario.metrics;
  }
  report.checks.push({ status: "FAIL", name: "Browser scenario", detail: error.stack });
  if (page) {
    report.body = await page
      .locator("body")
      .innerText()
      .catch(() => "unavailable");
    await page.screenshot({ path: path.join(evidenceDir, `${profile}-failure.png`) }).catch(() => {});
  }
} finally {
  if (recorder) {
    await recorder.settle();
    report.requests = recorder.requests;
    report.pageErrors = recorder.errors;
  }
  await browser?.close();
  for (const ownedProcess of owned) {
    await stopOwned(ownedProcess.child);
    await ownedProcess.save();
  }
  report.finishedAt = new Date().toISOString();
  report.counts = report.checks.reduce(
    (counts, check) => ({ ...counts, [check.status]: (counts[check.status] ?? 0) + 1 }),
    {},
  );
  await writeFile(path.join(evidenceDir, `${profile}-results.json`), JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify(
      { result: report.result, counts: report.counts, metrics: report.metrics, error: report.error },
      null,
      2,
    ),
  );
}
