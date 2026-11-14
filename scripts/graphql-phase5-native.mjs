#!/usr/bin/env node
// One real packaged profile: local -> remote -> local through actual Settings UI.
// Never builds. No connection/auth DOM or bridge injection; CDP only drives normal controls.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { sourceManifest, outcome, counts } from "./graphql-phase4-support.mjs";
import { attachLibraryRecorder } from "./library-smoke-support.mjs";
import {
  parseOptions as parseBase,
  freePort,
  launchOwned,
  waitForOutput,
  stopOwned,
  identity,
} from "./smoke-library-native.mjs";
import {
  nav,
  setupOwner,
  signIn,
  request,
  librarySearch,
  redact,
  scrubLogs,
} from "./graphql-phase5-support.mjs";

export const nativeCheckNames = [
  "First-run packaged local owner and unique local fixture",
  "Local connection, owner and fixture persist after intentional quit/relaunch",
  "Same profile switches local to remote through Settings UI without vault/session bleed",
  "Remote connection, owner and fixture persist after intentional quit/relaunch",
  "Same profile switches remote back to original local through Settings UI",
  "Original local connection and vault persist after final quit/relaunch",
  "Packaged recordings remain retired-route and error free",
];
export function parseOptions(args) {
  const plan = args.includes("--plan");
  const options = parseBase(args.filter((arg) => arg !== "--plan"));
  assert.ok(!(plan && options.run), "Use --plan or --run, not both");
  return options;
}
async function main() {
  assert.equal(process.version, "v22.22.2", "Use pinned Node22.22.2, including plan mode");
  const options = parseOptions(process.argv.slice(2));
  const dir = options.evidenceDir;
  await mkdir(dir, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    node: process.version,
    mode: options.run ? "run" : "plan",
    checks: nativeCheckNames.map((name) => ({
      name,
      status: "NOT RUN",
      reason: "Explicit --run against stable approved packaged .app required.",
    })),
    artifacts: [],
    scope:
      "Actual macOS packaged server switching/persistence extension. Combine with Phase4 native and Phase5 browser/Docker checks. Windows/signing are out of scope.",
    sourceBuildLink:
      "Source observation and existing packaged artifact manifests are independent; approval must establish build correspondence.",
  };
  const processes = [],
    recordings = [];
  let page, native, activeCheck;
  const check = async (i, action) => {
    activeCheck = report.checks[i];
    const detail = await action();
    Object.assign(activeCheck, { status: "PASS", evidence: detail });
    delete activeCheck.reason;
  };
  try {
    if (options.run) {
      assert.equal(process.platform, "darwin", "Requires actual packaged macOS app");
      assert.ok(options.app?.endsWith(".app"), "--app must name an existing packaged .app");
      const app = path.resolve(options.app);
      const resources = path.join(app, "Contents/Resources");
      const executable = path.join(app, "Contents/MacOS/Paintwarden");
      report.packagedApp = app;
      assert.equal(
        execFileSync(path.join(resources, "server/node"), ["--version"], {
          encoding: "utf8",
          timeout: 10000,
        }).trim(),
        "v22.22.2",
      );
      report.sourceManifest = await sourceManifest();
      report.artifacts.push(await identity(process.execPath));
      for (const entry of await readdir(app, { recursive: true, withFileTypes: true })) {
        const file = path.join(entry.parentPath, entry.name);
        if (entry.isFile()) report.artifacts.push(await identity(file));
        else if (entry.isSymbolicLink())
          report.artifacts.push({ path: file, type: "symlink", target: await readlink(file) });
      }
      await writeFile(
        path.join(dir, "native-artifact-manifest.json"),
        JSON.stringify(report.artifacts, null, 2) + "\n",
      );
      const desktopData = await mkdtemp(path.join(os.tmpdir(), "pv-phase5-switch-profile-"));
      const remoteData = await mkdtemp(path.join(os.tmpdir(), "pv-phase5-switch-remote-"));
      const port = await freePort();
      const remoteBase = `http://127.0.0.1:${port}`;
      report.fixture = { desktopData, remoteData, remoteBase, retained: true, profileCount: 1 };
      const remote = launchOwned(
        path.join(resources, "server/node"),
        ["server.mjs"],
        {
          cwd: path.join(resources, "server"),
          env: {
            ...process.env,
            DATABASE_PATH: "",
            HOST: "127.0.0.1",
            PORT: String(port),
            DATA_DIR: remoteData,
            WEB_DIST: path.join(resources, "web-dist"),
            PAINTWARDEN_DISABLE_UPDATES: "1",
          },
        },
        path.join(dir, "remote-server.log"),
      );
      processes.push(remote);
      await waitForOutput(remote, /Nest application successfully started/, "isolated packaged remote server");
      const launch = async (label) => {
        const debugPort = await freePort();
        native = launchOwned(
          executable,
          [`--remote-debugging-port=${debugPort}`, "--remote-debugging-address=127.0.0.1"],
          {
            env: {
              ...process.env,
              DATABASE_PATH: "",
              PAINTWARDEN_DESKTOP_DATA_DIR: desktopData,
              WEB_DIST: path.join(resources, "web-dist"),
              PAINTWARDEN_DISABLE_UPDATES: "1",
            },
          },
          path.join(dir, `${label}-electron.log`),
        );
        processes.push(native);
        await waitForOutput(native, /DevTools listening on ws:/, `${label} packaged CDP`);
        const browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
        const context = browser.contexts()[0];
        page = context.pages()[0] ?? (await context.waitForEvent("page"));
        const recorder = attachLibraryRecorder(page);
        recordings.push({ label, recorder });
        await page.waitForURL("paintwarden://app/**");
        return recorder;
      };
      const quit = async () => {
        const exit = new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Window close did not intentionally quit within 10s")),
            10000,
          );
          native.child.once("exit", (code, signal) => {
            clearTimeout(timeout);
            resolve({ code, signal });
          });
        });
        await page.close();
        const result = await exit;
        assert.equal(result.code, 0, "Intentional native quit must exit cleanly");
        await native.save();
        return result;
      };
      const marker = (mode) => `Phase5 ${mode} switching marker`;
      const seed = async (mode) =>
        request(page, "/api/catalog", {
          method: "POST",
          expected: 201,
          json: {
            paints: [
              {
                brand: "Isolated Phase5",
                range: "Server switching",
                name: marker(mode),
                colorHex: mode === "local" ? "#123456" : "#abcdef",
              },
            ],
          },
        });
      const verify = async (mode, recorder) => {
        const auth = await request(page, "/api/auth/status");
        assert.equal(auth.setupRequired, false);
        assert.equal(auth.authenticated, true);
        await librarySearch(page, marker(mode), true, recorder);
        await librarySearch(page, marker(mode === "local" ? "remote" : "local"), false, recorder);
        await librarySearch(page, marker(mode), true, recorder);
        // Production getConnection is read-only observation, never used to change connection.
        const connection = await page.evaluate(() => window.paintwardenDesktop.getConnection());
        assert.equal(connection.mode, mode);
        if (mode === "remote") assert.equal(connection.serverUrl, remoteBase);
        const screenshot = path.join(dir, `native-${recordings.at(-1).label}-${mode}.png`);
        await page.screenshot({ path: screenshot });
        return {
          mode,
          serverUrl: connection.serverUrl,
          expectedMarker: marker(mode),
          oppositeMarkerAbsent: true,
          screenshot,
        };
      };
      const relaunch = async (mode, label) => {
        const exit = await quit();
        const recorder = await launch(label);
        // No chooser interaction on relaunch: retained production connection must initialize itself.
        await page.getByRole("button", { name: "Sign in", exact: true }).waitFor({ timeout: 30000 });
        assert.equal(
          await page.getByRole("button", { name: "Use this computer", exact: true }).count(),
          0,
          "Saved connection must bypass first-run chooser",
        );
        await signIn(page);
        return { ...(await verify(mode, recorder)), exit, normalSignInRequired: true };
      };
      let recorder;
      await check(0, async () => {
        recorder = await launch("initial-local");
        await page.getByRole("button", { name: "Use this computer", exact: true }).click();
        await setupOwner(page);
        await seed("local");
        return verify("local", recorder);
      });
      await check(1, () => relaunch("local", "retained-local"));
      await check(2, async () => {
        await nav(page, "Data & settings");
        await page.getByRole("button", { name: "Change server", exact: true }).click();
        await page.getByLabel("Server URL", { exact: true }).fill(remoteBase);
        await page.getByRole("button", { name: "Connect to server", exact: true }).click();
        await setupOwner(page); // Fresh remote server, not a reused local session/account.
        await seed("remote");
        return verify("remote", recordings.at(-1).recorder);
      });
      await check(3, () => relaunch("remote", "retained-remote"));
      await check(4, async () => {
        await nav(page, "Data & settings");
        await page.getByRole("button", { name: "Change server", exact: true }).click();
        await page.getByRole("button", { name: "Use this computer", exact: true }).click();
        // Switching clears the proxy session; use the real owner sign-in form.
        await signIn(page);
        return verify("local", recordings.at(-1).recorder);
      });
      await check(5, () => relaunch("local", "final-local"));
      report.finalIntentionalQuit = await quit();
      await check(6, async () => {
        for (const { recorder } of recordings) {
          await recorder.settle();
          assert.deepEqual(recorder.errors, []);
          assert.deepEqual(
            recorder.requests.filter((e) => /^\/api\/(state|changes)(\/|$)/.test(e.path)),
            [],
          );
          assert.deepEqual(
            recorder.requests.filter((e) => e.status >= 400 || e.data?.errors?.length),
            [],
            "Native errors may not be masked",
          );
        }
        return { recordings: recordings.length, profileCount: 1, originalConnectionRestored: "local" };
      });
    }
  } catch (error) {
    const failure = activeCheck ?? { name: "Native switching harness" };
    Object.assign(failure, { status: "FAIL", detail: error.stack });
    if (!report.checks.includes(failure)) report.checks.push(failure);
    if (page && !page.isClosed()) {
      try {
        report.failureBody = await page.locator("body").innerText();
        await page.screenshot({ path: path.join(dir, "native-failure.png") });
      } catch (captureError) {
        report.checks.push({ name: "Failure capture", status: "FAIL", detail: captureError.stack });
      }
    }
  } finally {
    for (const owned of processes.reverse()) {
      try {
        await stopOwned(owned.child);
        await owned.save();
      } catch (error) {
        report.checks.push({ name: "Owned process cleanup", status: "FAIL", detail: error.stack });
      }
    }
    for (const { label, recorder } of recordings) {
      try {
        await recorder.settle();
        await writeFile(
          path.join(dir, `${label}-raw-evidence.json`),
          JSON.stringify(redact({ requests: recorder.requests, errors: recorder.errors }), null, 2) + "\n",
        );
      } catch (error) {
        report.checks.push({ name: `${label} evidence retention`, status: "FAIL", detail: error.stack });
      }
    }
    if (report.sourceManifest) {
      try {
        report.sourceManifestAfter = await sourceManifest();
        assert.equal(
          report.sourceManifestAfter.manifestSha256,
          report.sourceManifest.manifestSha256,
          "Source changed during run",
        );
        for (const artifact of report.artifacts) {
          if (artifact.type === "symlink") assert.equal(await readlink(artifact.path), artifact.target);
          else
            assert.equal(
              (await identity(artifact.path)).sha256,
              artifact.sha256,
              `Runtime changed: ${artifact.path}`,
            );
        }
        report.checks.push({ name: "Source and packaged runtime unchanged during run", status: "PASS" });
      } catch (error) {
        report.checks.push({ name: "Source/artifact stability", status: "FAIL", detail: error.stack });
      }
    }
    try {
      await scrubLogs(dir);
    } catch (error) {
      report.checks.push({ name: "Credential-safe log retention", status: "FAIL", detail: error.stack });
    }
    report.result = outcome(report.checks);
    report.counts = counts(report.checks);
    report.finishedAt = new Date().toISOString();
    if (report.result === "FAIL") process.exitCode = 1;
    await writeFile(path.join(dir, "native-results.json"), JSON.stringify(redact(report), null, 2) + "\n");
    console.log(JSON.stringify({ result: report.result, counts: report.counts }, null, 2));
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
