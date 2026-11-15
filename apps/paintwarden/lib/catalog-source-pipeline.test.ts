import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs, { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import type { ZipSource } from "@paintwarden/core/zip-reader";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { zipSync } from "fflate";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-pipeline-"));
process.env.DATA_DIR = directory;
const { addUploadedCatalogSource, listCatalogSources } = await import("./catalog-sources.ts");
const { getDb, getSqlite } = await import("../db/index.ts");
const { folders, miniatureTemplates, paintCatalog, paintInventory } = await import("../db/schema.ts");
const { saveImageBytes } = await import("./image-store.ts");
const { testId } = await import("./test-ids.ts");
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=",
  "base64",
);
const paintId = testId("atomic-paint");
const templateId = testId("atomic-template");

function plugin(version = "1.0.0", imageBytes = image) {
  const text = (value: unknown) => Buffer.from(JSON.stringify(value));
  return zipSync({
    "source.json": text({
      formatVersion: 1,
      name: "Atomic test",
      version,
      dependencies: [],
      catalog: "catalog.json",
      assets: "assets.json",
    }),
    "catalog.json": text({
      paints: [
        { id: paintId, name: `Paint ${version}`, brand: "Synthetic", range: "Test", colorHex: "#336699" },
      ],
      schemes: [],
      templates: [
        {
          id: templateId,
          name: `Template ${version}`,
          manufacturer: "",
          faction: "",
          categories: [],
          imageUrl: "images/a.png",
          schemeIds: [],
          paints: [{ paintId, step: "BASECOAT", notes: "", sortOrder: 0 }],
        },
      ],
    }),
    "assets.json": text({
      "images/a.png": { sha256: createHash("sha256").update(imageBytes).digest("hex") },
    }),
    "images/a.png": imageBytes,
  });
}

function snapshot() {
  const sqlite = getSqlite();
  const tables = sqlite.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all() as {
    name: string;
  }[];
  return JSON.stringify(
    tables.map(({ name }) => [
      name,
      sqlite.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all(),
    ]),
  );
}

function images() {
  const folder = path.join(directory, "images");
  return existsSync(folder)
    ? Object.fromEntries(
        readdirSync(folder)
          .sort()
          .map((key) => [key, readFileSync(path.join(folder, key)).toString("hex")]),
      )
    : {};
}

test.after(() => {
  getSqlite().close();
  rmSync(directory, { recursive: true, force: true });
  rmSync(path.join(directory, ".plugin-staging"), { recursive: true, force: true });
});

void test("all stages run outside write transactions; failure/cancel at every stage saves nothing", async () => {
  for (const stage of ["reading", "checking", "images", "preparing", "committing"] as const) {
    const before = snapshot();
    const files = images();
    await assert.rejects(
      addUploadedCatalogSource(plugin(), {
        progress(current, done) {
          assert.equal(getSqlite().inTransaction, false);
          assert.equal(listCatalogSources().length, 0);
          if (current === stage && done === 0) throw new Error(`Injected ${stage} failure`);
        },
      }),
      new RegExp(`Injected ${stage} failure`),
    );
    assert.equal(snapshot(), before);
    assert.deepEqual(images(), files);
    const controller = new AbortController();
    await assert.rejects(
      addUploadedCatalogSource(plugin(), {
        signal: controller.signal,
        progress(current, done) {
          if (current === stage && done === 0) controller.abort(new Error("Cancelled test"));
        },
      }),
      /Cancelled test/,
    );
    assert.equal(snapshot(), before);
    assert.deepEqual(images(), files);
  }
});

void test("updates preserve old rows/images on late failures, skip unchanged image reads, and commit one complete version", async () => {
  await addUploadedCatalogSource(plugin());
  const before = snapshot();
  const files = images();
  await assert.rejects(
    addUploadedCatalogSource(plugin("1.1.0", Buffer.concat([image, Buffer.from("different")])), {
      progress(stage) {
        if (stage === "committing") throw new Error("Late update failure");
      },
    }),
    /Late update failure/,
  );
  assert.equal(snapshot(), before);
  assert.deepEqual(images(), files);
  let imageStage = false;
  const bytes = plugin("1.1.0");
  const source: ZipSource = {
    size: bytes.length,
    read: async (offset, length) => {
      assert.equal(imageStage, false, "unchanged image must not be read from ZIP");
      return bytes.subarray(offset, offset + length);
    },
  };
  const result = await addUploadedCatalogSource(source, {
    progress(stage, done) {
      if (stage === "images") imageStage = true;
      if (stage === "committing" && done === 0) {
        assert.equal(listCatalogSources()[0].version, "1.0.0");
        assert.equal(getDb().select().from(paintCatalog).get()!.name, "Paint 1.0.0");
      }
    },
  });
  assert.equal(result.version, "1.1.0");
  assert.equal(getDb().select().from(paintCatalog).get()!.name, "Paint 1.1.0");
  assert.deepEqual(images(), files);
});

void test("staging does not block ordinary image/DB edits; concurrent install fails fast and user folder edits survive", async () => {
  const bytes = plugin("1.2.0", Buffer.concat([image, Buffer.from("new photo")]));
  let imagesStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    imagesStarted = resolve;
  });
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let hold = false;
  const source: ZipSource = {
    size: bytes.length,
    read: async (offset, length) => {
      if (hold) {
        imagesStarted();
        await blocked;
      }
      return bytes.subarray(offset, offset + length);
    },
  };
  const pending = addUploadedCatalogSource(source, {
    progress(stage) {
      if (stage === "images") hold = true;
    },
  });
  await started;
  try {
    await assert.rejects(addUploadedCatalogSource(plugin("1.3.0")), /install is already running/);
    assert.equal(getSqlite().inTransaction, false);
    assert.equal(listCatalogSources()[0].version, "1.1.0");
    getDb().insert(paintInventory).values({ paintId, state: "OWNED" }).run();
    const folderId = testId("atomic-folder");
    getDb()
      .insert(folders)
      .values({
        id: folderId,
        name: "Created during staging",
        kind: "template",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .run();
    getDb().update(miniatureTemplates).set({ folderId }).where(eq(miniatureTemplates.id, templateId)).run();
    const ownImage = await saveImageBytes(image, "image/png");
    assert.ok(ownImage, "ordinary image upload finishes while plugin read is blocked");
    release();
    await pending;
    assert.equal(getDb().select().from(miniatureTemplates).get()!.folderId, folderId);
    assert.equal(getDb().select().from(paintInventory).get()!.state, "OWNED");
    assert.equal(listCatalogSources()[0].version, "1.2.0");
  } finally {
    release();
    await pending.catch(() => undefined);
  }
});

void test("post-commit observer exceptions and late cancellation do not turn success into rollback", async () => {
  const controller = new AbortController();
  const result = await addUploadedCatalogSource(plugin("1.3.0"), {
    signal: controller.signal,
    progress(stage, done) {
      if (stage === "committing" && done === 1) {
        controller.abort();
        throw new Error("Observer unavailable");
      }
    },
  });
  assert.equal(result.version, "1.3.0");
  assert.equal(listCatalogSources()[0].version, "1.3.0");
});

void test("independent WAL reader sees only the old version throughout writes; commit has one complete invalidation window", async () => {
  const { changeLogEpoch, currentChangeSeq } = await import("../db/change-log.ts");
  const { invalidationSince } = await import("../graphql/changes.ts");
  const sqlite = getSqlite();
  const reader = new Database(path.join(directory, "paintwarden.sqlite"), { readonly: true });
  const cursor = { epoch: changeLogEpoch, since: currentChangeSeq(sqlite) };
  let observedWrites = 0;
  sqlite.function("atomic_test_witness", () => {
    observedWrites++;
    assert.equal(
      (reader.prepare("SELECT version FROM catalog_sources").get() as { version: string }).version,
      "1.3.0",
    );
    assert.equal(
      (reader.prepare("SELECT name FROM paint_catalog").get() as { name: string }).name,
      "Paint 1.3.0",
    );
    assert.equal(
      (reader.prepare("SELECT name FROM miniature_templates").get() as { name: string }).name,
      "Template 1.3.0",
    );
    return null;
  });
  for (const table of ["catalog_sources", "paint_catalog", "miniature_templates"])
    sqlite.exec(
      `CREATE TEMP TRIGGER atomic_test_${table} AFTER UPDATE ON ${table} BEGIN SELECT atomic_test_witness(); END`,
    );
  try {
    await addUploadedCatalogSource(plugin("1.4.0"), {
      progress(stage, done) {
        if (stage !== "committing" || done === 0) {
          assert.equal(currentChangeSeq(sqlite), cursor.since);
          assert.equal(
            (reader.prepare("SELECT version FROM catalog_sources").get() as { version: string }).version,
            "1.3.0",
          );
        }
      },
    });
    assert.ok(observedWrites >= 3, "reader inspected source, paint and template mid-transaction");
    assert.equal(
      (reader.prepare("SELECT version FROM catalog_sources").get() as { version: string }).version,
      "1.4.0",
    );
    assert.equal(
      (reader.prepare("SELECT name FROM paint_catalog").get() as { name: string }).name,
      "Paint 1.4.0",
    );
    const event = invalidationSince(cursor);
    assert.ok(event.seq > cursor.since);
    assert.ok(event.families.includes("SOURCES"));
    assert.ok(event.families.includes("LIBRARY"));
    assert.ok(event.families.includes("TEMPLATES"));
    assert.deepEqual(invalidationSince({ epoch: event.epoch, since: event.seq }).families, []);
  } finally {
    for (const table of ["catalog_sources", "paint_catalog", "miniature_templates"])
      sqlite.exec(`DROP TRIGGER atomic_test_${table}`);
    reader.close();
  }
});

void test("a cached key rewritten by a restore during preparation is rejected rather than installing stale hashes", async () => {
  const { writeImage } = await import("./image-store.ts");
  const key = getDb().select().from(miniatureTemplates).get()!.imageKey!;
  const before = snapshot();
  let rewrite: Promise<boolean> | undefined;
  const changed = Buffer.concat([image, Buffer.from("restored concurrently")]);
  await assert.rejects(
    addUploadedCatalogSource(plugin("1.5.0"), {
      progress(stage, done) {
        if (stage === "images" && done === 1) rewrite = writeImage(key, changed);
      },
    }),
    /The vault changed during plugin installation/,
  );
  assert.equal(await rewrite, true);
  assert.equal(snapshot(), before);
  assert.deepEqual(readFileSync(path.join(directory, "images", key)), changed);
  await writeImage(key, image);
});

void test("ENOSPC during partial promotion rolls back every row and fresh image without touching the previous version", async () => {
  const { default: sharp } = await import("sharp");
  const photo = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#336699" } })
    .png()
    .toBuffer();
  const before = snapshot();
  const files = images();
  const rename = fs.renameSync;
  let promotions = 0;
  fs.renameSync = (source, destination) => {
    if (String(source).includes(".plugin-staging") && ++promotions === 2) {
      throw Object.assign(new Error("ENOSPC: injected full volume"), { code: "ENOSPC" });
    }
    return rename(source, destination);
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(addUploadedCatalogSource(plugin("1.5.0", photo)), /ENOSPC/);
    assert.equal(promotions, 2, "one image file was promoted before the filesystem failure");
    assert.equal(snapshot(), before);
    assert.deepEqual(images(), files);
    assert.deepEqual(readdirSync(path.join(directory, ".plugin-staging")), []);
  } finally {
    fs.renameSync = rename;
    syncBuiltinESMExports();
  }
});
