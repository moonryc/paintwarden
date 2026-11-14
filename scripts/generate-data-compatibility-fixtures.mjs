// Maintainer-only: node --import tsx scripts/generate-data-compatibility-fixtures.mjs /tmp/new-fixtures
// Synthetic pre-release fixtures, not historical exporter artifacts. Never overwrites checked-in goldens.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import {
  BACKUP_FORMAT,
  BACKUP_IMAGE_FOLDER,
  BACKUP_MANIFEST,
  BACKUP_SECTIONS,
  BACKUP_VERSION,
  SECTION_KEYS,
} from "../apps/paintwarden/lib/backup-format.ts";
import { testId as id, testUserId as user } from "../apps/paintwarden/lib/test-ids.ts";
import { writeZip } from "../apps/paintwarden/lib/zip-writer.ts";

const root = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const app = path.join(root, "apps/paintwarden");
assert.ok(process.argv[2], "Pass an empty output directory outside this repository");
mkdirSync(path.resolve(process.argv[2]), { recursive: true });
const output = realpathSync(path.resolve(process.argv[2]));
assert.ok(
  output !== root && !output.startsWith(`${root}${path.sep}`),
  "Never regenerate fixtures inside the repository",
);
assert.deepEqual(
  readdirSync(output),
  [],
  "Output directory must be empty; never overwrite existing fixtures",
);
const temporary = mkdtempSync(path.join(tmpdir(), "paintwarden-golden-generate-"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const stamp = 1700000000000;
const plugin = id("golden-plugin"),
  paint = user("golden-paint"),
  scheme = user("golden-scheme");
const template = user("golden-template"),
  miniature = id("golden-miniature"),
  substitution = id("golden-substitution");
const imageKey = `${id("golden-image")}.png`;
// Original, generated 1x1 transparent PNG; no catalog, photo or third-party artwork.
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const seed = {
  plugins: [
    {
      id: plugin,
      repository: "fixture/synthetic",
      url: "https://example.invalid/synthetic",
      branch: "main",
      name: "Synthetic plugin",
      version: "1.0.0",
      license: "CC0-1.0",
      attribution: "Synthetic test data",
      dependencies: [],
      updatedAt: stamp,
      lastError: null,
      logoSvg: null,
    },
  ],
  paints: [
    {
      id: paint,
      brand: "Synthetic",
      range: "Test",
      name: "Blue",
      type: "BASE",
      discontinued: false,
      colorHex: "#123456",
      sourceUrl: null,
      sourceLabel: "Fixture",
      updatedAt: stamp,
    },
    {
      id: id("golden-source-paint"),
      brand: "Synthetic",
      range: "Plugin",
      name: "Orange",
      type: "LAYER",
      discontinued: true,
      colorHex: "#ab1234",
      sourceUrl: "https://example.invalid/paint",
      sourceLabel: null,
      updatedAt: stamp,
    },
  ],
  pluginItems: [{ sourceId: plugin, kind: "paint", itemId: id("golden-source-paint") }],
  pluginImages: [{ sourceId: plugin, assetPath: "pixel.png", imageKey, sha256: sha256(image) }],
  paintInventory: [{ paintId: paint, state: "OWNED", stockLevel: "LOW", quantity: 2, updatedAt: stamp }],
  schemes: [{ id: scheme, name: "Synthetic scheme", category: null, createdAt: stamp, updatedAt: stamp }],
  schemePaints: [{ schemeId: scheme, paintId: paint, sortOrder: 1, updatedAt: stamp }],
  schemeDividers: [
    {
      id: id("golden-divider"),
      schemeId: scheme,
      label: "Start",
      tone: "MILESTONE",
      role: "START",
      sortOrder: 0,
      updatedAt: stamp,
    },
  ],
  schemeImages: [
    {
      id: id("golden-scheme-image"),
      schemeId: scheme,
      imageUrl: `/api/catalog-source-images/${imageKey}`,
      thumbnailUrl: `/api/catalog-source-images/${imageKey}`,
      imageType: "test",
      method: "synthetic",
      sortOrder: 2,
      updatedAt: stamp,
    },
  ],
  templates: [
    {
      id: template,
      name: "Synthetic template",
      manufacturer: "Test",
      faction: "Test",
      categories: ["Fixture"],
      imageKey,
      imageUrl: null,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ],
  templateSchemes: [{ templateId: template, schemeId: scheme, sortOrder: 0, updatedAt: stamp }],
  templatePaints: [
    {
      templateId: template,
      sortOrder: 0,
      paintId: paint,
      step: "BASECOAT",
      notes: "Fixture recipe",
      updatedAt: stamp,
    },
  ],
  miniatures: [
    {
      id: miniature,
      title: "Synthetic model",
      status: "OWNED",
      notes: "Fixture notes",
      manufacturer: "Test",
      faction: "Test",
      scale: "1:1",
      paintingStatus: "IN_PROGRESS",
      imageKey,
      sourceImageUrl: null,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ],
  miniatureRecipe: [
    {
      id: id("golden-recipe"),
      miniatureId: miniature,
      paintId: paint,
      step: "BASECOAT",
      notes: "Thin coats",
      sortOrder: 0,
      updatedAt: stamp,
    },
  ],
  miniatureSteps: [{ miniatureId: miniature, step: "BASECOAT", updatedAt: stamp }],
  miniatureSchemes: [{ miniatureId: miniature, schemeId: scheme, sortOrder: 0, updatedAt: stamp }],
  substitutions: [
    {
      id: substitution,
      targetPaintId: paint,
      name: "Synthetic mix",
      isDefault: true,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ],
  substitutionIngredients: [
    { substitutionId: substitution, paintId: paint, parts: 2, sortOrder: 0, updatedAt: stamp },
  ],
  miniatureSubstitutions: [
    {
      miniatureId: miniature,
      targetPaintId: paint,
      substitutionId: substitution,
      useOriginal: false,
      updatedAt: stamp,
    },
  ],
};

function write(file, bytes) {
  writeFileSync(path.join(output, file), bytes);
}
function json(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}
try {
  const ledgerBytes = readFileSync(
    path.join(app, "test-fixtures/data-compatibility/released-migrations.json"),
  );
  const ledger = JSON.parse(ledgerBytes);
  const { sha256: sqlHash, snapshot, snapshotSha256, ...entry } = ledger.entries[0];
  assert.equal(entry.tag, "0000_init");
  const sql = readFileSync(path.join(app, "drizzle", `${entry.tag}.sql`));
  const snapshotBytes = readFileSync(path.join(app, "drizzle", snapshot));
  assert.equal(sha256(sql), sqlHash, "Frozen baseline SQL changed; append a migration instead");
  assert.equal(sha256(snapshotBytes), snapshotSha256, "Frozen baseline snapshot changed");
  const journal = JSON.parse(readFileSync(path.join(app, "drizzle/meta/_journal.json")));
  assert.deepEqual(journal.entries[0], entry, "Frozen baseline journal entry changed");
  const migrations = path.join(temporary, "baseline");
  mkdirSync(path.join(migrations, "meta"), { recursive: true });
  writeFileSync(path.join(migrations, `${entry.tag}.sql`), sql);
  writeFileSync(
    path.join(migrations, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries: [entry] }),
  );
  assert.equal(BACKUP_FORMAT, "paintwarden-backup");
  assert.equal(BACKUP_VERSION, 1, "A new backup version needs new fixtures, not a baseline refresh");
  assert.deepEqual(Object.keys(seed), SECTION_KEYS);
  for (const section of SECTION_KEYS)
    for (const row of seed[section])
      assert.deepEqual(Object.keys(row).sort(), [...BACKUP_SECTIONS[section].fields].sort(), section);
  const sqlite = new Database(path.join(output, "v1.sqlite"));
  try {
    migrate(drizzle(sqlite), { migrationsFolder: migrations });
    const db = drizzle(sqlite);
    for (const section of SECTION_KEYS) db.insert(BACKUP_SECTIONS[section].table).values(seed[section]).run();
    sqlite
      .prepare("INSERT INTO vault_account VALUES (1, ?, ?, 1, ?)")
      .run("synthetic-owner", "not-a-real-password-hash", stamp);
    sqlite.prepare("INSERT INTO vault_sessions VALUES (?, ?)").run("synthetic-token-hash", stamp + 100000);
    assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
    assert.equal(sqlite.pragma("integrity_check", { simple: true }), "ok");
  } finally {
    sqlite.close();
  }
  write("pixel.png", image);
  json("v1-tables.json", seed);
  // Copy the immutable ledger byte-for-byte; never derive replacement hashes from changed SQL.
  write("released-migrations.json", ledgerBytes);
  const fixtureClock = new Date(stamp).toISOString();
  const manifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: "1.0.0",
    exportedAt: fixtureClock,
    tables: seed,
    images: [imageKey],
  };
  async function* files() {
    yield { name: `${BACKUP_IMAGE_FOLDER}${imageKey}`, data: image };
    yield { name: BACKUP_MANIFEST, data: Buffer.from(JSON.stringify(manifest)), compress: true };
  }
  const chunks = [];
  // ZIP timestamps are supplied explicitly; generation is independent of wall clock and local TZ.
  for await (const chunk of writeZip(files(), new Date(2023, 10, 14, 22, 13, 20))) chunks.push(chunk);
  write("zip-v1.zip", Buffer.concat(chunks));
  const fixtureFiles = ["v1.sqlite", "zip-v1.zip", "v1-tables.json", "pixel.png", "released-migrations.json"];
  const sourceFiles = [
    "scripts/generate-data-compatibility-fixtures.mjs",
    "apps/paintwarden/lib/test-ids.ts",
    "apps/paintwarden/lib/backup-format.ts",
    "apps/paintwarden/lib/zip-writer.ts",
    "apps/paintwarden/db/schema.ts",
  ];
  json("provenance.json", {
    kind: "synthetic-pre-release-rebrand",
    description:
      "New-brand synthetic baseline SQLite and ZIP1 contract fixtures; not authentic historical exporter output or evidence of a published release",
    fixtureClock,
    baseline: ledger.baseline,
    sources: Object.fromEntries(
      sourceFiles.map((file) => [file, sha256(readFileSync(path.join(root, file)))]),
    ),
    files: Object.fromEntries(
      fixtureFiles.map((file) => [file, sha256(readFileSync(path.join(output, file)))]),
    ),
  });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
