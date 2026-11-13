import assert from "node:assert/strict";
import { graphqlObservations } from "./graphql-phase4-errors.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHomeMiniaturesScenario, sourceSnapshot } from "./home-miniatures-smoke-support.mjs";
import { runPhase4Screens, checklistNames } from "./graphql-phase4-screens.mjs";

export { sourceSnapshot };
export const root = fileURLToPath(new URL("..", import.meta.url));
export const statuses = ["PASS", "FAIL", "PARTIAL", "NOT RUN", "N/A"];
export function outcome(checks) {
  for (const check of checks) assert.ok(statuses.includes(check.status), `Unknown status ${check.status}`);
  if (checks.some((check) => check.status === "FAIL")) return "FAIL";
  if (!checks.some((check) => ["PASS", "PARTIAL"].includes(check.status))) return "NOT RUN";
  if (checks.some((check) => ["PARTIAL", "NOT RUN"].includes(check.status))) return "PARTIAL";
  return "PASS";
}
export function counts(checks) {
  return checks.reduce(
    (result, check) => {
      assert.ok(statuses.includes(check.status));
      result[check.status] = (result[check.status] ?? 0) + 1;
      return result;
    },
    Object.fromEntries(statuses.map((status) => [status, 0])),
  );
}
export function plannedChecks(
  reason = "Planning only; explicit --run after stable-build approval is required.",
) {
  return [
    "Home/Miniatures full migrated workflow",
    ...checklistNames,
    "Entire recording: no snapshot, GraphQL or renderer errors",
  ].map((name) => ({ name, status: "NOT RUN", reason }));
}

// Include dirty/new implementation files as well as HEAD. This identifies the
// source observation, not a claim that an arbitrary pre-existing build matches it.
export async function sourceManifest() {
  const files = execFileSync(
    "/usr/bin/git",
    [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "apps",
      "packages",
      "scripts",
      "package.json",
      "package-lock.json",
      "codegen.ts",
      "Dockerfile",
      "compose.yaml",
      ".nvmrc",
      "nx.json",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 10000 },
  )
    .split("\0")
    .filter(Boolean);
  const manifest = [];
  for (const file of [...new Set(files)].sort()) {
    try {
      const bytes = await readFile(path.join(root, file));
      manifest.push({
        path: file,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      manifest.push({ path: file, deleted: true });
    }
  }
  return {
    ...sourceSnapshot(),
    files: manifest,
    manifestSha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
  };
}

export function assertNoSnapshot(requests) {
  assert.deepEqual(
    requests.filter((entry) => /^\/api\/state(?:\/|$)/.test(entry.path)),
    [],
    "No screen may request /api/state in Phase4",
  );
}

// Same concrete checklist used by Chromium, actual packaged local/remote, Docker.
// Check-level failures retain evidence and continue independent screen checks.
export async function runPhase4Scenario(options) {
  const { page, recorder, evidenceDir, label = "browser" } = options;
  await mkdir(evidenceDir, { recursive: true });
  const checks = [],
    metrics = {};
  const pass = (name, evidence) => checks.push({ status: "PASS", name, evidence });
  const check = async (name, action) => {
    try {
      // Human-like inter-task pacing avoids turning a functional UI sweep into
      // an artificial >120 operations/minute rate-limit test. Never bypass limits.
      await page.waitForTimeout(2500);
      const evidence = await action();
      pass(name, evidence);
      return true;
    } catch (error) {
      const screenshot = path.join(evidenceDir, `${label}-failure-${checks.length}.png`);
      await page.screenshot({ path: screenshot }).catch(() => {});
      checks.push({ status: "FAIL", name, detail: error.stack, screenshot });
      // Leave cancellation to the same user-facing Escape behavior, not DOM/state injection.
      await page.keyboard.press("Escape").catch(() => {});
      return false;
    }
  };
  const initial = recorder.mark();
  try {
    const prior = await runHomeMiniaturesScenario(options);
    checks.push(...prior.checks);
    metrics.homeMiniatures = prior.metrics;
    pass("Home/Miniatures full migrated workflow", { completedChecks: prior.checks.length });
  } catch (error) {
    checks.push(...(recorder.scenario?.checks ?? []));
    metrics.homeMiniatures = recorder.scenario?.metrics;
    checks.push({ status: "FAIL", name: "Home/Miniatures full migrated workflow", detail: error.stack });
    await page
      .screenshot({ path: path.join(evidenceDir, `${label}-home-miniatures-failure.png`) })
      .catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
  }
  recorder.scenario = { checks, metrics };
  const screenResult = await runPhase4Screens({ ...options, pass, check });
  checks.push(...(screenResult?.checks ?? []));
  await check("Entire recording: no snapshot, GraphQL or renderer errors", async () => {
    await recorder.settle();
    assertNoSnapshot(recorder.requests); // includes chooser/auth/fixture/setup
    const entries = recorder.slice(initial);
    const graphql = graphqlObservations(entries, checks);
    assert.deepEqual(
      graphql.unexpected,
      [],
      "No unexpected GraphQL errors; stale cursors require successful same-scope recovery",
    );
    assert.deepEqual(
      entries.filter((entry) => entry.status >= 500),
      [],
      "No API server errors",
    );
    assert.deepEqual(recorder.errors, [], "No renderer exceptions");
    assert.ok(
      recorder.requests.some((entry) => entry.path === "/api/graphql/stream" && entry.status === 200),
      "Production SSE connected successfully",
    );
    return {
      requestCount: recorder.requests.length,
      snapshotRequests: 0,
      rendererErrors: 0,
      unexpectedGraphqlErrors: 0,
      rawGraphqlErrorResponses: graphql.rawGraphqlErrorResponses,
      recoveredStaleCursors: graphql.recoveredStaleCursors,
    };
  });
  await writeFile(
    path.join(evidenceDir, `${label}-phase4-scenario.json`),
    JSON.stringify({ checks, metrics, result: outcome(checks), counts: counts(checks) }, null, 2) + "\n",
  );
  return { checks, metrics };
}
