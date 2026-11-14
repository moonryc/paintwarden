// Maintainer-only: node --import tsx scripts/generate-data-compatibility-fixtures.mjs /path/to/archive
// Reads source via git show only. Never opens the archive's data directories.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = path.join(root, "apps/paint-vault");
const output = path.join(app, "test-fixtures/data-compatibility");
const archive = process.argv[2];
assert.ok(archive, "Pass the historical archive repository path");
const temporary = mkdtempSync(path.join(tmpdir(), "paint-vault-golden-generate-"));
process.env.DATA_DIR = path.join(temporary, "vault");
delete process.env.DATABASE_PATH;
mkdirSync(process.env.DATA_DIR);
symlinkSync(path.join(root, "node_modules"), path.join(temporary, "node_modules"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const historical = (revision, file) => execFileSync("git", ["-C", archive, "show", `${revision}:${file}`]);
const baseline = "1f1c4e9";
const historicalRevision = "47aa2781b1827ad92285fcb0fc73e39d232fcfa1";
const stamp = 1700000000000;
const NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : [stamp]));
  }
  static now() {
    return stamp;
  }
};
const { testId: id, testUserId: user } = await import("../apps/paint-vault/lib/test-ids.ts");
const { BACKUP_SECTIONS, SECTION_KEYS } = await import("../apps/paint-vault/lib/backup-format.ts");
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
const sources = [];
function write(file, bytes) {
  writeFileSync(path.join(output, file), bytes);
}
function json(file, value) {
  write(file, `${JSON.stringify(value, null, 2)}\n`);
}
try {
  mkdirSync(output, { recursive: true });
  const migrations = path.join(temporary, "baseline");
  mkdirSync(path.join(migrations, "meta"), { recursive: true });
  const sql = execFileSync("git", ["-C", root, "show", `${baseline}:apps/paint-vault/drizzle/0000_init.sql`]);
  const journalBytes = execFileSync("git", [
    "-C",
    root,
    "show",
    `${baseline}:apps/paint-vault/drizzle/meta/_journal.json`,
  ]);
  writeFileSync(path.join(migrations, "0000_init.sql"), sql);
  writeFileSync(path.join(migrations, "meta/_journal.json"), journalBytes);
  const sqlite = new Database(path.join(process.env.DATA_DIR, "paint-vault.sqlite"));
  migrate(drizzle(sqlite), { migrationsFolder: migrations });
  const db = drizzle(sqlite);
  for (const section of SECTION_KEYS) db.insert(BACKUP_SECTIONS[section].table).values(seed[section]).run();
  sqlite
    .prepare("INSERT INTO vault_account VALUES (1, ?, ?, 1, ?)")
    .run("synthetic-owner", "not-a-real-password-hash", stamp);
  sqlite.prepare("INSERT INTO vault_sessions VALUES (?, ?)").run("synthetic-token-hash", stamp + 100000);
  sqlite.close();
  copyFileSync(path.join(process.env.DATA_DIR, "paint-vault.sqlite"), path.join(output, "v1.sqlite"));
  mkdirSync(path.join(process.env.DATA_DIR, "images"));
  writeFileSync(path.join(process.env.DATA_DIR, "images", imageKey), image);
  write("pixel.png", image);
  json("v1-tables.json", seed);
  json("released-migrations.json", {
    baseline,
    entries: JSON.parse(journalBytes).entries.map((entry) => ({
      ...entry,
      sha256: sha256(sql),
      snapshot: "meta/0000_snapshot.json",
      snapshotSha256: sha256(
        execFileSync("git", [
          "-C",
          root,
          "show",
          `${baseline}:apps/paint-vault/drizzle/meta/0000_snapshot.json`,
        ]),
      ),
    })),
  });
  process.chdir(app);
  for (const file of ["lib/backup.ts", "lib/backup-format.ts"]) {
    assert.equal(
      sha256(readFileSync(path.join(app, file))),
      sha256(execFileSync("git", ["-C", root, "show", `${baseline}:apps/paint-vault/${file}`])),
      `Regenerate baseline fixtures only with the ${baseline} backup implementation`,
    );
  }
  const { APP_VERSION } = await import("../apps/paint-vault/lib/app-version.ts");
  assert.equal(APP_VERSION, "1.0.0", "Regenerate with the baseline app version");
  const { createBackup } = await import("../apps/paint-vault/lib/backup.ts");
  write("zip-v1.zip", Buffer.from(await new Response(createBackup()).arrayBuffer()));
  const { getSqlite } = await import("../apps/paint-vault/db/index.ts");
  getSqlite().close();

  // Execute the exact historical GET body against its real historical application schema.
  const old = path.join(temporary, "legacy");
  mkdirSync(old);
  const route = historical(historicalRevision, "apps/paint-vault/app/api/backup/route.ts").toString();
  const get = route.slice(
    route.indexOf("export async function GET()"),
    route.indexOf("export async function POST("),
  );
  sources.push({
    revision: historicalRevision,
    path: "apps/paint-vault/app/api/backup/route.ts",
    sha256: sha256(route),
    getSha256: sha256(get),
  });
  writeFileSync(path.join(old, "schema.ts"), historical(historicalRevision, "apps/paint-vault/db/schema.ts"));
  const oldFiles = execFileSync(
    "git",
    ["-C", archive, "ls-tree", "-r", "--name-only", historicalRevision, "apps/paint-vault/drizzle"],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n");
  for (const file of oldFiles.filter((name) => name.endsWith(".sql") || name.endsWith("_journal.json"))) {
    const destination = path.join(old, file.replace("apps/paint-vault/", ""));
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, historical(historicalRevision, file));
  }
  const legacySqlite = new Database(path.join(old, "legacy.sqlite"));
  migrate(drizzle(legacySqlite), { migrationsFolder: path.join(old, "drizzle") });
  const oldSchema = await import(pathToFileURL(path.join(old, "schema.ts")).href);
  const oldDb = drizzle(legacySqlite);
  const oldPaint = `custom-${paint.slice(5)}`;
  const oldScheme = `custom-${scheme.slice(5)}`;
  for (const [key, tableName] of Object.entries({
    paints: "paintCatalog",
    paintInventory: "paintInventory",
    schemes: "colorSchemes",
    schemePaints: "colorSchemePaints",
    schemeDividers: "colorSchemeDividers",
    miniatures: "miniatures",
    miniatureRecipe: "miniatureRequiredPaints",
    miniatureSteps: "miniatureRecipeSteps",
    miniatureSchemes: "miniatureColorSchemes",
    substitutions: "paintSubstitutions",
    substitutionIngredients: "paintSubstitutionIngredients",
    miniatureSubstitutions: "miniaturePaintSubstitutions",
  })) {
    const rows = seed[key].map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([field, value]) => [
          field,
          value === paint ? oldPaint : value === scheme ? oldScheme : value,
        ]),
      ),
    );
    if (key === "paints") rows[0].isCustom = true;
    if (key === "schemeDividers") rows[0].id = `required-battle-milestone:start:${oldScheme}`;
    oldDb.insert(oldSchema[tableName]).values(rows).run();
  }
  oldDb
    .insert(oldSchema.miniatureTemplates)
    .values({
      ...seed.templates[0],
      schemeIds: [oldScheme],
      paints: [{ paintId: oldPaint, step: "BASECOAT", notes: "Fixture recipe", sortOrder: 0 }],
    })
    .run();
  globalThis.__goldenLegacyDb = oldDb;
  globalThis.__goldenImage = { bytes: image, contentType: "image/png" };
  writeFileSync(path.join(old, "db.ts"), "export const getDb = () => globalThis.__goldenLegacyDb;\n");
  writeFileSync(
    path.join(old, "images.ts"),
    "export const loadImage = async () => globalThis.__goldenImage;\n",
  );
  const imports = route
    .slice(0, route.indexOf("export async function GET()"))
    .replace('"../../../db"', '"./db.ts"')
    .replace('"../../../db/schema"', '"./schema.ts"')
    .replace(/import \{ planSchemePaintRestore \}[^;]+;\n/, "")
    .replace(
      'import { loadImage, saveImage } from "../../../lib/image-store";',
      'import { loadImage } from "./images.ts";',
    );
  writeFileSync(path.join(old, "exporter.ts"), `${imports}${get}`);
  const exporter = await import(pathToFileURL(path.join(old, "exporter.ts")).href);
  const legacy = await (await exporter.GET()).json();
  assert.equal(legacy.version, 3);
  json("legacy-v3.json", legacy);
  // No v4 writer exists in any archive ref. Do not misrepresent a modified v3 as a genuine v4 export.
  json("legacy-v4-synthetic.json", { ...legacy, version: 4 });
  legacySqlite.close();
  const files = [
    "v1.sqlite",
    "zip-v1.zip",
    "v1-tables.json",
    "legacy-v3.json",
    "legacy-v4-synthetic.json",
    "pixel.png",
    "released-migrations.json",
  ];
  json("provenance.json", {
    fixtureClock: new Date().toISOString(),
    baseline,
    sources,
    legacyV4: "Synthetic compatibility derivative of the v3 export; no historical v4 writer found",
    files: Object.fromEntries(files.map((file) => [file, sha256(readFileSync(path.join(output, file)))])),
  });
} finally {
  globalThis.Date = NativeDate;
  delete globalThis.__goldenLegacyDb;
  delete globalThis.__goldenImage;
  rmSync(temporary, { recursive: true, force: true });
}
