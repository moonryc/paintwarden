// node --import tsx scripts/benchmark-library.mts large [report.json]
// Fresh synthetic vault from UNCHANGED Phase 0 harness; never opens a supplied vault.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { execute, parse } from "graphql";
import { createLibraryFixture } from "./library-fixture.mjs";

assert.equal(process.version, "v22.22.2");
const root = fileURLToPath(new URL("..", import.meta.url));
const worker = process.argv[2] === "--worker";
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const summarize = (values: number[]) => ({
  median: median(values),
  min: Math.min(...values),
  max: Math.max(...values),
  p95: [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1],
});
if (!worker) {
  const profile = process.argv[2] ?? "large";
  const fixture = await createLibraryFixture(root, profile);
  const cold: Record<string, number>[] = [];
  let warm: unknown;
  // Fresh processes reset all derived caches. SQLite/OS page cache is NOT cold disk.
  for (let i = 0; i < 11; i++) {
    const run = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        path.join(root, "scripts/benchmark-library.mts"),
        "--worker",
        fixture.dataDir,
        i === 10 ? "warm" : "cold",
      ],
      {
        cwd: path.join(root, "apps/paintwarden"),
        encoding: "utf8",
        timeout: 300000,
        env: { ...process.env, DATA_DIR: fixture.dataDir, DATABASE_PATH: "", NODE_ENV: "test" },
      },
    );
    assert.equal(run.status, 0, run.stderr);
    const result = JSON.parse(run.stdout);
    cold.push(result.cold);
    if (result.warm) warm = result.warm;
  }
  const report = {
    measuredAt: new Date().toISOString(),
    node: process.version,
    profile,
    fixture,
    method:
      "Identical Phase 0 synthetic fixture. Full production LibraryPage document via GraphQL execute + JSON serialization. 11 fresh-process first operations (cold derived cache, NOT cold disk); warm 1 warmup + 11 samples. SQL instruments actual statement methods; transaction helper BEGIN/COMMIT excluded. setImmediate delay observes synchronous operation blocking, not a production event-loop histogram. No HTTP/auth/browser/Electron time. Mutation invalidation measured separately after warm samples.",
    coldSamples: cold,
    cold: Object.fromEntries(
      ["ms", "sqlExecutions", "jsonBytes", "eventLoopBlockMs"].map((key) => [
        key,
        summarize(cold.map((sample) => sample[key])),
      ]),
    ),
    warm,
    snapshotComparison: {
      phase0: JSON.parse(
        readFileSync(path.join(root, `docs/benchmarks/graphql-baseline-${profile}.json`), "utf8"),
      ).snapshot,
      current: null, // Snapshot endpoint removed in Phase 5; historical bytes above.
    },
  };
  const output = process.argv[3] ?? path.join(fixture.evidence, "library.json");
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} else {
  // Only the parent may supply its freshly generated fixture to internal workers.
  assert.ok(path.basename(process.argv[3]).startsWith("paintwarden-startup-"));
  process.env.DATA_DIR = process.argv[3];
  delete process.env.DATABASE_PATH;
  process.env.NODE_ENV = "test";
  const { getSqlite } = await import("../apps/paintwarden/db/index.ts");
  const { schema } = await import("../apps/paintwarden/graphql/server.ts");
  const db = getSqlite();
  const document = parse(
    readFileSync(path.join(root, "packages/vault-ui/src/dom/graphql/library.graphql"), "utf8"),
  );
  let sqlExecutions = 0;
  const prepare = db.prepare.bind(db);
  db.prepare = ((sql: string) => {
    const statement = prepare(sql);
    for (const method of ["get", "all", "run", "iterate"] as const) {
      const fn = statement[method];
      Object.defineProperty(statement, method, {
        value: (...args: unknown[]) => {
          sqlExecutions++;
          return Reflect.apply(fn, statement, args);
        },
      });
    }
    return statement;
  }) as typeof db.prepare;
  const run = async (variables: Record<string, unknown> = { first: 48 }) => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    sqlExecutions = 0;
    const start = performance.now();
    const loop = new Promise<number>((resolve) => setImmediate(() => resolve(performance.now() - start)));
    const result = await execute({
      schema,
      document,
      operationName: "LibraryPage",
      variableValues: variables,
      contextValue: {},
    });
    assert.equal(result.errors, undefined, JSON.stringify(result.errors));
    const text = JSON.stringify(result);
    const ms = performance.now() - start;
    const eventLoopBlockMs = await loop;
    return {
      ms,
      eventLoopBlockMs,
      sqlExecutions,
      jsonBytes: Buffer.byteLength(text),
      gzipBytes: gzipSync(text).length,
      result,
    };
  };
  try {
    const first = await run();
    const { result: _result, ...cold } = first;
    let warm;
    if (process.argv[4] === "warm") {
      warm = {} as Record<string, unknown>;
      for (const [label, variables] of Object.entries({
        first1: { first: 1 },
        first48: { first: 48 },
        first100: { first: 100 },
        owned: { first: 48, filter: "OWNED" },
        search: { first: 48, search: "Paint 001" },
        brand: { first: 48, brand: "Invented brand 2" },
      })) {
        await run(variables);
        const samples = [];
        for (let i = 0; i < 11; i++) {
          const { result: _data, ...sample } = await run(variables);
          samples.push(sample);
        }
        (warm as Record<string, unknown>)[label] = {
          variables,
          samples,
          ms: summarize(samples.map((s) => s.ms)),
          sqlExecutions: samples.map((s) => s.sqlExecutions),
          jsonBytes: samples[0].jsonBytes,
        };
      }
      const page = first.result.data!.library as { nodes: { id: string }[] };
      const { setPaintStock } = await import("../apps/paintwarden/lib/paint-stock.ts");
      setPaintStock({ paintId: page.nodes[0].id, state: "OWNED", quantity: 7 });
      const { result: _data, ...afterWrite } = await run();
      (warm as Record<string, unknown>).afterStockInvalidation = afterWrite;
    }
    console.log(JSON.stringify({ cold, warm }));
  } finally {
    db.close();
  }
}
