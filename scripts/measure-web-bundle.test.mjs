import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const script = fileURLToPath(new URL("./measure-web-bundle.mjs", import.meta.url));
function fixtures() {
  const root = mkdtempSync(path.join(tmpdir(), "paint-vault-bundle-test-"));
  const dirs = ["baseline", "candidate"].map((name) => path.join(root, name));
  for (const dir of dirs) {
    mkdirSync(path.join(dir, "assets"), { recursive: true });
    writeFileSync(path.join(dir, "assets/index-entry.js"), "entry");
    writeFileSync(path.join(dir, "assets/style.css"), "ignored css");
  }
  return dirs;
}
function run(dirs) {
  return spawnSync(process.execPath, [script, ...dirs], { encoding: "utf8" });
}

test("bundle measurement compares JS only and sums independent gzip sizes", () => {
  const dirs = fixtures();
  const chunk = "enabled Apollo debug chunk";
  writeFileSync(path.join(dirs[1], "assets/LibraryDebugPanel-test.js"), chunk);
  const result = run(dirs);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.baseline.jsBytes, 5);
  assert.equal(report.baseline.apolloDebugChunk.length, 0);
  assert.equal(report.candidate.apolloDebugChunk.length, 1);
  assert.equal(report.candidateMinusBaseline.jsBytes, Buffer.byteLength(chunk));
  assert.equal(report.candidateMinusBaseline.sumGzipBytes, gzipSync(chunk).length);
});

test("bundle measurement rejects stale hashed entries instead of inflating totals", () => {
  const dirs = fixtures();
  writeFileSync(path.join(dirs[1], "assets/index-stale.js"), "old output");
  const result = run(dirs);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Expected exactly one web entry/);
});
