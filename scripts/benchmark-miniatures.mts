// node --import tsx scripts/benchmark-miniatures.mts large [report.json]
// Always uses the unchanged Phase 0 synthetic fixture generator; never a caller's vault.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { execute, parse } from "graphql";
import { createLibraryFixture } from "./library-fixture.mjs";

assert.equal(process.version, "v22.22.2", "Use pinned Node 22.22.2");
const root = fileURLToPath(new URL("..", import.meta.url));
// Resolve Apollo from its declaring UI workspace (npm may install it locally).
const { addTypenameToDocument } = createRequire(
  new URL("../packages/vault-ui/package.json", import.meta.url),
)("@apollo/client/utilities");
const n = 11;
function runtimeIdentity() {
  const files: { file: string; sha256: string }[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(relative);
      else if (/\.(ts|graphql)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) {
        files.push({
          file: relative,
          sha256: createHash("sha256")
            .update(readFileSync(path.join(root, relative)))
            .digest("hex"),
        });
      }
    }
  };
  for (const directory of [
    "apps/paint-vault/graphql",
    "apps/paint-vault/lib",
    "apps/paint-vault/db",
    "packages/paint-core",
  ])
    visit(directory);
  for (const file of ["miniature-list.graphql", "navigation.graphql"]) {
    const relative = path.join("packages/vault-ui/src/dom/graphql", file);
    files.push({
      file: relative,
      sha256: createHash("sha256")
        .update(readFileSync(path.join(root, relative)))
        .digest("hex"),
    });
  }
  files.sort((a, b) => a.file.localeCompare(b.file));
  return { sha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"), files };
}
const summarize = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: values.length,
    median: sorted[Math.floor(values.length / 2)],
    p95: sorted[Math.ceil(values.length * 0.95) - 1],
    min: sorted[0],
    max: sorted.at(-1),
  };
};
type Sample = {
  ms: number;
  eventLoopBlockMs: number;
  sqlExecutions: number;
  jsonBytes: number;
  gzipBytes: number;
};
const summary = (samples: Sample[]) =>
  Object.fromEntries(
    ["ms", "eventLoopBlockMs", "sqlExecutions", "jsonBytes", "gzipBytes"].map((key) => [
      key,
      summarize(samples.map((sample) => sample[key as keyof Sample])),
    ]),
  );
const operation = process.argv[4];
if (process.argv[2] !== "--worker") {
  const profile = process.argv[2] ?? "large";
  const identity = runtimeIdentity();
  const fixture = await createLibraryFixture(root, profile);
  const reports: Record<string, unknown> = {};
  // Home goes last: its final worker mutates the retained fixture only AFTER
  // every cold and warm initial-fixture measurement has completed.
  for (const scenario of ["miniatures", "launch", "home"]) {
    const cold: Sample[] = [];
    const launchComponents: { navigation: Sample; home: Sample }[] = [];
    let last;
    for (let i = 0; i < n; i++) {
      const run = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          path.join(root, "scripts/benchmark-miniatures.mts"),
          "--worker",
          fixture.dataDir,
          scenario,
          i === n - 1 ? "warm" : "cold",
        ],
        {
          cwd: path.join(root, "apps/paint-vault"),
          encoding: "utf8",
          timeout: 240000,
          maxBuffer: 16 * 1024 * 1024,
          env: { ...process.env, DATA_DIR: fixture.dataDir, DATABASE_PATH: "", NODE_ENV: "test" },
        },
      );
      assert.equal(run.status, 0, run.stderr);
      last = JSON.parse(run.stdout);
      assert.equal(
        last.runtimeSha256,
        identity.sha256,
        "Runtime changed during benchmark; coordinate a stable source window and rerun",
      );
      cold.push(last.cold);
      if (last.coldComponents) launchComponents.push(last.coldComponents);
    }
    reports[scenario] = {
      cold: summary(cold),
      coldSamples: cold,
      warm: last.warm,
      documents: last.documents,
      observations: last.observations,
      coldComponents: launchComponents.length
        ? {
            navigation: summary(launchComponents.map((sample) => sample.navigation)),
            home: summary(launchComponents.map((sample) => sample.home)),
            samples: launchComponents,
          }
        : undefined,
    };
  }
  const phase0 = JSON.parse(
    readFileSync(path.join(root, `docs/benchmarks/graphql-baseline-${profile}.json`), "utf8"),
  );
  assert.equal(runtimeIdentity().sha256, identity.sha256, "Runtime changed during benchmark");
  const report = {
    runtime: identity,
    measuredAt: new Date().toISOString(),
    node: process.version,
    profile,
    fixture,
    source: {
      head: spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim(),
      changes: spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout,
    },
    method:
      "Actual production documents with Apollo addTypenameToDocument, GraphQL execute and JSON serialization. 11 independent fresh-process first operations per scenario; cold DERIVED caches, NOT cold disk or import/startup time. Warm uses one warmup plus 11 samples. launch is navigation then Home in one process (sum operation ms/SQL/bytes, maximum per-operation setImmediate block). SQL counts actual all/get/run/iterate statement calls, excluding transaction helper BEGIN/COMMIT and trigger internals. setImmediate probe measures synchronous operation blocking, NOT a production event-loop-delay histogram. Excludes HTTP/auth/TCP/browser/React/Electron and non-projection startup traffic. Gzip bytes are size only, not timed. Eleven-sample p95 is the largest observation. Stock rebuilds are separate from writes, 11 repeated revisions in the final home worker.",
    snapshotComparison: {
      phase0: phase0.snapshot,
      currentSameFixture: null, // Snapshot removed; seed rows remain identical.
      phase0SnapshotPlusTemplateSummariesBytes: phase0.snapshotPlusTemplateSummariesBytes,
    },
    scenarios: reports,
  };
  const text = JSON.stringify(report, null, 2) + "\n";
  writeFileSync(process.argv[3] ?? path.join(fixture.evidence, "miniatures.json"), text);
  process.stdout.write(text);
} else {
  // Internal path only: freshly created synthetic fixture root, not arbitrary DB input.
  const dataDir = path.resolve(process.argv[3]);
  assert.ok(dataDir.startsWith(path.join(tmpdir(), "paint-vault-startup-")));
  process.env.DATA_DIR = dataDir;
  delete process.env.DATABASE_PATH;
  process.env.NODE_ENV = "test";
  const identity = runtimeIdentity();
  const { getSqlite } = await import("../apps/paint-vault/db/index.ts");
  const { schema } = await import("../apps/paint-vault/graphql/server.ts");
  const { miniatureProjectionDiagnostics } = await import("../apps/paint-vault/graphql/miniatures.ts");
  const db = getSqlite();
  const listFile = path.join(root, "packages/vault-ui/src/dom/graphql/miniature-list.graphql");
  const navigationFile = path.join(root, "packages/vault-ui/src/dom/graphql/navigation.graphql");
  const listSource = readFileSync(listFile, "utf8");
  const navigationSource = readFileSync(navigationFile, "utf8");
  const documents = {
    list: {
      file: path.relative(root, listFile),
      sha256: createHash("sha256").update(listSource).digest("hex"),
    },
    navigation: {
      file: path.relative(root, navigationFile),
      sha256: createHash("sha256").update(navigationSource).digest("hex"),
    },
  };
  const list = addTypenameToDocument(parse(listSource));
  const navigation = addTypenameToDocument(parse(navigationSource));
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
  const run = async (which: string, variables: Record<string, unknown> = {}) => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    sqlExecutions = 0;
    const start = performance.now();
    const loop = new Promise<number>((resolve) => setImmediate(() => resolve(performance.now() - start)));
    const result = await execute({
      schema,
      document: which === "navigation" ? navigation : list,
      variableValues:
        which === "navigation"
          ? variables
          : { workbench: which === "home", first: 48, after: null, search: "", ...variables },
      contextValue: {},
    });
    assert.equal(result.errors, undefined, JSON.stringify(result.errors));
    const text = JSON.stringify(result);
    const ms = performance.now() - start;
    const eventLoopBlockMs = await loop;
    const sample: Sample = {
      ms,
      eventLoopBlockMs,
      sqlExecutions,
      jsonBytes: Buffer.byteLength(text),
      gzipBytes: gzipSync(text).length,
    };
    if (which === "home")
      assert.ok(sample.jsonBytes < 100000, "Initial Home data must remain under 100KB, images excluded");
    const data = result.data as Record<string, any>;
    if (which !== "navigation") {
      const page = data[which].miniatures;
      assert.ok(page.nodes.length <= Number(variables.first ?? 48));
      for (const tile of page.nodes) {
        assert.equal(tile.notes, undefined);
        assert.equal(tile.recipe, undefined);
        assert.ok(tile.previewSwatches.length <= 8);
      }
    }
    return { sample, data };
  };
  const launch = async () => {
    const nav = await run("navigation");
    const home = await run("home");
    return {
      sample: {
        ms: nav.sample.ms + home.sample.ms,
        eventLoopBlockMs: Math.max(nav.sample.eventLoopBlockMs, home.sample.eventLoopBlockMs),
        sqlExecutions: nav.sample.sqlExecutions + home.sample.sqlExecutions,
        jsonBytes: nav.sample.jsonBytes + home.sample.jsonBytes,
        gzipBytes: nav.sample.gzipBytes + home.sample.gzipBytes,
      },
      data: home.data,
      components: { navigation: nav.sample, home: home.sample },
    };
  };
  const once = () => (operation === "launch" ? launch() : run(operation));
  try {
    const initial = await once();
    const view = initial.data[operation === "miniatures" ? "miniatures" : "home"];
    const observations = {
      totalCount: view.miniatures.totalCount,
      loaded: view.miniatures.nodes.length,
      counts: view.counts,
      ownershipCounts: view.ownershipCounts,
      stageCounts: view.stageCounts,
    };
    const profileMiniatures = path.basename(dataDir).startsWith("paint-vault-startup-large-") ? 1500 : 10000;
    assert.equal(
      observations.totalCount,
      operation === "miniatures" ? profileMiniatures : profileMiniatures * 0.8,
    );
    let warm: unknown;
    if (process.argv[5] === "warm") {
      const cases: Record<string, Record<string, unknown>> = operation === "home"
        ? {
            first48: {},
            first1: { first: 1 },
            first100: { first: 100 },
            stage: { stage: "IN_PROGRESS" },
            search: { search: "Miniature 1" },
          }
        : operation === "miniatures"
          ? {
              first48: {},
              first1: { first: 1 },
              first100: { first: 100 },
              owned: { ownership: "OWNED" },
              wishlist: { ownership: "WISHLIST" },
              search: { search: "Miniature 1" },
            }
          : { default: {} };
      const measured: Record<string, unknown> = {};
      for (const [label, variables] of Object.entries(cases)) {
        await (operation === "launch" ? launch() : run(operation, variables));
        const before = miniatureProjectionDiagnostics();
        const samples = [];
        for (let i = 0; i < n; i++)
          samples.push((await (operation === "launch" ? launch() : run(operation, variables))).sample);
        const after = miniatureProjectionDiagnostics();
        assert.equal(after.builds, before.builds, "Same-generation warm read rebuilt aggregate");
        measured[label] = { variables, samples, summary: summary(samples), diagnostics: { before, after } };
      }
      if (operation === "home") {
        const { setPaintStock } = await import("../apps/paint-vault/lib/paint-stock.ts");
        const samples = [],
          reused = [],
          writes = [];
        for (let i = 0; i < n; i++) {
          const before = miniatureProjectionDiagnostics();
          sqlExecutions = 0;
          const writeStart = performance.now();
          setPaintStock({
            paintId: "user:00000000-0000-4000-8000-000000000000",
            state: "OWNED",
            quantity: i + 2,
          });
          writes.push({ ms: performance.now() - writeStart, sqlExecutions });
          const first = await run("home");
          const afterFirst = miniatureProjectionDiagnostics();
          assert.equal(
            afterFirst.builds,
            before.builds + 1,
            "First post-stock Home must build aggregate exactly once",
          );
          const miniatures = await run("miniatures");
          const second = await run("home");
          assert.equal(
            miniatureProjectionDiagnostics().builds,
            afterFirst.builds,
            "Home/miniatures must reuse post-stock aggregate",
          );
          assert.deepEqual(first.data.home.revision, miniatures.data.miniatures.revision);
          assert.deepEqual(first.data.home.counts, second.data.home.counts);
          samples.push(first.sample);
          reused.push({ miniatures: miniatures.sample, home: second.sample });
        }
        measured.afterStockInvalidation = {
          summary: summary(samples),
          samples,
          reused,
          writes,
          diagnostics: miniatureProjectionDiagnostics(),
        };
      }
      warm = measured;
    }
    process.stdout.write(
      JSON.stringify({
        runtimeSha256: identity.sha256,
        observations,
        cold: initial.sample,
        coldComponents: "components" in initial ? initial.components : undefined,
        warm,
        documents,
      }),
    );
  } finally {
    db.close();
  }
}
