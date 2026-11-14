// Run from apps/paintwarden: node --import tsx ../../scripts/seed-benchmark-vault.mts
// Exact Phase 0 fixture rows; no legacy endpoint or snapshot implementation needed.
// Always creates its own synthetic vault. Never opens DATA_DIR/DATABASE_PATH supplied by the caller.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

const profile = process.argv[2] ?? "large";
assert(["large", "stress"].includes(profile), "Expected large or stress profile");
assert.equal(process.version, "v22.22.2", "Use the repository's pinned Node");
const spec =
  profile === "large"
    ? { paints: 4500, miniatures: 1500, schemes: 300, templates: 500 }
    : { paints: 30000, miniatures: 10000, schemes: 3000, templates: 5000 };
const dataDir = mkdtempSync(path.join(tmpdir(), `paintwarden-startup-${profile}-`));
process.env.DATA_DIR = dataDir;
delete process.env.DATABASE_PATH;
process.env.NODE_ENV = "test";
const { getSqlite } = await import("../apps/paintwarden/db/index.ts");
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
try {
  const report = {
    measuredAt: new Date().toISOString(),
    node: process.version,
    profile,
    spec,
    dataDir,
    seedMs,
    method:
      "Exact Phase 0 synthetic seed rows, extracted unchanged. Creates a new temporary vault; does not measure a removed snapshot endpoint. Historical Phase 0 sizes/times remain in docs/benchmarks/graphql-baseline-*.json.",
  };
  const output = process.env.BENCH_REPORT ?? path.join(dataDir, "fixture.json");
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  db.close();
}
