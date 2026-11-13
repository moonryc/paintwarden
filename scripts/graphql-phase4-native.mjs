#!/usr/bin/env node
/** Phase 4 actual packaged macOS app; never builds or touches the user's vault.
 * Node 22.22.2: scripts/graphql-phase4-native.mjs EVIDENCE_DIR --app '/path/Paint Vault.app' [--profile realistic|stress] [--run]
 * Default writes NOT RUN only. Explicit --run retains isolated desktop/server DATA dirs,
 * identities for every packaged web asset, raw requests, fixture records and owned-process logs.
 */
import assert from "node:assert/strict";
import { graphqlObservations } from "./graphql-phase4-errors.mjs";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverOwnedLocalServer, independentProcessWriter } from "./home-miniatures-process-client.mjs";
import {
  parseOptions as parseBaseOptions,
  freePort,
  identity,
  sleep,
  waitForOutput,
  stopOwned,
  launchOwned,
  setupAndSeed,
  fixtureCredentials,
} from "./smoke-library-native.mjs";

export function parseOptions(args) {
  let profile = "realistic";
  const rest = [];
  let plan = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--plan") plan = true;
    else if (args[i] === "--profile") {
      assert.ok(args[i + 1] && !args[i + 1].startsWith("--"), "Missing profile");
      profile = args[++i];
    } else rest.push(args[i]);
  }
  assert.ok(["realistic", "stress"].includes(profile), "--profile must be realistic or stress");
  const options = parseBaseOptions(rest);
  assert.ok(!(plan && options.run), "Use --plan or --run, not both");
  return { ...options, profile };
}

export function summarizeChecks(checks) {
  const counts = checks.reduce((counts, check) => {
    assert.ok(
      ["PASS", "FAIL", "PARTIAL", "NOT RUN", "N/A"].includes(check.status),
      `Invalid check status ${check.status}`,
    );
    counts[check.status] = (counts[check.status] ?? 0) + 1;
    return counts;
  }, {});
  const result = counts.FAIL
    ? "FAIL"
    : counts.PARTIAL
      ? "PARTIAL"
      : counts["NOT RUN"]
        ? counts.PASS
          ? "PARTIAL"
          : "NOT RUN"
        : counts.PASS
          ? "PASS"
          : "NOT RUN";
  return {
    counts,
    result,
    completed: (counts.PASS ?? 0) + (counts.FAIL ?? 0),
    remaining: (counts["NOT RUN"] ?? 0) + (counts.PARTIAL ?? 0),
    total: checks.length,
  };
}

export function mergeScenarioChecks(checks, label, observed) {
  for (const check of observed) {
    const name = `${label}: ${check.name}`;
    const existing = checks.find((entry) => entry.name === name);
    if (existing) {
      Object.assign(existing, check, { name });
      if (!check.reason) delete existing.reason;
    } else checks.push({ ...check, name });
  }
}

async function main() {
  assert.equal(process.version, "v22.22.2", "Use the pinned Node.js 22.22.2 runtime (including plan mode)");
  const options = parseOptions(process.argv.slice(2));
  const evidence = options.evidenceDir;
  await mkdir(evidence, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    platform: process.platform,
    node: process.version,
    profile: options.profile,
    mode: options.run ? "run" : "plan",
    sourceBuildLink:
      "Source and existing runtime artifacts are independently hashed; these manifests do not alone establish that an existing artifact was built from the observed source.",
    scope:
      "Packaged production Phase4 GraphQL, local and remote, profile-selected isolated synthetic fixtures; not a full native controls sweep or performance benchmark.",
    checks: [],
    fixtures: [],
    artifacts: [],
  };
  const {
    runPhase4Scenario,
    sourceSnapshot,
    sourceManifest: captureSourceManifest,
    plannedChecks,
  } = await import("./graphql-phase4-support.mjs");
  const planned = [
    "local packaged default Phase4 GraphQL projections, writes, SSE and legacy consistency",
    "remote packaged default Phase4 GraphQL projections, writes, SSE and legacy consistency",
    "intentional quit and retained isolated connection relaunch",
  ];
  report.checks = planned.map((name) => ({
    name,
    status: "NOT RUN",
    reason: "Not reached or planning only.",
  }));
  report.checks.push({
    name: "Full native controls, Windows executable, signing and distribution install",
    status: "NOT RUN",
    reason:
      "Focused macOS Phase4 GraphQL checklist only; full native control sweep, Windows, signing and distribution install remain untested.",
  });
  for (const mode of ["local", "remote"])
    report.checks.push(
      ...plannedChecks("Not reached or planning only.").map((check) => ({
        ...check,
        name: `native-${mode}: ${check.name}`,
      })),
    );
  if (!options.run) {
    report.mode = "plan";
    Object.assign(report, summarizeChecks(report.checks));
    report.finishedAt = new Date().toISOString();
    await writeFile(path.join(evidence, "native-results.json"), JSON.stringify(report, null, 2));
    return;
  }
  const processes = [];
  let browser;
  let currentPage;
  let sourceManifest;
  const recordings = [];
  try {
    sourceManifest = captureSourceManifest;
    report.source = sourceSnapshot();
    report.sourceManifest = await sourceManifest();
    report.artifacts.push(await identity(process.execPath));
    assert.match(report.sourceManifest.manifestSha256, /^[a-f0-9]{64}$/);
    assert.equal(process.platform, "darwin", "Requires actual packaged macOS app");
    assert.ok(options.app, "--app is required with --run");
    const app = path.resolve(options.app);
    assert.ok(app.endsWith(".app"), "Use a packaged .app, not development Electron");
    const resources = path.join(app, "Contents/Resources");
    const executable = path.join(app, "Contents/MacOS/Paint Vault");
    report.packagedApp = app;
    report.packagedNode = execFileSync(path.join(resources, "server/node"), ["--version"], {
      encoding: "utf8",
      timeout: 10000,
    }).trim();
    assert.equal(report.packagedNode, "v22.22.2", "Bundled server must use pinned Node");
    // Hash the exact existing bundle, including Electron, server/native modules,
    // app.asar, migrations and every renderer asset; no source-build identity claim.
    report.packagedArtifacts = [];
    const entries = await readdir(app, { recursive: true, withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name))
      .sort();
    for (const file of files) report.packagedArtifacts.push(await identity(file));
    for (const entry of entries.filter((entry) => entry.isSymbolicLink())) {
      const file = path.join(entry.parentPath, entry.name);
      report.packagedArtifacts.push({ path: file, type: "symlink", target: await readlink(file) });
    }
    await writeFile(
      path.join(evidence, "native-artifact-manifest.json"),
      JSON.stringify(report.packagedArtifacts, null, 2),
    );
    const { chromium } = await import("playwright");
    const { attachLibraryRecorder } = await import("./library-smoke-support.mjs");

    const { seedPhase4Fixture } = await import("./graphql-phase4-fixture.mjs");
    for (const source of [
      import.meta.url,
      new URL("./smoke-library-native.mjs", import.meta.url),
      new URL("./library-smoke-support.mjs", import.meta.url),
      new URL("./graphql-phase4-support.mjs", import.meta.url),
      new URL("./graphql-phase4-fixture.mjs", import.meta.url),
      new URL("./home-miniatures-fixture.mjs", import.meta.url),
      new URL("./home-miniatures-smoke-support.mjs", import.meta.url),
      new URL("./home-miniatures-process-client.mjs", import.meta.url),
    ])
      report.artifacts.push(await identity(new URL(source)));
    const remoteData = await mkdtemp(path.join(os.tmpdir(), "pv-phase4-remote-"));
    report.fixtures.push({ type: "remote server data", path: remoteData, retained: true });
    const remotePort = await freePort();
    const remoteBase = `http://127.0.0.1:${remotePort}`;
    const remote = launchOwned(
      path.join(resources, "server/node"),
      ["server.mjs"],
      {
        cwd: path.join(resources, "server"),
        env: {
          ...process.env,
          DATABASE_PATH: "",
          HOST: "127.0.0.1",
          PORT: String(remotePort),
          DATA_DIR: remoteData,
          WEB_DIST: path.join(resources, "web-dist"),
          PAINT_VAULT_DISABLE_UPDATES: "1",
        },
      },
      path.join(evidence, "remote-server.log"),
    );
    processes.push(remote);
    await waitForOutput(remote, /Nest application successfully started/, "isolated remote server");
    for (const mode of ["local", "remote"]) {
      console.log("Launching packaged mode", mode);
      const dataDir = await mkdtemp(path.join(os.tmpdir(), `pv-phase4-desktop-${mode}-`));
      report.fixtures.push({ type: `${mode} desktop data`, path: dataDir, retained: true });
      const debugPort = await freePort();
      const native = launchOwned(
        executable,
        [`--remote-debugging-port=${debugPort}`, "--remote-debugging-address=127.0.0.1"],
        {
          env: {
            ...process.env,
            DATABASE_PATH: "",
            PAINT_VAULT_DESKTOP_DATA_DIR: dataDir,
            WEB_DIST: path.join(resources, "web-dist"),
            PAINT_VAULT_DISABLE_UPDATES: "1",
          },
        },
        path.join(evidence, `${mode}-electron.log`),
      );
      processes.push(native);
      await waitForOutput(native, /DevTools listening on ws:/, `${mode} packaged CDP`);
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
      const context = browser.contexts()[0];
      const page = context.pages()[0] || (await context.waitForEvent("page"));
      currentPage = page;
      const recorder = attachLibraryRecorder(page);
      recordings.push({ label: `native-${mode}`, recorder });
      await page.waitForURL("paintvault://app/**");
      if (mode === "local")
        await page.getByRole("button", { name: "Use this computer", exact: true }).click();
      else {
        await page.getByLabel("Server URL", { exact: true }).fill(remoteBase);
        await page.getByRole("button", { name: "Connect to server", exact: true }).click();
      }
      const seeded = await setupAndSeed(page);
      report.checks.push({
        name: `${mode} picker accepts 101 excluded IDs within existing request bounds`,
        status: "PASS",
        detail: { excludedCount: seeded.excludedCount, remaining: seeded.pickerRemaining },
      });
      const fixture = await seedPhase4Fixture(page, { profile: options.profile });
      report.fixtures.push({ type: `${mode} Phase4 GraphQL seeded records`, ...fixture });
      const localServer = mode === "local" ? discoverOwnedLocalServer(native.child.pid, resources) : null;
      if (localServer) report.fixtures.push({ type: "owned bundled local server listener", ...localServer });
      const secondClientWrite = independentProcessWriter(localServer?.baseUrl ?? remoteBase);
      console.log("Starting Phase4 GraphQL scenario", mode);
      const result = await runPhase4Scenario({
        page,
        recorder,
        evidenceDir: evidence,
        label: `native-${mode}`,
        initialNavigate: async () => {
          await page.goto("paintvault://app/");
          await page.reload(); // Hash-only navigation does not remount the initial-tab store.
        },
        secondClientWrite,
        fixture,
      });
      Object.assign(report.checks[mode === "local" ? 0 : 1], {
        ...summarizeChecks(result.checks),
        reason: "Shared Phase4 scenario completed.",
        status: summarizeChecks(result.checks).result,
      });
      mergeScenarioChecks(report.checks, `native-${mode}`, result.checks);
      (report.metrics ??= {})[mode] = result.metrics;
      report.checks.push({
        name: `${mode} second client scope`,
        status: "PASS",
        detail:
          "Separate Node process and fresh bearer login session per write, outside Electron/proxy cookies; local endpoint discovered only from owned direct bundled-server child/listener metadata",
      });
      await page.screenshot({ path: path.join(evidence, `native-${mode}.png`) });
      const exited = new Promise((resolve) =>
        native.child.once("exit", (code, signal) => resolve({ code, signal })),
      );
      await page.close();
      const exit = await Promise.race([
        exited,
        sleep(8000).then(() => {
          throw new Error("Native window close did not intentionally quit");
        }),
      ]);
      assert.equal(exit.code, 0);
      report.checks.push({ name: `${mode} intentional packaged quit`, status: "PASS", detail: exit });
      const relaunchPort = await freePort();
      const relaunched = launchOwned(
        executable,
        [`--remote-debugging-port=${relaunchPort}`, "--remote-debugging-address=127.0.0.1"],
        {
          env: {
            ...process.env,
            DATABASE_PATH: "",
            PAINT_VAULT_DESKTOP_DATA_DIR: dataDir,
            WEB_DIST: path.join(resources, "web-dist"),
            PAINT_VAULT_DISABLE_UPDATES: "1",
          },
        },
        path.join(evidence, `${mode}-relaunch.log`),
      );
      processes.push(relaunched);
      await waitForOutput(relaunched, /DevTools listening on ws:\/\//, `${mode} relaunch CDP`);
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${relaunchPort}`);
      const relaunchedContext = browser.contexts()[0];
      const relaunchedPage = relaunchedContext.pages()[0] || (await relaunchedContext.waitForEvent("page"));
      currentPage = relaunchedPage;
      recordings.push({ label: `native-${mode}-relaunch`, recorder: attachLibraryRecorder(relaunchedPage) });
      await relaunchedPage.waitForFunction(() => Boolean(window.paintVaultDesktop));
      await relaunchedPage.waitForFunction(
        async () => {
          try {
            const reply = await fetch("/api/auth/status");
            return reply.ok && (await reply.json()).setupRequired === false;
          } catch {
            return false;
          }
        },
        null,
        { timeout: 30000 },
      );
      const retained = await relaunchedPage.evaluate(async () => ({
        connection: await window.paintVaultDesktop.getConnection(),
        auth: await (await fetch("/api/auth/status")).json(),
      }));
      assert.equal(retained.connection.mode, mode);
      assert.equal(retained.auth.setupRequired, false);
      report.checks.push({
        name: `${mode} relaunch retains isolated connection and fixture owner`,
        status: "PASS",
        detail: { mode: retained.connection.mode, setupRequired: retained.auth.setupRequired },
      });
      await relaunchedPage.screenshot({ path: path.join(evidence, `native-${mode}-relaunch.png`) });
      // Desktop proxy sessions are intentionally in memory. A new app process
      // retains connection and owner, but requires normal authentication again.
      await relaunchedPage.getByRole("textbox", { name: /^Username/ }).fill(fixtureCredentials.username);
      await relaunchedPage.getByLabel(/^Password/).fill(fixtureCredentials.password);
      await relaunchedPage.getByRole("button", { name: "Sign in", exact: true }).click();
      await relaunchedPage.getByRole("button", { name: "Sign in", exact: true }).waitFor({ state: "hidden" });
      report.checks.push({
        name: `${mode} relaunch requires and accepts normal owner sign-in`,
        status: "PASS",
      });
      const retainedMiniature = await relaunchedPage.evaluate(async (id) => {
        const reply = await fetch("/api/graphql", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: "query RetainedMiniature($id: ID!) { miniature(id: $id) { miniature { id title } } }",
            variables: { id },
          }),
        });
        const payload = await reply.json();
        if (!reply.ok || payload.errors) throw new Error(JSON.stringify(payload));
        return payload.data.miniature.miniature;
      }, fixture.finalMiniatureId);
      assert.equal(
        retainedMiniature?.title,
        fixture.finalTitle,
        "Relaunch retains the seeded final-list miniature",
      );
      report.checks.push({
        name: `${mode} relaunch retains seeded final-list miniature`,
        status: "PASS",
        detail: retainedMiniature,
      });
      const relaunchExit = new Promise((resolve) =>
        relaunched.child.once("exit", (code, signal) => resolve({ code, signal })),
      );
      await relaunchedPage.close();
      const finalExit = await Promise.race([
        relaunchExit,
        sleep(8000).then(() => {
          throw new Error("Relaunch window close did not quit");
        }),
      ]);
      assert.equal(finalExit.code, 0);
      report.checks.push({
        name: `${mode} final intentional packaged quit`,
        status: "PASS",
        detail: finalExit,
      });
      browser = undefined;
    }
    Object.assign(report.checks[2], {
      status: "PASS",
      reason: "Both modes intentionally quit and relaunched.",
    });
  } catch (error) {
    if (currentPage) {
      report.failureBody = await currentPage
        .locator("body")
        .innerText()
        .catch(() => "unavailable");
      await currentPage.screenshot({ path: path.join(evidence, "native-failure.png") }).catch(() => {});
    }
    report.checks.push({ name: "native harness", status: "FAIL", detail: error.stack });
    process.exitCode = 1;
  } finally {
    for (const owned of processes.reverse()) {
      try {
        await stopOwned(owned.child);
        await owned.save();
      } catch (error) {
        report.checks.push({ name: "owned process cleanup", status: "FAIL", detail: String(error) });
        process.exitCode = 1;
      }
    }
    for (const { label, recorder } of recordings) {
      try {
        await recorder.settle();
        mergeScenarioChecks(report.checks, label, recorder.scenario?.checks ?? []);
        const snapshots = recorder.requests.filter((entry) => /^\/api\/state(?:\/|$)/.test(entry.path));
        const graphql = graphqlObservations(recorder.requests, recorder.scenario?.checks ?? []);
        const graphqlErrors = graphql.unexpected;
        const serverErrors = recorder.requests.filter((entry) => entry.status >= 500);
        const clean =
          !snapshots.length && !graphqlErrors.length && !serverErrors.length && !recorder.errors.length;
        report.checks.push({
          name: `${label}: complete raw recording remains snapshot/error-free`,
          status: clean ? "PASS" : "FAIL",
          evidence: {
            snapshots: snapshots.length,
            unexpectedGraphqlErrors: graphqlErrors.length,
            rawGraphqlErrorResponses: graphql.rawGraphqlErrorResponses,
            recoveredStaleCursors: graphql.recoveredStaleCursors,
            serverErrors: serverErrors.length,
            rendererErrors: recorder.errors.length,
          },
        });
        if (!clean) process.exitCode = 1;
        await writeFile(
          path.join(evidence, `${label}-raw-evidence.json`),
          JSON.stringify(
            { requests: recorder.requests, errors: recorder.errors, scenario: recorder.scenario },
            null,
            2,
          ) + "\n",
        );
      } catch (error) {
        report.checks.push({
          name: `${label} raw evidence retention`,
          status: "FAIL",
          detail: String(error),
        });
        process.exitCode = 1;
      }
    }
    if (report.packagedArtifacts?.length) {
      const changed = [];
      for (const artifact of report.packagedArtifacts) {
        try {
          if (artifact.type === "symlink") {
            if ((await readlink(artifact.path)) !== artifact.target) changed.push(artifact.path);
          } else if ((await identity(artifact.path)).sha256 !== artifact.sha256) changed.push(artifact.path);
        } catch {
          changed.push(artifact.path);
        }
      }
      report.checks.push({
        name: "Packaged runtime unchanged during run",
        status: changed.length ? "FAIL" : "PASS",
        evidence: changed,
      });
    }
    // Do not browser.close(): attached CDP belongs to the exact owned Electron child.
    if (sourceManifest) {
      try {
        report.sourceManifestAfter = await sourceManifest();
        assert.equal(
          report.sourceManifestAfter.manifestSha256,
          report.sourceManifest.manifestSha256,
          "Source changed during the run; evidence cannot establish a single source identity",
        );
      } catch (error) {
        report.checks.push({ name: "Stable source manifest", status: "FAIL", detail: String(error) });
        process.exitCode = 1;
      }
    }
    report.finishedAt = new Date().toISOString();
    Object.assign(report, summarizeChecks(report.checks));
    if (report.result === "FAIL") process.exitCode = 1;
    await writeFile(path.join(evidence, "native-results.json"), JSON.stringify(report, null, 2));
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
