import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Reuse the exact Phase 0 seed rows, extracted from the retired snapshot benchmark.
// Never accept a caller-provided DATA_DIR or DATABASE_PATH as fixture input.
export async function createLibraryFixture(root, profile = "large") {
  assert.equal(process.version, "v22.22.2", "Use pinned Node 22.22.2");
  assert.ok(["large", "stress"].includes(profile));
  const evidence = await mkdtemp(path.join(tmpdir(), `paint-vault-library-${profile}-`));
  const baselinePath = path.join(evidence, "fixture.json");
  const env = { ...process.env, BENCH_REPORT: baselinePath };
  delete env.DATABASE_PATH;
  delete env.DATA_DIR;
  const seeded = spawnSync(
    process.execPath,
    ["--import", "tsx", "../../scripts/seed-benchmark-vault.mts", profile],
    {
      cwd: path.join(root, "apps/paint-vault"),
      env,
      encoding: "utf8",
      timeout: 300000,
    },
  );
  await writeFile(path.join(evidence, "seed.log"), seeded.stdout + seeded.stderr);
  assert.equal(seeded.status, 0, `Phase 0 fixture failed: ${seeded.stderr}`);
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  assert.ok(baseline.dataDir.startsWith(path.join(tmpdir(), "paint-vault-startup-")));
  return { evidence, baselinePath, baseline, dataDir: baseline.dataDir };
}
