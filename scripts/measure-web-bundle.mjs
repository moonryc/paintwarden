import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

// Compare two CLEAN Vite web builds. Build outside the project with --emptyOutDir;
// otherwise old hashed chunks can silently inflate an asset-directory measurement.
const [baselineDir, candidateDir] = process.argv.slice(2);
assert.ok(
  baselineDir && candidateDir,
  "Usage: node scripts/measure-web-bundle.mjs <baseline-dist> <candidate-dist>",
);

async function measure(directory) {
  const assets = path.resolve(directory, "assets");
  const names = (await readdir(assets)).filter((name) => name.endsWith(".js")).sort();
  const files = await Promise.all(
    names.map(async (file) => {
      const data = await readFile(path.join(assets, file));
      return { file, bytes: data.length, gzipBytes: gzipSync(data).length };
    }),
  );
  const entry = files.filter(({ file }) => /^index-[\w-]+\.js$/.test(file));
  assert.equal(entry.length, 1, `Expected exactly one web entry in ${assets}; use clean build outputs`);
  return {
    directory: path.resolve(directory),
    jsBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    sumGzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
    entry: entry[0],
    apolloDebugChunk: files.filter(({ file }) => file.startsWith("LibraryDebugPanel-")),
    files,
  };
}

const baseline = await measure(baselineDir);
const candidate = await measure(candidateDir);
process.stdout.write(
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      node: process.version,
      method:
        "Emitted .js assets only, summed raw bytes and per-file gzipSync default level 6. Excludes CSS/maps/fonts; not startup transfer or parse time.",
      baseline,
      candidate,
      candidateMinusBaseline: {
        jsBytes: candidate.jsBytes - baseline.jsBytes,
        sumGzipBytes: candidate.sumGzipBytes - baseline.sumGzipBytes,
      },
    },
    null,
    2,
  ) + "\n",
);
