// Run against electron-builder output, never Electron's development binary.
// No browser install is needed: Playwright drives the Chromium shipped in the app.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    executable: { type: "string" },
    artifacts: { type: "string" },
    help: { type: "boolean" },
    "plugin-zip": { type: "string" },
    "plugin-width": { type: "string", default: "1440" },
  },
});
if (values.help) {
  console.log(
    "Usage: node e2e/native-smoke.mjs [--executable <packaged binary>] [--artifacts <directory>] [--plugin-zip <synthetic ZIP>] [--plugin-width 1440|390]",
  );
  process.exit(0);
}

const root = path.resolve(import.meta.dirname, "..");
const artifacts = path.resolve(
  values.artifacts ?? process.env.E2E_ARTIFACTS_DIR ?? path.join(root, "outputs", "native-smoke"),
);
await mkdir(artifacts, { recursive: true });
// Each invocation keeps its own evidence, including when several architectures run locally.
const evidence = await mkdtemp(path.join(artifacts, "run-"));
const results = {
  startedAt: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  evidence,
  checks: [],
  rendererErrors: [],
};
let application;
let page;
let child;
let tracing = false;
let expectedExit = false;
let stdout = "";
let stderr = "";
const logLimit = 256 * 1024;
const record = (check) => results.checks.push({ status: "PASS", check, at: new Date().toISOString() });
const describe = (error) => (error instanceof Error ? (error.stack ?? error.message) : String(error));

async function bounded(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${milliseconds}ms`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function executablePath() {
  assert.ok(["darwin", "win32"].includes(process.platform), "Native smoke requires macOS or Windows");
  if (values.executable) return path.resolve(values.executable);
  const output = path.join(root, "dist", "electron");
  const candidates = [];
  for (const entry of await readdir(output, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (process.platform === "darwin" && /^mac(?:-|$)/.test(entry.name)) {
      candidates.push(path.join(output, entry.name, "Paintwarden.app", "Contents", "MacOS", "Paintwarden"));
    } else if (process.platform === "win32" && /^win(?:-.*)?-unpacked$|^win-unpacked$/.test(entry.name)) {
      candidates.push(path.join(output, entry.name, "Paintwarden.exe"));
    }
  }
  const existing = [];
  for (const candidate of candidates) {
    if (
      await stat(candidate).then(
        (info) => info.isFile(),
        () => false,
      )
    )
      existing.push(candidate);
  }
  assert.equal(
    existing.length,
    1,
    `Expected one packaged executable, found ${existing.length}; use --executable`,
  );
  return existing[0];
}

async function identity(filename) {
  const info = await stat(filename);
  assert.ok(info.isFile(), `Not a file: ${filename}`);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return {
    path: filename,
    bytes: info.size,
    modifiedAt: info.mtime.toISOString(),
    sha256: hash.digest("hex"),
  };
}

async function authStatus() {
  return bounded(
    page.evaluate(async () => {
      const response = await fetch("/api/auth/status", { cache: "no-store" });
      if (!response.ok) throw new Error(`Auth status HTTP ${response.status}`);
      const { setupRequired, setupCodeRequired, authenticated, username } = await response.json();
      return { setupRequired, setupCodeRequired, authenticated, username };
    }),
    10000,
    "Bundled server auth status",
  );
}

async function quit() {
  expectedExit = true;
  if (child.exitCode !== null || child.signalCode !== null) {
    throw new Error("App exited before intentional app.quit()");
  }
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  // app.close() is deliberately not the pass criterion. Invoke the production quit
  // lifecycle, including before-quit/server shutdown, and observe the real process.
  await bounded(
    Promise.all([
      application
        .evaluate(({ app }) => {
          setImmediate(() => app.quit());
        })
        .catch((error) => {
          // The inspector can disconnect before the evaluate reply reaches Playwright.
          if (!/closed|disconnect/i.test(String(error))) throw error;
        }),
      exited.then((exit) => {
        results.exit = exit;
        assert.equal(exit.signal, null, "Intentional quit must not require a signal");
        assert.equal(exit.code, 0, "Intentional quit must exit successfully");
      }),
    ]),
    20000,
    "Intentional app.quit()",
  );
}

try {
  const executable = await executablePath();
  const resources =
    process.platform === "darwin"
      ? path.resolve(path.dirname(executable), "../Resources")
      : path.join(path.dirname(executable), "resources");
  results.binary = await identity(executable);
  results.bundle = await identity(path.join(resources, "app.asar"));
  results.profile = await mkdtemp(path.join(tmpdir(), "paintwarden-native-smoke-"));

  // Do not inherit a developer's database, host binding, server port or Electron
  // run-as-node/inspector options. This fixture must never reach a personal vault.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/^(?:PAINTWARDEN_|DATA_DIR$|DATABASE_PATH$|PORT$|HOST$|NODE_OPTIONS$|ELECTRON_RUN_AS_NODE$|ELECTRON_EXTRA_LAUNCH_ARGS$)/i.test(
          key,
        ),
    ),
  );
  Object.assign(env, {
    PAINTWARDEN_DESKTOP_DATA_DIR: results.profile,
    PAINTWARDEN_DISABLE_UPDATES: "1",
    NODE_ENV: "production",
    LANG: "en_US.UTF-8",
    LC_ALL: "en_US.UTF-8",
  });
  const { _electron: electron } = await import("playwright");
  application = await electron.launch({
    executablePath: executable,
    args: ["--lang=en-US"],
    env,
    timeout: 60000,
  });
  child = application.process();
  child.stdout?.on("data", (chunk) => {
    stdout = (stdout + chunk).slice(-logLimit);
  });
  child.stderr?.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-logLimit);
  });
  child.on("exit", (code, signal) => {
    if (!expectedExit) results.unexpectedExit = { code, signal };
  });
  application.on("window", (window) => {
    window.on("pageerror", (error) => results.rendererErrors.push(error.message));
    window.on("crash", () => results.rendererErrors.push("Renderer crashed"));
  });
  results.app = await bounded(
    application.evaluate(({ app }) => ({
      isPackaged: app.isPackaged,
      version: app.getVersion(),
      appPath: app.getAppPath(),
      executable: process.execPath,
      userData: app.getPath("userData"),
    })),
    10000,
    "Packaged app identity",
  );
  assert.equal(results.app.isPackaged, true, "Must launch electron-builder output, not a development app");
  assert.equal(path.resolve(results.app.userData), path.join(results.profile, "electron"));
  record("Actual packaged executable launched with isolated desktop data and updates disabled");

  page = await application.firstWindow({ timeout: 45000 });
  page.setDefaultTimeout(45000);
  // firstWindow may already exist before the application 'window' subscription.
  page.on("pageerror", (error) => {
    if (!results.rendererErrors.includes(error.message)) results.rendererErrors.push(error.message);
  });
  page.on("crash", () => results.rendererErrors.push("Renderer crashed"));
  await application.context().tracing.start({ screenshots: true, snapshots: true, sources: false });
  tracing = true;
  await page.getByRole("heading", { name: "Connect to Paintwarden", exact: true }).waitFor();
  const local = page.getByRole("button", { name: "Use this computer", exact: true });
  await local.waitFor();
  await page.getByRole("button", { name: "Connect to server", exact: true }).waitFor();
  await page.screenshot({ path: path.join(evidence, "01-first-run.png"), timeout: 10000 });
  record("First-run connection chooser renders in the native window");

  await local.click();
  await page.waitForFunction(
    async () => {
      const state = await window.paintwardenDesktop.getStartupState();
      if (state.phase === "failed") throw new Error("Bundled local server startup failed");
      return state.phase === "ready";
    },
    null,
    { timeout: 60000, polling: 250 },
  );
  await page.getByRole("heading", { name: "Set up Paintwarden", exact: true }).waitFor();
  const before = await authStatus();
  assert.equal(before.setupRequired, true);
  assert.equal(before.setupCodeRequired, false, "Isolated local server must not need a remote setup code");
  assert.equal(before.username, null);
  await page.screenshot({ path: path.join(evidence, "02-owner-setup.png"), timeout: 10000 });
  record("Bundled local server reaches ready and serves first-owner signup");

  // Synthetic, throwaway fixture only; never read credentials from the host.
  await page.getByRole("textbox", { name: "Username", exact: true }).fill("native-smoke-owner");
  await page.locator('input[autocomplete="new-password"]').fill("Synthetic-native-smoke-2026!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("heading", { name: "Workbench", exact: true, level: 1 }).waitFor();
  await page.getByRole("main").waitFor();
  const after = await authStatus();
  assert.equal(after.setupRequired, false);
  assert.equal(after.username, "native-smoke-owner");
  await page.screenshot({ path: path.join(evidence, "03-main-app.png"), timeout: 10000 });
  assert.deepEqual(results.rendererErrors, [], "No renderer exceptions or crashes allowed");
  assert.equal(results.unexpectedExit, undefined, "No premature app exit allowed");
  record("Owner created through UI; persisted owner and main Workbench loaded without renderer errors");

  const { runBannerStressFlow } = await import("./banner-stress-flow.mjs");
  results.bannerStress = await runBannerStressFlow(page);
  await page.screenshot({
    path: path.join(evidence, "04-heavy-session-no-global-error.png"),
    timeout: 10000,
  });
  record(
    "Rapid Model typing, fast navigation and focus storms do not trigger a global request error or throttle authenticated use",
  );

  if (values["plugin-zip"]) {
    const { runPluginInstallFlow } = await import("./plugin-install-flow.mjs");
    const { default: Database } = await import("better-sqlite3");
    const width = Number(values["plugin-width"]);
    assert.ok([1440, 390].includes(width));
    results.plugin = { checks: [] };
    async function inspectPlugin(cancelled) {
      const database = new Database(path.join(results.profile, "paintwarden.sqlite"), { readonly: true });
      try {
        assert.equal(
          database.prepare("SELECT count(*) AS n FROM catalog_source_items").get().n,
          cancelled ? 0 : 3800,
        );
        assert.equal(
          database.prepare("SELECT count(*) AS n FROM catalog_sources").get().n,
          cancelled ? 0 : 1,
        );
      } finally {
        database.close();
      }
      const images = await readdir(path.join(results.profile, "images")).catch((error) => {
        if (error.code === "ENOENT") return [];
        throw error;
      });
      assert.equal(
        images.filter((name) => !name.includes(".thumb-v1-") && !name.startsWith(".")).length,
        cancelled ? 0 : 800,
      );
      assert.deepEqual(await readdir(path.join(results.profile, ".plugin-staging")), []);
      results.plugin[cancelled ? "cancelledDisk" : "completedDisk"] = {
        sourceItems: cancelled ? 0 : 3800,
        finalImages: cancelled ? 0 : 800,
        totalImageFiles: images.length,
      };
    }
    await runPluginInstallFlow({
      page,
      width,
      artifacts: evidence,
      zipPath: path.resolve(values["plugin-zip"]),
      results: results.plugin,
      verifyCancelled: () => inspectPlugin(true),
      verifyComplete: () => inspectPlugin(false),
    });
    record(
      "Packaged Mac plugin install: live progress, miniature edit, reload, cancel cleanup, atomic retry success",
    );
  }

  await application.context().tracing.stop({ path: path.join(evidence, "trace.zip") });
  tracing = false;
  await quit();
  assert.deepEqual(results.rendererErrors, []);
  record("Intentional production app.quit() exits with code 0 and no signal within 20 seconds");
  results.status = "PASS";
} catch (error) {
  results.status = "FAIL";
  results.failure = describe(error);
  process.exitCode = 1;
  if (page && !page.isClosed()) {
    await bounded(
      (async () => {
        await page.screenshot({ path: path.join(evidence, "failure.png"), timeout: 5000 });
        await writeFile(path.join(evidence, "failure.html"), await page.content());
      })(),
      10000,
      "Failure screenshot/DOM",
    ).catch((captureError) => {
      results.captureError = describe(captureError);
    });
  }
} finally {
  if (tracing) {
    await bounded(
      application.context().tracing.stop({ path: path.join(evidence, "trace.zip") }),
      10000,
      "Trace capture",
    ).catch((error) => {
      results.traceError = describe(error);
    });
  }
  if (child && child.exitCode === null && child.signalCode === null) {
    try {
      await quit();
      results.cleanup = "app.quit()";
    } catch (error) {
      results.cleanupError = describe(error);
      // Emergency cleanup is never a passing quit. Playwright owns this process
      // tree and can reap its server child too; do not kill unrelated processes.
      results.forcedCleanup = true;
      process.exitCode = 1;
      results.status = "FAIL";
      await bounded(application.close(), 10000, "Emergency owned-process cleanup").catch(() =>
        child.kill("SIGKILL"),
      );
    }
  }
  if (results.profile) {
    for (const directory of ["logs", "Crashpad", "Crash Reports"]) {
      const source = path.join(results.profile, "electron", directory);
      if (
        await stat(source).then(
          () => true,
          () => false,
        )
      ) {
        await cp(source, path.join(evidence, directory), { recursive: true }).catch((error) => {
          results.logCaptureError = describe(error);
        });
      }
    }
  }
  await writeFile(path.join(evidence, "stdout.log"), stdout);
  await writeFile(path.join(evidence, "stderr.log"), stderr);
  results.finishedAt = new Date().toISOString();
  // Retain the isolated fixture profile for diagnosis; never delete a user's data.
  await writeFile(path.join(evidence, "results.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
}
