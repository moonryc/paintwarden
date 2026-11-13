#!/usr/bin/env node
// Existing production build only. Default plan does not launch/build anything.
// Node22.22.2 graphql-phase4-browser.mjs EVIDENCE_DIR --profile realistic|stress [--web-dist PATH] [--run]
import assert from "node:assert/strict";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createLibraryFixture } from "./library-fixture.mjs";
import { seedPhase4Fixture } from "./graphql-phase4-fixture.mjs";
import { attachLibraryRecorder } from "./library-smoke-support.mjs";
import {
  runPhase4Scenario,
  root,
  sourceManifest,
  outcome,
  counts,
  plannedChecks,
} from "./graphql-phase4-support.mjs";
import { independentProcessWriter } from "./home-miniatures-process-client.mjs";
import {
  freePort,
  launchOwned,
  waitForOutput,
  stopOwned,
  fixtureCredentials,
  identity,
} from "./smoke-library-native.mjs";

assert.equal(process.version, "v22.22.2", "Use pinned Node22.22.2 including plan mode");
const args = process.argv.slice(2);
assert.ok(args[0] && !args[0].startsWith("--"), "An evidence directory is required");
const evidenceDir = path.resolve(args.shift());
let run = false,
  profile = "realistic",
  webDist = path.join(root, "apps/paint-vault-web/dist");
while (args.length) {
  const arg = args.shift();
  if (arg === "--run") run = true;
  else if (["--profile", "--web-dist"].includes(arg)) {
    assert.ok(args[0] && !args[0].startsWith("--"), `Missing ${arg} value`);
    if (arg === "--profile") profile = args.shift();
    else webDist = path.resolve(args.shift());
  } else throw new Error(`Unknown argument ${arg}`);
}
assert.ok(["realistic", "stress"].includes(profile));
await mkdir(evidenceDir, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  profile,
  webDist,
  scope:
    "Every-screen Phase4 checklist with original Phase0 large/stress synthetic baseline plus focused editable probes. Not exhaustive every-control, OS, cold-disk, or percentile testing.",
  sourceBuildLink:
    "Source observed before/after and runtime artifact SHA256s recorded independently; coordinator must cross-check built outputs against approved source. An existing artifact does not itself prove source equivalence.",
  checks: [],
  artifacts: [],
};
let browser, page, recorder;
const owned = [];
try {
  if (!run) report.checks.push(...plannedChecks());
  else {
    report.sourceManifest = await sourceManifest();
    report.artifacts.push(await identity(process.execPath));
    for (const file of ["server.mjs", "schema.graphql"])
      report.artifacts.push(await identity(path.join(root, "apps/paint-vault/dist", file)));
    for (const entry of await readdir(webDist, { recursive: true, withFileTypes: true }))
      if (entry.isFile()) report.artifacts.push(await identity(path.join(entry.parentPath, entry.name)));
    const baseline = await createLibraryFixture(root, profile === "realistic" ? "large" : "stress");
    report.fixture = baseline;
    const port = await freePort(),
      host = `phase4-${profile}.localhost`;
    const base = `http://${host}:${port}`,
      serverBase = `http://127.0.0.1:${port}`;
    report.base = base;
    const launch = (name) => {
      const child = launchOwned(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          'process.env.NODE_ENV="test"; const {startServer}=await import("./server.mjs"); process.env.NODE_ENV="production"; await startServer(); console.log("PHASE4_READY_LISTENING");',
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
      owned.push(child);
      return child;
    };
    let server = launch("seed");
    await waitForOutput(server, /PHASE4_READY_LISTENING/, "isolated Phase4 seed server");
    const setup = await fetch(`${serverBase}/api/auth/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fixtureCredentials),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(setup.status, 200);
    const { token } = await setup.json();
    assert.ok(token);
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
    const seedRecorder = attachLibraryRecorder(page);
    await page.goto(`${base}/`);
    const fixture = await seedPhase4Fixture(page, { profile });
    report.focusedFixture = fixture;
    await seedRecorder.settle();
    await writeFile(
      path.join(evidenceDir, `${profile}-seed-raw-evidence.json`),
      JSON.stringify({ requests: seedRecorder.requests, errors: seedRecorder.errors }, null, 2) + "\n",
    );
    assert.equal(
      seedRecorder.requests.filter((entry) => entry.path === "/api/state").length,
      0,
      "Fixture setup must also be snapshot-free",
    );
    assert.deepEqual(seedRecorder.errors, []);
    await browser.close();
    browser = undefined;
    await stopOwned(server.child);
    await server.save();
    server = launch("runtime");
    await waitForOutput(server, /PHASE4_READY_LISTENING/, "fresh Phase4 runtime");
    page = await (await context()).newPage();
    recorder = attachLibraryRecorder(page);
    const scenario = await runPhase4Scenario({
      page,
      recorder,
      fixture,
      evidenceDir,
      label: profile,
      initialNavigate: () => page.goto(`${base}/`),
      secondClientWrite: independentProcessWriter(serverBase),
    });
    report.checks.push(...scenario.checks);
    report.metrics = scenario.metrics;
    report.checks.push({
      name: "Exhaustive controls, external source installation, native dialogs and other operating systems",
      status: "NOT RUN",
      reason:
        "Targeted every-screen browser checklist; external network/install/OS controls are not established by browser checks.",
    });
  }
} catch (error) {
  report.checks.push({ status: "FAIL", name: "Phase4 browser harness", detail: error.stack });
  if (page) {
    report.failureBody = await page
      .locator("body")
      .innerText()
      .catch(() => "unavailable");
    await page.screenshot({ path: path.join(evidenceDir, `${profile}-failure.png`) }).catch(() => {});
  }
} finally {
  if (recorder) {
    await recorder.settle();
    for (const check of recorder.scenario?.checks ?? [])
      if (!report.checks.includes(check)) report.checks.push(check);
    await writeFile(
      path.join(evidenceDir, `${profile}-raw-evidence.json`),
      JSON.stringify(
        { requests: recorder.requests, errors: recorder.errors, scenario: recorder.scenario },
        null,
        2,
      ) + "\n",
    );
  }
  await browser
    ?.close()
    .catch((error) =>
      report.checks.push({ name: "Owned browser cleanup", status: "FAIL", detail: String(error) }),
    );
  for (const child of owned) {
    try {
      await stopOwned(child.child);
      await child.save();
    } catch (error) {
      report.checks.push({ name: "Owned process cleanup", status: "FAIL", detail: String(error) });
    }
  }
  if (report.sourceManifest) {
    report.sourceManifestAfter = await sourceManifest();
    if (report.sourceManifest.manifestSha256 !== report.sourceManifestAfter.manifestSha256)
      report.checks.push({
        name: "Source unchanged during run",
        status: "FAIL",
        reason: "Source hashes changed; this is not stable-source acceptance evidence.",
      });
    else
      report.checks.push({
        name: "Source unchanged during run",
        status: "PASS",
        evidence: report.sourceManifest.manifestSha256,
      });
    // Detect rebuilds while a test was running, instead of silently mixing artifacts.
    const changed = [];
    for (const artifact of report.artifacts) {
      try {
        const after = await identity(artifact.path);
        if (after.sha256 !== artifact.sha256) changed.push(artifact.path);
      } catch {
        changed.push(artifact.path);
      }
    }
    report.checks.push({
      name: "Runtime artifacts unchanged during run",
      status: changed.length ? "FAIL" : "PASS",
      evidence: changed,
    });
  }
  if (run) {
    for (const pending of plannedChecks("Not reached: an earlier harness/scenario step did not complete."))
      if (!report.checks.some((check) => check.name === pending.name)) report.checks.push(pending);
  }
  report.finishedAt = new Date().toISOString();
  report.result = outcome(report.checks);
  report.counts = counts(report.checks);
  if (report.result === "FAIL") process.exitCode = 1;
  await writeFile(path.join(evidenceDir, `${profile}-results.json`), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ result: report.result, counts: report.counts }, null, 2));
}
