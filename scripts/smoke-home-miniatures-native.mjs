#!/usr/bin/env node
/** Phase 3 actual packaged macOS app; never builds or touches the user's vault.
 * Node 22.22.2: scripts/smoke-home-miniatures-native.mjs EVIDENCE_DIR --app '/path/Paintwarden.app' [--run]
 * Default writes NOT RUN only. Explicit --run retains isolated desktop/server DATA dirs,
 * identities for every packaged web asset, raw requests, fixture records and owned-process logs.
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverOwnedLocalServer, independentProcessWriter } from "./home-miniatures-process-client.mjs";
import {
  parseOptions,
  freePort,
  identity,
  sleep,
  waitForOutput,
  stopOwned,
  launchOwned,
  setupAndSeed,
  fixtureCredentials,
} from "./smoke-library-native.mjs";

async function main() {
  assert.equal(process.version, "v22.22.2", "Use the pinned Node.js 22.22.2 runtime (including plan mode)");
  const options = parseOptions(process.argv.slice(2));
  const evidence = options.evidenceDir;
  await mkdir(evidence, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    platform: process.platform,
    node: process.version,
    scope:
      "Packaged production Home/Miniatures, local and remote, 360 synthetic miniatures and 130 base plus two focused paints; not a full native controls sweep or performance benchmark.",
    checks: [],
    fixtures: [],
    artifacts: [],
  };
  const planned = [
    "local packaged default Home/Miniatures projections, writes, SSE and legacy consistency",
    "remote packaged default Home/Miniatures projections, writes, SSE and legacy consistency",
    "intentional quit and retained isolated connection relaunch",
  ];
  if (!options.run) {
    report.checks = planned.map((name) => ({
      name,
      status: "NOT RUN",
      reason: "Planning only; pass --run after build approval with an existing packaged app.",
    }));
    report.counts = { "NOT RUN": report.checks.length };
    report.finishedAt = new Date().toISOString();
    await writeFile(path.join(evidence, "native-results.json"), JSON.stringify(report, null, 2));
    return;
  }
  const processes = [];
  let browser;
  let currentPage;
  const recordings = [];
  try {
    assert.equal(process.platform, "darwin", "Requires actual packaged macOS app");
    assert.ok(options.app, "--app is required with --run");
    const app = path.resolve(options.app);
    assert.ok(app.endsWith(".app"), "Use a packaged .app, not development Electron");
    const resources = path.join(app, "Contents/Resources");
    const executable = path.join(app, "Contents/MacOS/Paintwarden");
    for (const file of [
      executable,
      path.join(resources, "app.asar"),
      path.join(resources, "server/server.mjs"),
      path.join(resources, "server/node"),
      path.join(resources, "server/schema.graphql"),
    ])
      report.artifacts.push(await identity(file));
    const webRoot = path.join(resources, "web-dist");
    for (const entry of await readdir(webRoot, { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) report.artifacts.push(await identity(path.join(entry.parentPath, entry.name)));
    }
    const { chromium } = await import("playwright");
    const { attachLibraryRecorder } = await import("./library-smoke-support.mjs");
    const { runHomeMiniaturesScenario, sourceSnapshot } = await import("./home-miniatures-smoke-support.mjs");
    report.source = sourceSnapshot();
    const { seedHomeMiniaturesFixture } = await import("./home-miniatures-fixture.mjs");
    for (const source of [
      import.meta.url,
      new URL("./smoke-library-native.mjs", import.meta.url),
      new URL("./library-smoke-support.mjs", import.meta.url),
      new URL("./home-miniatures-smoke-support.mjs", import.meta.url),
      new URL("./home-miniatures-fixture.mjs", import.meta.url),
      new URL("./home-miniatures-process-client.mjs", import.meta.url),
    ])
      report.artifacts.push(await identity(new URL(source)));
    const remoteData = await mkdtemp(path.join(os.tmpdir(), "pv-home-miniatures-remote-"));
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
          PAINTWARDEN_DISABLE_UPDATES: "1",
        },
      },
      path.join(evidence, "remote-server.log"),
    );
    processes.push(remote);
    await waitForOutput(remote, /Nest application successfully started/, "isolated remote server");
    for (const mode of ["local", "remote"]) {
      console.log("Launching packaged mode", mode);
      const dataDir = await mkdtemp(path.join(os.tmpdir(), `pv-home-miniatures-desktop-${mode}-`));
      report.fixtures.push({ type: `${mode} desktop data`, path: dataDir, retained: true });
      const debugPort = await freePort();
      const native = launchOwned(
        executable,
        [`--remote-debugging-port=${debugPort}`, "--remote-debugging-address=127.0.0.1"],
        {
          env: {
            ...process.env,
            DATABASE_PATH: "",
            PAINTWARDEN_DESKTOP_DATA_DIR: dataDir,
            PAINTWARDEN_DISABLE_UPDATES: "1",
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
      await page.waitForURL("paintwarden://app/**");
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
      const fixture = await seedHomeMiniaturesFixture(page, { miniatures: 360 });
      report.fixtures.push({ type: `${mode} Home/Miniatures seeded records`, ...fixture });
      const localServer = mode === "local" ? discoverOwnedLocalServer(native.child.pid, resources) : null;
      if (localServer) report.fixtures.push({ type: "owned bundled local server listener", ...localServer });
      const secondClientWrite = independentProcessWriter(localServer?.baseUrl ?? remoteBase);
      console.log("Starting Home/Miniatures scenario", mode);
      const result = await runHomeMiniaturesScenario({
        page,
        recorder,
        evidenceDir: evidence,
        label: `native-${mode}`,
        initialNavigate: async () => {
          await page.goto("paintwarden://app/");
          await page.reload(); // Hash-only navigation does not remount the initial-tab store.
        },
        secondClientWrite,
        fixture,
      });
      report.checks.push(...result.checks);
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
            PAINTWARDEN_DESKTOP_DATA_DIR: dataDir,
            PAINTWARDEN_DISABLE_UPDATES: "1",
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
      await relaunchedPage.waitForFunction(() => Boolean(window.paintwardenDesktop));
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
        connection: await window.paintwardenDesktop.getConnection(),
        auth: await (await fetch("/api/auth/status")).json(),
      }));
      assert.equal(retained.connection.mode, mode);
      assert.equal(retained.auth.setupRequired, false);
      report.checks.push({
        name: `${mode} relaunch retains isolated connection and fixture owner`,
        status: "PASS",
        detail: { mode: retained.connection.mode, setupRequired: retained.auth.setupRequired },
      });
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
    report.checks.push({
      name: "Full native controls, Windows executable, signing and distribution install",
      status: "NOT RUN",
      reason:
        "Focused macOS production Home/Miniatures vertical-slice smoke only; no full-app, Windows, signing or install claim.",
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
        for (const check of recorder.scenario?.checks ?? []) {
          if (!report.checks.includes(check)) report.checks.push(check);
        }
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
    // Do not browser.close(): attached CDP belongs to the exact owned Electron child.
    report.finishedAt = new Date().toISOString();
    report.counts = report.checks.reduce(
      (counts, check) => ({ ...counts, [check.status]: (counts[check.status] || 0) + 1 }),
      {},
    );
    await writeFile(path.join(evidence, "native-results.json"), JSON.stringify(report, null, 2));
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
