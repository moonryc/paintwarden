import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

for (const kind of ["native", "docker"]) {
  const script = new URL(`./graphql-phase4-${kind}.mjs`, import.meta.url);
  const { parseOptions, summarizeChecks, mergeScenarioChecks } = await import(script);
  test(`${kind}: profile and explicit execution parsing`, () => {
    assert.equal(parseOptions(["/tmp/evidence"]).profile, "realistic");
    assert.equal(parseOptions(["/tmp/evidence"]).run, false);
    assert.equal(parseOptions(["--profile", "stress", "/tmp/evidence", "--run"]).profile, "stress");
    assert.equal(parseOptions(["--plan", "/tmp/evidence"]).run, false);
    assert.throws(() => parseOptions(["/tmp/evidence", "--profile", "other"]), /realistic or stress/);
    assert.throws(() => parseOptions(["/tmp/evidence", "--profile"]), /Missing profile/);
    assert.throws(() => parseOptions(["/tmp/evidence", "--plan", "--run"]), /not both/);
    assert.throws(() => parseOptions([]), /evidence directory/);
  });
  test(`${kind}: truthful result and exact status counts`, () => {
    const checks = (...statuses) => statuses.map((status) => ({ status }));
    assert.equal(summarizeChecks(checks("PASS")).result, "PASS");
    assert.equal(summarizeChecks(checks("NOT RUN", "NOT RUN")).result, "NOT RUN");
    assert.equal(summarizeChecks(checks("PASS", "NOT RUN")).result, "PARTIAL");
    assert.equal(summarizeChecks(checks("PASS", "PARTIAL")).result, "PARTIAL");
    assert.equal(summarizeChecks(checks("PASS", "FAIL", "NOT RUN")).result, "FAIL");
    const result = summarizeChecks(checks("PASS", "FAIL", "NOT RUN", "N/A"));
    assert.deepEqual(result.counts, { PASS: 1, FAIL: 1, "NOT RUN": 1, "N/A": 1 });
    assert.equal(result.total, 4);
    assert.equal(result.completed, 2);
    assert.equal(result.remaining, 1);
    assert.throws(() => summarizeChecks(checks("OK")), /Invalid check status/);
  });
  test(`${kind}: partial scenario preserves pending scope and separates clients`, () => {
    const checks = [
      { name: "native-local: Screen A", status: "NOT RUN", reason: "Pending" },
      { name: "native-local: Screen B", status: "NOT RUN", reason: "Pending" },
      { name: "native-remote: Screen A", status: "NOT RUN", reason: "Pending" },
    ];
    mergeScenarioChecks(checks, "native-local", [{ name: "Screen A", status: "PASS" }]);
    mergeScenarioChecks(checks, "native-local", [{ name: "Screen A", status: "PASS" }]);
    assert.equal(checks.length, 3);
    assert.equal(checks[0].status, "PASS");
    assert.equal(checks[0].reason, undefined);
    assert.equal(checks[1].status, "NOT RUN");
    assert.equal(checks[2].status, "NOT RUN");
    assert.equal(summarizeChecks(checks).result, "PARTIAL");
  });
  test(
    `${kind}: default plan requires no app, Docker daemon or browser`,
    {
      skip: process.version !== "v22.22.2" && "Runner requires exact Node 22.22.2",
    },
    async () => {
      const evidence = await mkdtemp(path.join(os.tmpdir(), `pv-phase4-${kind}-plan-test-`));
      // With no PATH, launching Docker, a browser or a build command would fail.
      const result = spawnSync(process.execPath, [fileURLToPath(script), evidence, "--profile", "stress"], {
        encoding: "utf8",
        timeout: 20000,
        env: { ...process.env, PATH: "" },
      });
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(await readFile(path.join(evidence, `${kind}-results.json`), "utf8"));
      assert.equal(report.result, "NOT RUN");
      assert.equal(report.profile, "stress");
      assert.ok(report.checks.every((check) => check.status === "NOT RUN"));
      assert.ok(report.checks.some((check) => /Windows/.test(check.name) && check.reason));
      assert.equal(report.counts["NOT RUN"], report.checks.length);
      assert.deepEqual(report.artifacts, []);
      assert.equal(report.sourceManifest, undefined);
    },
  );
}
