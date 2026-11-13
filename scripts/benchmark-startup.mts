// Run from apps/paint-vault: node --import tsx ../../scripts/benchmark-startup.mts
// Always creates its own synthetic vault. Never opens DATA_DIR/DATABASE_PATH supplied by the caller.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";

const profile = process.argv[2] ?? "large";
assert(["large", "stress"].includes(profile), "Expected large or stress profile");
assert.equal(process.version, "v22.22.2", "Use the repository's pinned Node");
const spec =
  profile === "large"
    ? { paints: 4500, miniatures: 1500, schemes: 300, templates: 500 }
    : { paints: 30000, miniatures: 10000, schemes: 3000, templates: 5000 };
const dataDir = mkdtempSync(path.join(tmpdir(), `paint-vault-startup-${profile}-`));
process.env.DATA_DIR = dataDir;
delete process.env.DATABASE_PATH;
process.env.NODE_ENV = "test";
const { getSqlite } = await import("../apps/paint-vault/db/index.ts");
const { vaultSnapshot } = await import("../apps/paint-vault/lib/vault-state.ts");
const { GET: templateSummaries } = await import("../apps/paint-vault/app/api/miniature-templates/route.ts");
const db = getSqlite();
const id = (n: number) => `${n.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
const paintId = (n: number) => (n % 25 === 0 ? `user:${id(n)}` : id(n));
const seedStart = performance.now();
db.transaction(() => {
  const source = id(90000000);
  db.prepare(
    "INSERT INTO catalog_sources(id,repository,url,branch,name,version,dependencies,updated_at) VALUES (?,'synthetic/catalog','https://example.invalid','main','Invented plugin catalog','1.0.0','[]',1)",
  ).run(source);
  const paint = db.prepare(
    "INSERT INTO paint_catalog(id,brand,range,name,type,color_hex) VALUES (?,?,?,?, 'BASE',?)",
  );
  const inventory = db.prepare(
    "INSERT INTO paint_inventory(paint_id,state,stock_level,quantity) VALUES (?,?,?,?)",
  );
  const sourceItem = db.prepare("INSERT INTO catalog_source_items(source_id,kind,item_id) VALUES (?,?,?)");
  for (let i = 0; i < spec.paints; i++) {
    paint.run(
      paintId(i),
      `Invented brand ${i % 12}`,
      `Range ${i % 5}`,
      `Paint ${i.toString().padStart(5, "0")}`,
      `#${((i * 7919) % 16777216).toString(16).padStart(6, "0")}`,
    );
    if (i % 25 !== 0) sourceItem.run(source, "paint", paintId(i));
    if (i % 3 !== 0)
      inventory.run(
        paintId(i),
        i % 7 === 0 ? "WISHLIST" : "OWNED",
        i % 11 === 0 ? "EMPTY" : i % 5 === 0 ? "LOW" : "FULL",
        i % 11 === 0 ? 0 : 1 + (i % 3),
      );
  }
  const miniature = db.prepare(
    "INSERT INTO miniatures(id,title,status,notes,manufacturer,faction,scale,painting_status,created_at) VALUES (?,?,?,?,?,?,?, ?,?)",
  );
  const required = db.prepare(
    "INSERT INTO miniature_required_paints(id,miniature_id,paint_id,step,notes,sort_order) VALUES (?,?,?,'BASECOAT',?,?)",
  );
  for (let i = 0; i < spec.miniatures; i++) {
    miniature.run(
      id(100000 + i),
      `Miniature ${i}`,
      i % 5 === 0 ? "WISHLIST" : "OWNED",
      `Invented project notes ${i}. ` + "Apply thin layers. ".repeat(8),
      `Maker ${i % 9}`,
      `Faction ${i % 6}`,
      "28mm",
      ["NOT_STARTED", "ASSEMBLED", "PRIMED", "IN_PROGRESS", "COMPLETE"][i % 5],
      1700000000000 + i,
    );
    for (let j = 0; j < 10; j++)
      required.run(
        id(1000000 + i * 10 + j),
        id(100000 + i),
        paintId((i * 7 + j) % spec.paints),
        `Layer ${j}: apply thinly`,
        j,
      );
  }
  const scheme = db.prepare("INSERT INTO color_schemes(id,name,category,created_at) VALUES (?,?,'RED',1)");
  const schemePaint = db.prepare(
    "INSERT INTO color_scheme_paints(scheme_id,paint_id,sort_order) VALUES (?,?,?)",
  );
  const attached = db.prepare(
    "INSERT INTO miniature_color_schemes(miniature_id,scheme_id,sort_order) VALUES (?,?,0)",
  );
  for (let i = 0; i < spec.schemes; i++) {
    scheme.run(id(200000 + i), `Invented scheme ${i}`);
    sourceItem.run(source, "scheme", id(200000 + i));
    for (let j = 0; j < 8; j++) schemePaint.run(id(200000 + i), paintId((i * 8 + j) % spec.paints), j);
    attached.run(id(100000 + i), id(200000 + i));
  }
  const template = db.prepare(
    "INSERT INTO miniature_templates(id,name,manufacturer,faction,created_at) VALUES (?,?,'Invented maker','Faction',1)",
  );
  const templatePaint = db.prepare(
    "INSERT INTO miniature_template_paints(template_id,paint_id,sort_order,step,notes) VALUES (?,?,?,'BASECOAT',?)",
  );
  for (let i = 0; i < spec.templates; i++) {
    template.run(id(300000 + i), `Invented template ${i}`);
    sourceItem.run(source, "template", id(300000 + i));
    for (let j = 0; j < 10; j++)
      templatePaint.run(id(300000 + i), paintId((i * 10 + j) % spec.paints), j, `Template layer ${j}`);
  }
})();
const seedMs = performance.now() - seedStart;
let sqlExecutions = 0;
let prepares = 0;
const prepare = db.prepare.bind(db);
db.prepare = ((sql: string) => {
  prepares++;
  const statement = prepare(sql);
  // Wrap the statement itself: Drizzle calls .raw(true).all(), so a Proxy that
  // returns the underlying statement from .raw() would silently miss executions.
  for (const method of ["get", "all", "run", "iterate"] as const) {
    const execute = statement[method];
    Object.defineProperty(statement, method, {
      value: (...args: unknown[]) => {
        sqlExecutions++;
        return Reflect.apply(execute, statement, args);
      },
    });
  }
  return statement;
}) as typeof db.prepare;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
async function measure(fn: () => Promise<string>) {
  const once = async () => {
    prepares = 0;
    sqlExecutions = 0;
    const start = performance.now();
    const text = await fn();
    return { ms: performance.now() - start, prepares, sqlExecutions, text };
  };
  const first = await once();
  await once();
  const samples = [];
  for (let i = 0; i < 11; i++) samples.push(await once());
  const parseMs = [];
  for (let i = 0; i < 11; i++) {
    const start = performance.now();
    JSON.parse(first.text);
    parseMs.push(performance.now() - start);
  }
  return {
    firstReadMs: first.ms,
    medianMs: median(samples.map((s) => s.ms)),
    minMs: Math.min(...samples.map((s) => s.ms)),
    maxMs: Math.max(...samples.map((s) => s.ms)),
    preparedStatements: median(samples.map((s) => s.prepares)),
    sqlExecutions: median(samples.map((s) => s.sqlExecutions)),
    jsonBytes: Buffer.byteLength(first.text),
    gzipBytes: gzipSync(first.text).length,
    parseMedianMs: median(parseMs),
  };
}
try {
  const snapshot = await measure(async () => JSON.stringify(vaultSnapshot()));
  const templates = await measure(async () => (await templateSummaries()).text());
  const report = {
    measuredAt: new Date().toISOString(),
    node: process.version,
    profile,
    spec,
    dataDir,
    seedMs,
    method:
      "Invented plugin and custom catalog; synchronous SQLite read + JSON serialization, 1 first read + 1 warmup + 11 samples. First read is NOT cold disk (fixture just seeded). No auth/Nest/TCP/compression time/Electron/React render. Gzip size only. SQL count includes executed prepared statements, excludes BEGIN/COMMIT issued by transaction helper. Template summaries measured separately; lazy recipes excluded.",
    snapshot,
    templateSummaries: templates,
    snapshotStartupDataBytes: snapshot.jsonBytes,
    snapshotPlusTemplateSummariesBytes: snapshot.jsonBytes + templates.jsonBytes,
  };
  const output = process.env.BENCH_REPORT ?? path.join(dataDir, "results.json");
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  db.close();
}
