// Run: node --import tsx scripts/profile-plugin-install.mjs SYNTHETIC.zip OUTPUT.json
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { unzipSync, zipSync } from "fflate";

const zip = await readFile(path.resolve(process.argv[2]));
const files = unzipSync(zip);
const manifest = JSON.parse(Buffer.from(files["source.json"]).toString());
assert.equal(manifest.name, "Synthetic large plugin", "Only the procedural synthetic fixture is permitted");
assert.equal(manifest.attribution, "Procedural synthetic benchmark artwork");
const output = path.resolve(process.argv[3]);
const dataDir = await mkdtemp(path.join(tmpdir(), "paintwarden-install-profile-"));
process.env.DATA_DIR = dataDir;
delete process.env.DATABASE_PATH;
process.chdir(fileURLToPath(new URL("../apps/paintwarden/", import.meta.url)));
const { addUploadedCatalogSource, listCatalogSources } =
  await import("../apps/paintwarden/lib/catalog-sources.ts");
const runs = [];
async function measure(label, archive) {
  const start = performance.now();
  let stage = "reading",
    stamp = start,
    lastTick = start,
    maximumEventLoopGapMs = 0;
  const stages = {};
  const timer = setInterval(() => {
    const now = performance.now();
    maximumEventLoopGapMs = Math.max(maximumEventLoopGapMs, now - lastTick);
    lastTick = now;
  }, 1);
  try {
    const result = await addUploadedCatalogSource(archive, {
      progress(next) {
        if (next !== stage) {
          const now = performance.now();
          stages[stage] = (stages[stage] ?? 0) + now - stamp;
          stamp = now;
          stage = next;
        }
      },
    });
    const end = performance.now();
    stages[stage] = (stages[stage] ?? 0) + end - stamp;
    maximumEventLoopGapMs = Math.max(maximumEventLoopGapMs, end - lastTick);
    runs.push({
      label,
      result,
      stages,
      totalMs: end - start,
      maximumEventLoopGapMs,
      imageFiles: (await readdir(path.join(dataDir, "images"))).length,
    });
  } finally {
    clearInterval(timer);
  }
}
await measure("initial install", zip);
manifest.version = "1.0.1";
files["source.json"] = Buffer.from(JSON.stringify(manifest));
await measure("new version, unchanged image hashes", zipSync(files, { level: 0 }));
await measure("same version logo refresh", zipSync(files, { level: 0 }));
await writeFile(
  output,
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      dataDir,
      zipBytes: zip.length,
      counts: listCatalogSources()[0].counts,
      stageNote:
        "Commit stage includes image promotion, SQLite transaction, reference-safe image GC, and staging disposal; no slow image conversion inside transaction. Observed wall-clock samples, not guaranteed latency.",
      runs,
    },
    null,
    2,
  ),
);
console.log(output);
