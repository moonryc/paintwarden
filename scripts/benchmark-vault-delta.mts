// Run from apps/paint-vault: node --import tsx ../../scripts/benchmark-vault-delta.mts
// Every invocation creates and retains a new synthetic DATA_DIR; never opens an existing vault.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-delta-bench-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getSqlite } = await import("../apps/paint-vault/db/index.ts");
const { vaultChangesSince } = await import("../apps/paint-vault/lib/vault-state.ts");
const { changeLogEpoch, currentChangeSeq } = await import("../apps/paint-vault/db/change-log.ts");
const { testId } = await import("../apps/paint-vault/lib/test-ids.ts");
const sqlite = getSqlite();
try {
  const paints = Array.from({ length: 30_000 }, (_, i) => testId(`bench-paint-${i}`));
  const schemes = Array.from({ length: 3_000 }, (_, i) => testId(`bench-scheme-${i}`));
  sqlite.transaction(() => {
    const paint = sqlite.prepare(
      "INSERT INTO paint_catalog (id, brand, range, name) VALUES (?, 'Synthetic', 'Base', ?)",
    );
    const inventory = sqlite.prepare("INSERT INTO paint_inventory (paint_id, state) VALUES (?, 'OWNED')");
    for (const [i, id] of paints.entries()) {
      paint.run(id, `Paint ${i}`);
      inventory.run(id);
    }
    const scheme = sqlite.prepare(
      "INSERT INTO color_schemes (id, name, created_at) VALUES (?, 'Synthetic scheme', 1)",
    );
    const entry = sqlite.prepare(
      "INSERT INTO color_scheme_paints (scheme_id, paint_id, sort_order) VALUES (?, ?, ?)",
    );
    for (const [i, id] of schemes.entries()) {
      scheme.run(id);
      for (let order = 0; order < 8; order++) entry.run(id, paints[i * 8 + order], order);
    }
  })();
  const results: object[] = [];
  const nineRuns = 9;
  function measure(name: string, count: number, mutate: () => void) {
    const since = currentChangeSeq(sqlite);
    sqlite.transaction(mutate)();
    const run = () => {
      const delta = vaultChangesSince(changeLogEpoch, since);
      assert.equal(delta.reload, false);
      assert.equal(delta.changes.length, count);
      return delta;
    };
    for (let i = 0; i < 3; i++) run();
    const timings: number[] = [];
    for (let i = 0; i < nineRuns; i++) {
      const start = performance.now();
      run();
      timings.push(performance.now() - start);
    }
    const prepare = sqlite.prepare;
    let statements = 0;
    sqlite.prepare = function (...args: Parameters<typeof prepare>) {
      statements++;
      return prepare.apply(sqlite, args);
    } as typeof prepare;
    let bytes: number;
    try {
      bytes = Buffer.byteLength(JSON.stringify(run()));
    } finally {
      sqlite.prepare = prepare;
    }
    timings.sort((a, b) => a - b);
    results.push({ name, count, medianMs: timings[Math.floor(timings.length / 2)], statements, bytes });
  }
  for (const count of [0, 1, 500, 2000]) {
    measure("inventory", count, () => {
      const update = sqlite.prepare("UPDATE paint_inventory SET quantity = quantity + 1 WHERE paint_id = ?");
      for (const id of paints.slice(0, count)) update.run(id);
    });
  }
  measure("composite scheme paints", 2000, () => {
    const update = sqlite.prepare(
      "UPDATE color_scheme_paints SET updated_at = updated_at + 1 WHERE scheme_id = ?",
    );
    for (const id of schemes.slice(0, 250)) update.run(id);
  });
  measure("catalog with source lookup", 2000, () => {
    const update = sqlite.prepare("UPDATE paint_catalog SET name = name || ' updated' WHERE id = ?");
    for (const id of paints.slice(0, 2000)) update.run(id);
  });
  console.log(
    JSON.stringify(
      {
        directory,
        node: process.version,
        paints: paints.length,
        schemes: schemes.length,
        schemePaints: 24_000,
        measuredRuns: nineRuns,
        results,
      },
      null,
      2,
    ),
  );
} finally {
  sqlite.close();
}
