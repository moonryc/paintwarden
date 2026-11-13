#!/usr/bin/env node
/** Packaged macOS Phase 2 only. Never builds; fixtures and evidence are retained.
 * node scripts/smoke-library-native.mjs EVIDENCE_DIR --app '/path/Paint Vault.app' [--run]
 * Without --run, writes an honest NOT RUN plan (does not launch anything).
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const fixtureCredentials = {
  username: "library-smoke-owner",
  password: "Isolated-library-smoke-2026!",
};
export function parseOptions(args) {
  const options = { run: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--run") options.run = true;
    else if (["--app", "--image", "--evidence-dir"].includes(args[i])) {
      const key = args[i].slice(2);
      assert.ok(args[i + 1] && !args[i + 1].startsWith("--"), `Missing ${key}`);
      options[key === "evidence-dir" ? "evidenceDir" : key] = args[++i];
    } else if (!args[i].startsWith("-") && !options.evidenceDir) options.evidenceDir = args[i];
    else throw new Error(`Unknown argument ${args[i]}`);
  }
  assert.ok(options.evidenceDir, "An evidence directory is required");
  options.evidenceDir = path.resolve(options.evidenceDir);
  return options;
}
export const freePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
export async function identity(file) {
  const info = await stat(file);
  return {
    path: file,
    bytes: info.size,
    mtime: info.mtime.toISOString(),
    sha256: createHash("sha256")
      .update(await readFile(file))
      .digest("hex"),
  };
}
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function waitForOutput(owned, pattern, description, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const done = (error) => {
      clearTimeout(timer);
      owned.child.stdout.off("data", check);
      owned.child.stderr.off("data", check);
      owned.child.off("exit", exited);
      owned.child.off("error", failed);
      if (error) reject(error);
      else resolve(owned.log());
    };
    const check = () => {
      if (pattern.test(owned.log())) done();
    };
    const exited = () => done(new Error(`Process exited waiting for ${description}`));
    const failed = (error) => done(error);
    const timer = setTimeout(() => done(new Error(`Timed out waiting for ${description}`)), timeout);
    owned.child.stdout.on("data", check);
    owned.child.stderr.on("data", check);
    owned.child.once("exit", exited);
    owned.child.once("error", failed);
    if (owned.error()) failed(owned.error());
    else if (owned.child.exitCode !== null) exited();
    else check();
  });
}
export async function stopOwned(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([exited, sleep(5000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([exited, sleep(3000)]);
  }
  assert.ok(child.exitCode !== null || child.signalCode !== null, "Owned child did not exit");
}
export function launchOwned(file, args, options, logPath) {
  const child = spawn(file, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  let error;
  const capture = (chunk) => {
    log += chunk.toString();
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  child.once("error", (value) => {
    error = value;
  });
  return {
    child,
    log: () => log,
    error: () => error,
    save: () => writeFile(logPath, log.replace(/(owner account: )[a-f0-9-]+/g, "$1<redacted>")),
  };
}
export async function setupAndSeed(page, setupCode) {
  await page.getByRole("textbox", { name: /^Username/ }).fill(fixtureCredentials.username);
  await page.getByLabel(/^Password/).fill(fixtureCredentials.password);
  if (setupCode) await page.getByRole("textbox", { name: /^Setup code/ }).fill(setupCode);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("button", { name: "Create account", exact: true }).waitFor({ state: "hidden" });
  console.log("Fixture owner setup complete");
  const result = await page.evaluate(async () => {
    const paints = Array.from({ length: 130 }, (_, i) => ({
      brand: "Invented brand 0",
      range: "Smoke",
      name: `Paint ${String(i).padStart(5, "0")}`,
      colorHex: "#2244aa",
    }));
    const response = await fetch("/api/catalog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paints }),
    });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(result.status, 201, JSON.stringify(result));
  console.log("Fixture catalog seeded");
  const seeded = await page.evaluate(async () => {
    const ids = [];
    let after = null;
    do {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query:
            "query Seed($after: String) { library(first: 100, after: $after) { nodes { id } pageInfo { hasNextPage endCursor } } }",
          variables: { after },
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.errors) throw new Error(JSON.stringify(payload));
      const library = payload.data.library;
      ids.push(...library.nodes.map((node) => node.id));
      after = library.pageInfo.hasNextPage ? library.pageInfo.endCursor : null;
    } while (after);
    const response = await fetch("/api/paint-state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paintIds: ids, state: "OWNED", quantity: 2 }),
    });
    const optionResponse = await fetch("/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query:
          "query FixtureLargeExcludes($excludeIds:[ID!]!){paintOptions(excludeIds:$excludeIds,first:30){items{id}}}",
        variables: { excludeIds: ids.slice(0, 101) },
      }),
    });
    const options = await optionResponse.json();
    if (!optionResponse.ok || options.errors) throw new Error(JSON.stringify(options));
    const items = options.data.paintOptions.items;
    if (items.some((item) => ids.slice(0, 101).includes(item.id)))
      throw new Error("Excluded fixture ID returned");
    return { count: ids.length, status: response.status, excludedCount: 101, pickerRemaining: items.length };
  });
  assert.equal(seeded.count, 130);
  assert.equal(seeded.status, 200, "Seed all 130 owned rows");
  assert.equal(seeded.pickerRemaining, 29, "Picker accepts >100 excluded IDs and excludes all of them");
  console.log("Fixture stock seeded; production picker accepts 101 exclusions");
  return seeded;
}
export async function independentWriter(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fixtureCredentials),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200, "Independent fixture client login");
  const { token } = await response.json();
  assert.ok(token, "Fixture login must issue bearer token");
  return async (paintId, quantity) => {
    const reply = await fetch(`${baseUrl}/api/paint-state`, {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ paintId, state: quantity > 0 ? "OWNED" : null, quantity }),
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(reply.status, 200, "Independent fixture client stock write");
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const evidence = options.evidenceDir;
  await mkdir(evidence, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    platform: process.platform,
    node: process.version,
    scope:
      "Packaged production Library, local and remote, 130 synthetic paints; not a full native controls sweep or performance benchmark.",
    checks: [],
    fixtures: [],
    artifacts: [],
  };
  const planned = [
    "local production Library UI/SSE/legacy consistency",
    "remote production Library UI/SSE/legacy consistency",
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
  try {
    assert.equal(process.platform, "darwin", "Requires actual packaged macOS app");
    assert.ok(options.app, "--app is required with --run");
    const app = path.resolve(options.app);
    assert.ok(app.endsWith(".app"), "Use a packaged .app, not development Electron");
    const resources = path.join(app, "Contents/Resources");
    const executable = path.join(app, "Contents/MacOS/Paint Vault");
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
    const { attachLibraryRecorder, runLibraryScenario } = await import("./library-smoke-support.mjs");
    const remoteData = await mkdtemp(path.join(os.tmpdir(), "pv-library-remote-"));
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
          PAINT_VAULT_DISABLE_UPDATES: "1",
        },
      },
      path.join(evidence, "remote-server.log"),
    );
    processes.push(remote);
    await waitForOutput(remote, /Nest application successfully started/, "isolated remote server");
    for (const mode of ["local", "remote"]) {
      console.log("Launching packaged mode", mode);
      const dataDir = await mkdtemp(path.join(os.tmpdir(), `pv-library-desktop-${mode}-`));
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
      // Local requests use the production desktop proxy, not a test hook. Remote
      // uses a genuinely independent Node HTTP client and separate bearer session.
      const secondClientWrite =
        mode === "remote"
          ? await independentWriter(remoteBase)
          : async (paintId, quantity) => {
              const status = await page.evaluate(
                async ({ paintId, quantity }) =>
                  (
                    await fetch("/api/paint-state", {
                      method: "PUT",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ paintId, state: quantity > 0 ? "OWNED" : null, quantity }),
                    })
                  ).status,
                { paintId, quantity },
              );
              assert.equal(status, 200);
            };
      console.log("Starting Library scenario", mode);
      const result = await runLibraryScenario({
        page,
        recorder,
        evidenceDir: evidence,
        label: `native-${mode}`,
        initialNavigate: async () => {
          await page.goto("paintvault://app/#paints");
          await page.reload(); // Hash-only navigation does not remount the initial-tab store.
        },
        secondClientWrite,
      });
      report.checks.push(...result.checks);
      (report.metrics ??= {})[mode] = result.metrics;
      const candidate = await page.evaluate(async () => {
        const reply = await fetch("/api/graphql", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: "{library(first:1){nodes{id name inventory{quantity}}}}" }),
        });
        const payload = await reply.json();
        if (payload.errors) throw new Error(JSON.stringify(payload.errors));
        return payload.data.library.nodes[0];
      });
      const require = createRequire(import.meta.url);
      const Database = require("better-sqlite3");
      const fixtureDb = new Database(
        path.join(mode === "local" ? dataDir : remoteData, "paint-vault.sqlite"),
      );
      try {
        fixtureDb.pragma("busy_timeout = 5000");
        fixtureDb
          .prepare(
            "INSERT INTO paint_substitutions(id,target_paint_id,name,is_default,created_at,updated_at) VALUES (?,?,?,1,?,?)",
          )
          .run(randomUUID(), candidate.id, "Imported empty native recipe", Date.now(), Date.now());
      } finally {
        fixtureDb.close();
      }
      // Publish an ordinary app revision after test-only imported-corruption injection:
      // change-log triggers are connection-local, unlike the injected fixture connection.
      await secondClientWrite(candidate.id, candidate.inventory.quantity);
      await page.getByPlaceholder("Search brand, range, or paint…").fill(candidate.name);
      const broken = page.getByText("Broken: Imported empty native recipe", { exact: true });
      await broken.waitFor({ timeout: 20000 });
      assert.ok((await broken.locator("..").getAttribute("class")).includes("MuiChip-colorError"));
      await page.locator("[data-paint-index]").filter({ has: broken }).getByRole("button").first().click();
      await page.getByText("Broken substitution: empty recipe.", { exact: true }).waitFor();
      report.checks.push({
        name: `${mode} imported broken substitution red chip and details warning`,
        status: "PASS",
        detail: { paintId: candidate.id, physicalQuantity: candidate.inventory.quantity },
      });
      report.checks.push({
        name: `${mode} second client scope`,
        status: mode === "remote" ? "PASS" : "PARTIAL",
        detail:
          mode === "remote"
            ? "Separate Node HTTP client/session"
            : "Independent request through production renderer proxy, not a separate process/session",
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
      await relaunchedPage.waitForFunction(() => Boolean(window.paintVaultDesktop));
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
      reason: "Focused macOS production Library vertical-slice smoke only; no full-app or Windows claim.",
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
