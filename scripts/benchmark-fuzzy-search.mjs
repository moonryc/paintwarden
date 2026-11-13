// Synthetic only: does not open a vault/database. Run with the .nvmrc Node version.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";

import ts from "typescript";

import { createFuzzyIndex, searchFuzzyIndex } from "../packages/paint-core/fuzzy-search.ts";

assert.equal(process.version, "v22.22.2", "Use pinned .nvmrc Node for comparable measurements");
const baseline = process.argv[2] ?? "HEAD";
const original = execFileSync("git", ["show", `${baseline}:packages/paint-core/fuzzy-search.ts`], {
  encoding: "utf8",
});
const javascript = ts.transpileModule(original, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { fuzzyFilter: before } = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
);
const items = Array.from({ length: 12000 }, (_, i) => ({
  name: `${["Citadel", "Vallejo", "Army Painter"][i % 3]} ${["Base", "Layer", "Contrast", "Air"][i % 4]} ${["Wraithbone", "Mephiston Red", "Ultramarines Blue", "Abaddon Black", "Leadbelcher"][i % 5]} ${i}`,
}));
const text = (item) => item.name;
const queries = ["red", "wraith", "wrthbn", "mephston", "ultrmarines blu", "nothingmatched"];
const start = performance.now();
const index = createFuzzyIndex(items, text);
const indexMs = performance.now() - start;
for (const query of queries)
  assert.deepEqual(searchFuzzyIndex(index, query, 40), before(items, query, text, 40));
const measure = (fn) => {
  // Warm up both implementations, then median of five complete six-query batches.
  for (const query of queries) fn(query);
  const times = Array.from({ length: 5 }, () => {
    const at = performance.now();
    for (const query of queries) fn(query);
    return performance.now() - at;
  }).sort((a, b) => a - b);
  return +times[2].toFixed(2);
};
console.log(
  JSON.stringify(
    {
      node: process.version,
      baseline,
      rows: items.length,
      queries,
      limit: 40,
      indexMs: +indexMs.toFixed(2),
      beforeBatchMs: measure((q) => before(items, q, text, 40)),
      indexedBatchMs: measure((q) => searchFuzzyIndex(index, q, 40)),
    },
    null,
    2,
  ),
);
