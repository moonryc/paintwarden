import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile, mkdtemp } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import {
  outcome,
  counts,
  plannedChecks,
  assertNoSnapshot,
  sourceManifest,
  root,
} from "./graphql-phase4-support.mjs";
import { seedPhase4Fixture } from "./graphql-phase4-fixture.mjs";

test("Phase4 outcome never upgrades unrun checks to pass", () => {
  assert.equal(outcome([]), "NOT RUN");
  assert.equal(outcome([{ status: "NOT RUN" }]), "NOT RUN");
  assert.equal(outcome([{ status: "PASS" }, { status: "NOT RUN" }]), "PARTIAL");
  assert.equal(outcome([{ status: "PARTIAL" }]), "PARTIAL");
  assert.equal(outcome([{ status: "PASS" }, { status: "N/A" }]), "PASS");
  assert.equal(outcome([{ status: "FAIL" }, { status: "PASS" }]), "FAIL");
  assert.throws(() => outcome([{ status: "NOTRUN" }]));
  const checks = plannedChecks();
  assert.ok(checks.length >= 8);
  assert.ok(checks.every((check) => check.status === "NOT RUN"));
  assert.equal(new Set(checks.map(({ name }) => name)).size, checks.length);
  assert.equal(counts(checks)["NOT RUN"], checks.length);
  assert.equal(counts(checks).PASS, 0);
});

test("Phase4 prohibits snapshot endpoint regardless of query/HTTP status", () => {
  assertNoSnapshot([{ path: "/api/graphql" }, { path: "/api/graphql/stream" }]);
  assert.throws(() => assertNoSnapshot([{ path: "/api/state", status: 401 }]));
  assert.throws(() => assertNoSnapshot([{ path: "/api/state/", status: 200 }]));
});

test("Source manifest includes dirty/new tooling and lockfile actual hashes", async () => {
  const manifest = await sourceManifest();
  assert.match(manifest.head, /^[a-f0-9]{40}$/);
  assert.match(manifest.manifestSha256, /^[a-f0-9]{64}$/);
  for (const file of [
    "package-lock.json",
    "scripts/graphql-phase4-browser.mjs",
    "scripts/graphql-phase4-fixture.mjs",
  ]) {
    const entry = manifest.files.find((entry) => entry.path === file);
    assert.ok(entry, file);
    const bytes = await readFile(path.join(root, file));
    assert.equal(entry.sha256, createHash("sha256").update(bytes).digest("hex"));
    assert.equal(entry.bytes, bytes.length);
  }
});

test(
  "Browser plan never launches a browser/server/build and retains all screen checks",
  { skip: process.version !== "v22.22.2" },
  async () => {
    const evidence = await mkdtemp(path.join(os.tmpdir(), "pv-phase4-browser-plan-test-"));
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/graphql-phase4-browser.mjs"), evidence, "--profile", "stress"],
      { encoding: "utf8", timeout: 20000, env: { ...process.env, PATH: "" } },
    );
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(await readFile(path.join(evidence, "stress-results.json"), "utf8"));
    assert.equal(report.result, "NOT RUN");
    assert.equal(report.profile, "stress");
    assert.equal(report.checks.length, plannedChecks().length);
    assert.ok(report.checks.every((check) => check.status === "NOT RUN"));
    assert.deepEqual(report.artifacts, []);
    assert.equal(report.sourceManifest, undefined);
  },
);

test("Phase4 fixture extends compatible Phase3 records using ordinary commands only", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const body = options.body && JSON.parse(options.body);
    calls.push({ url, method: options.method, body });
    let data = {};
    if (url.includes("catalog?"))
      data = { items: [{ id: "missing-paint", name: "Phase4Probe wishlist blue" }] };
    else if (url === "/api/miniatures") data = { id: "wishlist-miniature" };
    else if (url === "/api/color-schemes") data = { id: "editable-scheme" };
    else if (url === "/api/miniature-templates") data = { id: "editable-template" };
    return { ok: true, status: 200, json: async () => data };
  };
  try {
    const page = {
      evaluate: async (fn, args) => {
        if (args.miniatures)
          return {
            paintId: "ready-paint",
            prefix: "Phase3Probe",
            miniatures: args.miniatures,
            miniatureId: "ready-miniature",
          };
        return fn(args);
      },
    };
    const fixture = await seedPhase4Fixture(page, { profile: "stress" });
    assert.equal(fixture.miniatures, 1000);
    assert.equal(fixture.prefix, "Phase3Probe");
    assert.equal(fixture.phase4.prefix, "Phase4Probe");
    assert.equal(fixture.miniatureId, "ready-miniature");
    assert.equal(fixture.templateId, "editable-template");
    assert.equal(fixture.missingPaintId, "missing-paint");
    assert.ok(calls.every(({ url }) => url !== "/api/state"));
    assert.ok(calls.some(({ body }) => body?.state === "WISHLIST" && body.quantity === 0));
    assert.ok(
      calls.some(
        ({ body }) => body?.miniatureId === "wishlist-miniature" && body.paintId === "missing-paint",
      ),
    );
    assert.ok(calls.some(({ body }) => body?.schemeIds?.includes("editable-scheme")));
    await assert.rejects(seedPhase4Fixture(page, { profile: "personal-vault" }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Only successful same-scope STALE_CURSOR recovery is nonfatal", async () => {
  const { graphqlObservations } = await import("./graphql-phase4-errors.mjs");
  const error = (code) => ({
    status: 200,
    body: { operationName: "Page", variables: { search: "probe", after: "old" } },
    data: { errors: [{ extensions: { code } }] },
  });
  const success = {
    status: 200,
    body: { operationName: "Page", variables: { search: "probe", after: null } },
    data: { data: { page: { nodes: [] } } },
  };
  assert.equal(graphqlObservations([error("STALE_CURSOR"), success]).recoveredStaleCursors.length, 1);
  assert.equal(graphqlObservations([error("RATE_LIMITED"), success]).unexpected.length, 1);
  assert.equal(graphqlObservations([error("STALE_CURSOR")]).unexpected.length, 1);
  assert.equal(
    graphqlObservations([error("STALE_CURSOR"), success], [{ status: "FAIL" }]).unexpected.length,
    1,
  );
  assert.equal(
    graphqlObservations([
      error("STALE_CURSOR"),
      { ...success, body: { ...success.body, variables: { search: "other" } } },
    ]).unexpected.length,
    1,
  );
});
