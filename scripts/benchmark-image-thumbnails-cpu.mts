// Run from apps/paint-vault using Node 22.22.2 --import tsx.
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

assert.equal(process.version, "v22.22.2");
const evidence = path.resolve(import.meta.dirname, "../../../paint-tracker-audit/thumbnails");
const fixture = JSON.parse(await readFile(path.join(evidence, "photo-fixture.json"), "utf8"));
const directory = await mkdtemp(path.join(os.tmpdir(), "paint-thumbnails-cpu-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { imageResponse } = await import("../apps/paint-vault/lib/image-store.ts");
await mkdir(path.join(directory, "images"));
const cases = [];
let originalBytes = 0;
for (const photo of fixture.photos) {
  const filename = path.join(directory, "images", photo.key);
  await cp(path.join(fixture.dataDir, "images", photo.key), filename);
  originalBytes += photo.bytes;
  for (const width of [160, 320, 640]) {
    const cpu = process.cpuUsage();
    const start = performance.now();
    const response = await imageResponse(
      photo.key,
      new Request(`http://fixture/image?v=${photo.key}&w=${width}`),
    );
    assert.equal(response.status, 200);
    const bytes = (await response.arrayBuffer()).byteLength;
    const usage = process.cpuUsage(cpu);
    cases.push({
      key: photo.key,
      width,
      bytes,
      wallMs: performance.now() - start,
      cpuMs: (usage.user + usage.system) / 1000,
    });
  }
}
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
const byWidth = [160, 320, 640].map((width) => {
  const samples = cases.filter((entry) => entry.width === width);
  return {
    width,
    samples: samples.length,
    meanWallMs: mean(samples.map((entry) => entry.wallMs)),
    meanCpuMs: mean(samples.map((entry) => entry.cpuMs)),
    totalBytes: samples.reduce((total, entry) => total + entry.bytes, 0),
  };
});
const derivedBytes = byWidth.reduce((total, entry) => total + entry.totalBytes, 0);
const files = await readdir(path.join(directory, "images"));
assert.equal(files.length, fixture.photos.length * 4);
const measuredBytes = await Promise.all(
  files.map(async (file) => (await stat(path.join(directory, "images", file))).size),
);
assert.equal(
  measuredBytes.reduce((a, b) => a + b, 0),
  originalBytes + derivedBytes,
);
const result = {
  measuredAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  method:
    "Sequential cold derivative misses (32 detailed 3.84MP JPEGs × 3 widths), process.cpuUsage user+system around generation plus consuming streamed response; one Node process with libvips concurrency1. OS filesystem cache not cold. Not process-level isolation or a percentile, and not startup CPU. Originals retained in separate temporary data directory.",
  dataDirectory: directory,
  byWidth,
  originalBytes,
  derivedBytes,
  overheadPercent: (derivedBytes / originalBytes) * 100,
  cases,
};
await writeFile(path.join(evidence, "cpu-disk.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ ...result, cases: undefined }, null, 2));
