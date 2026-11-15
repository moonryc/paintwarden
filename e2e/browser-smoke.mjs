// Production browser gate. First: npm ci && npx playwright install --with-deps chromium && npm run build
// Then: node e2e/browser-smoke.mjs (optional E2E_ARTIFACTS_DIR, absolute or relative to cwd).
// Additional isolated gates: --scheme-ranking and --no-refetch-loading.
// Requires Node >=22.13. Never connects to an existing server or uses a personal vault/catalog.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  runAutocompleteFlows,
  runBrowserFlows,
  runSchemeRankingFlows,
  runScanAggregateFlows,
  runNoRefetchLoadingFlows,
  runConnectionRecoveryFlows,
} from "./browser-flows.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const aggregate = process.argv.includes("--scan-aggregate");
const schemeRanking = process.argv.includes("--scheme-ranking");
const autocompleteSearch = process.argv.includes("--autocomplete-search");
const connectionRecovery = process.argv.includes("--connection-recovery");
const noRefetchLoading = process.argv.includes("--no-refetch-loading");
const artifactsRoot = process.env.E2E_ARTIFACTS_DIR
  ? path.resolve(process.env.E2E_ARTIFACTS_DIR)
  : await mkdtemp(path.join(os.tmpdir(), "paintwarden-browser-artifacts-"));
const artifacts = aggregate
  ? path.join(artifactsRoot, "scan-aggregate")
  : schemeRanking
    ? path.join(artifactsRoot, "scheme-ranking")
    : autocompleteSearch
      ? path.join(artifactsRoot, "autocomplete-search")
      : noRefetchLoading
        ? path.join(artifactsRoot, "no-refetch-loading")
        : artifactsRoot;
await mkdir(artifacts, { recursive: true });
const dataDir = await mkdtemp(path.join(os.tmpdir(), "paintwarden-browser-data-"));
const results = {
  startedAt: new Date().toISOString(),
  platform: process.platform,
  node: process.version,
  dataDir,
  checks: [],
  errors: [],
};
let child,
  browser,
  logs = "",
  overallTimer;
const pages = [];
const pendingResponses = new Set();
let interruptedSignal;
function interrupt(signal) {
  interruptedSignal = signal;
  process.exitCode = signal === "SIGINT" ? 130 : 143;
  child?.kill("SIGTERM");
  void browser?.close().catch(() => {});
}
const onSigint = () => interrupt("SIGINT");
const onSigterm = () => interrupt("SIGTERM");
process.on("SIGINT", onSigint);
process.on("SIGTERM", onSigterm);
function checkInterrupted() {
  if (interruptedSignal) throw Error(`Browser gate interrupted by ${interruptedSignal}`);
}

async function unusedPort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const { port } = socket.address();
  await new Promise((resolve, reject) => socket.close((error) => (error ? reject(error) : resolve())));
  return port === 3000 || port === 3175 ? unusedPort() : port;
}

async function startServer(port) {
  await access(path.join(repo, "apps/paintwarden/dist/server.mjs"));
  const env = {
    ...process.env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: String(port),
    DATA_DIR: dataDir,
  };
  // Never inherit a database override, desktop mode, or proxy/hostname policy from the caller.
  delete env.DATABASE_PATH;
  delete env.PAINTWARDEN_DESKTOP;
  delete env.PAINTWARDEN_TRUST_PROXY;
  delete env.PAINTWARDEN_ALLOWED_HOSTS;
  delete env.WEB_DIST;
  checkInterrupted();
  let startupLogs = "";
  child = spawn(process.execPath, ["server.mjs"], {
    cwd: path.join(repo, "apps/paintwarden/dist"),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(Error("Production server readiness timed out (30s)")), 30_000);
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("exit", exited);
      child.off("error", failed);
      error ? reject(error) : resolve();
    };
    const exited = (code) => finish(Error(`Production server exited before readiness: ${code}`));
    const failed = (error) => finish(error);
    child.once("exit", exited);
    child.once("error", failed);
    child.stdout.on("data", (bytes) => {
      logs += bytes;
      startupLogs += bytes;
      if (startupLogs.includes('"phase":"ready"')) finish();
    });
    child.stderr.on("data", (bytes) => {
      logs += bytes;
    });
  });
}

// This observes the real app's fetch-based SSE without replacing transport, injecting events,
// polling the server, or changing app state. The independent reader records delivered events.
function observeStream() {
  window.__browserE2E = { events: [], streams: 0, recoveries: 0 };
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const url = String(args[0] instanceof Request ? args[0].url : args[0]);
    const pathname = new URL(url, location.href).pathname;
    const isStream = pathname === "/api/graphql/stream";
    if (pathname === "/api/graphql" && typeof args[1]?.body === "string") {
      try {
        if (JSON.parse(args[1].body).operationName === "VaultInvalidation") window.__browserE2E.recoveries++;
      } catch {
        /* Not a GraphQL JSON request. */
      }
    }
    if (isStream) window.__browserE2E.streams++;
    const response = await originalFetch(...args);
    if (isStream && response.ok) {
      const reader = response.clone().body.getReader();
      void (async () => {
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let boundary;
            while ((boundary = buffer.indexOf("\n\n")) >= 0) {
              const event = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              if (event.includes("event: next")) {
                const data = event
                  .split("\n")
                  .find((line) => line.startsWith("data:"))
                  ?.slice(5)
                  .trim();
                if (data) window.__browserE2E.events.push(JSON.parse(data));
              }
            }
          }
        } catch {
          /* Closing the owned context cancels the stream. */
        }
      })();
    }
    return response;
  };
}

async function stopServer() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  let timer;
  await Promise.race([
    exited,
    new Promise((resolve) => {
      timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 5_000);
    }),
  ]);
  clearTimeout(timer);
  // Only the direct server process started above can be signalled; no pkill/port-based cleanup.
}

try {
  const port = await unusedPort();
  const baseURL = `http://127.0.0.1:${port}`;
  results.origin = baseURL;
  await startServer(port);
  checkInterrupted();
  browser = await chromium.launch({ headless: true, timeout: 30_000 });
  results.chromium = browser.version();
  checkInterrupted();
  async function newPage() {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 1050 },
      locale: "en-US",
      timezoneId: "UTC",
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    context.setDefaultTimeout(12_000);
    context.setDefaultNavigationTimeout(25_000);
    await context.addInitScript(observeStream);
    const page = await context.newPage();
    pages.push(page);
    page.on("pageerror", (error) => results.errors.push(error.message));
    page.on("request", (request) => {
      if (["/api/state", "/api/changes"].includes(new URL(request.url()).pathname))
        results.errors.push("Removed snapshot/polling API was requested");
    });
    page.on("response", (response) => {
      if (!new URL(response.url()).pathname.startsWith("/api/")) return;
      if (response.url().includes("/graphql/stream")) return;
      // The no-refetch regression deliberately rejects loaded-page background reads.
      if (
        noRefetchLoading &&
        response.status() === 429 &&
        response.headers()["x-paintwarden-e2e-expected"] === "background-rate-limit"
      )
        return;
      const task = (async () => {
        if (response.status() >= 400)
          results.errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
        if (new URL(response.url()).pathname === "/api/graphql") {
          const body = await response.json();
          if (body.errors?.length) results.errors.push(JSON.stringify(body.errors));
        }
      })().catch((error) => results.errors.push(`Response diagnostic: ${error.message}`));
      pendingResponses.add(task);
      void task.finally(() => pendingResponses.delete(task));
    });
    return page;
  }
  await Promise.race([
    (connectionRecovery
      ? runConnectionRecoveryFlows
      : aggregate
        ? runScanAggregateFlows
        : autocompleteSearch
          ? runAutocompleteFlows
          : noRefetchLoading
            ? runNoRefetchLoadingFlows
            : schemeRanking
              ? runSchemeRankingFlows
              : runBrowserFlows)({
      newPage,
      artifacts,
      results,
      stopServer,
      restartServer: () => startServer(port),
    }),
    new Promise((_, reject) => {
      overallTimer = setTimeout(() => reject(Error("Browser flows exceeded 240s")), 240_000);
    }),
  ]);
  await Promise.all([...pendingResponses]);
  assert.deepEqual(results.errors, [], "Browser/API errors");
  results.status = "PASS";
} catch (error) {
  results.status = "FAIL";
  results.failure = error.stack ?? String(error);
  process.exitCode = 1;
  for (const [index, page] of pages.entries()) {
    try {
      await page.screenshot({ path: path.join(artifacts, `failure-${index + 1}.png`), timeout: 5_000 });
      await writeFile(
        path.join(artifacts, `failure-${index + 1}.txt`),
        `URL: ${page.url()}\n${await page.locator("body").innerText({ timeout: 5_000 })}`,
      );
    } catch {
      /* Keep the primary failure if the browser has already exited. */
    }
  }
} finally {
  clearTimeout(overallTimer);
  process.off("SIGINT", onSigint);
  process.off("SIGTERM", onSigterm);
  await browser?.close().catch(() => {});
  await stopServer();
  results.finishedAt = new Date().toISOString();
  await writeFile(path.join(artifacts, "server.log"), logs);
  await writeFile(path.join(artifacts, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ ...results, artifacts }, null, 2));
}
