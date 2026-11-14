import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, watch, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { eq, getTableColumns } from "drizzle-orm";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-backup-"));
process.env.DATA_DIR = directory;
const { GET, POST } = await import("./route");
const photoRoute = await import("../miniatures/[id]/image/route");
const miniatureRoute = await import("../miniatures/[id]/route");
const { getDb, getSqlite } = await import("../../../db");
const schema = await import("../../../db/schema");
const { BACKUP_SECTIONS, SECTION_KEYS } = await import("../../../lib/backup-format");
const { deleteImage, saveImage } = await import("../../../lib/image-store");
const { withImageMutation } = await import("../../../lib/image-mutations");
const { restoreBackup } = await import("../../../lib/backup");
const { APP_VERSION } = await import("../../../lib/app-version");
const { testId, testUserId } = await import("../../../lib/test-ids");
const {
  catalogSourceAssets,
  catalogSourceItems,
  catalogSources,
  colorSchemePaints,
  colorSchemes,
  miniatureRequiredPaints,
  miniatureTemplatePaints,
  miniatureTemplates,
  miniatures,
  paintCatalog,
  paintInventory,
  paintSubstitutions,
} = schema;

type Manifest = {
  format: string;
  version: number;
  appVersion: string;
  images: string[];
  tables: Record<string, Record<string, unknown>[]>;
};

const imagePath = (key: string) => path.join(directory, "images", key);
const png = (seed: number) =>
  new File([new Uint8Array([137, 80, 78, 71, seed])], "photo", { type: "image/png" });

async function exportZip() {
  const response = GET();
  assert.equal(response.headers.get("content-type"), "application/zip");
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  return { files, manifest: JSON.parse(strFromU8(files["backup.json"])) as Manifest };
}
const zip = (manifest: unknown, images: Record<string, Uint8Array> = {}) =>
  zipSync({
    "backup.json": strToU8(JSON.stringify(manifest)),
    ...Object.fromEntries(Object.entries(images).map(([key, bytes]) => [`images/${key}`, bytes])),
  });
const restore = (body: Uint8Array | string, mode = "merge") =>
  POST(
    new Request(`http://localhost/api/backup?mode=${mode}`, {
      method: "POST",
      body: typeof body === "string" ? body : new Uint8Array(body),
    }),
  );
const params = (id: string) => ({ params: Promise.resolve({ id }) });
async function uploadPhoto(id: string, seed: number) {
  const body = new FormData();
  body.set("image", png(seed));
  const response = await photoRoute.POST(
    new Request(`http://localhost/api/miniatures/${id}/image`, { method: "POST", body }),
    params(id),
  );
  assert.equal(response.status, 200);
  return getDb().select().from(miniatures).where(eq(miniatures.id, id)).get()!.imageKey!;
}
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error;

function seedVault(suffix: string, photo: string | null) {
  const db = getDb();
  db.insert(catalogSources)
    .values({
      id: testId(`plugin-${suffix}`),
      repository: `example/plugin-${suffix}`,
      url: `https://github.com/example/plugin-${suffix}`,
      branch: "main",
      name: `Plugin ${suffix}`,
      version: "1.0.0",
      dependencies: [],
      updatedAt: 1,
    })
    .run();
  db.insert(paintCatalog)
    .values([
      {
        id: testId(`example/base/${suffix}`),
        brand: "Example",
        range: "Base",
        name: `Source ${suffix}`,
        type: "BASE",
      },
      { id: testUserId(`paint-${suffix}`), brand: "Mine", range: "Base", name: `Mine ${suffix}` },
    ])
    .run();
  db.insert(catalogSourceItems)
    .values({ sourceId: testId(`plugin-${suffix}`), kind: "paint", itemId: testId(`example/base/${suffix}`) })
    .run();
  db.insert(paintInventory)
    .values({ paintId: testId(`example/base/${suffix}`), state: "OWNED", quantity: 2 })
    .run();
  db.insert(colorSchemes)
    .values({ id: testUserId(`scheme-${suffix}`), name: `Scheme ${suffix}`, createdAt: 1 })
    .run();
  db.insert(colorSchemePaints)
    .values({
      schemeId: testUserId(`scheme-${suffix}`),
      paintId: testId(`example/base/${suffix}`),
      sortOrder: 0,
    })
    .run();
  db.insert(miniatures)
    .values({
      id: testId(`mini-${suffix}`),
      title: `Mini ${suffix}`,
      status: "OWNED",
      imageKey: photo,
      createdAt: 1,
    })
    .run();
  db.insert(miniatureRequiredPaints)
    .values([
      {
        id: testId(`r1-${suffix}`),
        miniatureId: testId(`mini-${suffix}`),
        paintId: testUserId(`paint-${suffix}`),
        step: "BASECOAT",
      },
      {
        id: testId(`r2-${suffix}`),
        miniatureId: testId(`mini-${suffix}`),
        paintId: testUserId(`paint-${suffix}`),
        step: "GLAZE",
      },
    ])
    .run();
  db.insert(miniatureTemplates)
    .values({ id: testUserId(`template-${suffix}`), name: "Template", createdAt: 1 })
    .run();
  db.insert(miniatureTemplatePaints)
    .values({
      templateId: testUserId(`template-${suffix}`),
      sortOrder: 0,
      paintId: testUserId(`paint-${suffix}`),
      step: "WASH",
    })
    .run();
}

function clearVault() {
  const db = getDb();
  for (const key of [...SECTION_KEYS].reverse()) db.delete(BACKUP_SECTIONS[key].table).run();
}

test("backup", async (t) => {
  try {
    await t.test("every database column is listed in the backup format", () => {
      for (const key of SECTION_KEYS) {
        const { table, fields } = BACKUP_SECTIONS[key];
        assert.deepEqual(
          Object.keys(getTableColumns(table)).sort(),
          [...fields].sort(),
          `Backup section ${key} must list every column of its table`,
        );
      }
    });

    const photo = await saveImage(png(1));
    seedVault("a", photo);
    const asset = await saveImage(png(2));
    getDb()
      .insert(catalogSourceAssets)
      .values({
        sourceId: testId("plugin-a"),
        assetPath: "images/x.png",
        imageKey: asset,
        sha256: "0".repeat(64),
      })
      .run();

    const first = await exportZip();
    const backupA = zipSync(first.files);
    const manifestA = first.manifest;

    await t.test("exports a zip with every section and the images the vault uses", () => {
      assert.equal(manifestA.format, "paintwarden-backup");
      assert.equal(manifestA.version, 1);
      assert.equal(manifestA.appVersion, APP_VERSION);
      assert.deepEqual(Object.keys(manifestA.tables), SECTION_KEYS);
      assert.deepEqual(manifestA.images, [photo, asset].sort());
      assert.deepEqual([...first.files[`images/${photo}`]], [137, 80, 78, 71, 1]);
      assert.equal(manifestA.tables.plugins[0].id, testId("plugin-a"));
      assert.equal(manifestA.tables.plugins[0].repository, "example/plugin-a");
      assert.deepEqual(
        manifestA.tables.miniatureRecipe.map((row) => row.step),
        ["BASECOAT", "GLAZE"],
      );
      assert.equal(manifestA.tables.paints.find((row) => row.id === testId("example/base/a"))!.type, "BASE");
    });

    await t.test("replace makes the vault match the backup and removes orphaned images", async () => {
      clearVault();
      const otherPhoto = await saveImage(png(3));
      seedVault("b", otherPhoto);
      const response = await restore(backupA, "replace");
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).restored, {
        miniatures: 1,
        paints: 2,
        schemes: 1,
        templates: 1,
        plugins: 1,
      });
      assert.deepEqual((await exportZip()).manifest.tables, manifestA.tables);
      assert.equal(existsSync(imagePath(photo)), true);
      assert.equal(existsSync(imagePath(otherPhoto)), false);
    });

    await t.test("replace restores photos that are missing from the image folder", async () => {
      rmSync(imagePath(photo));
      assert.equal((await restore(backupA, "replace")).status, 200);
      assert.equal(existsSync(imagePath(photo)), true);
    });

    await t.test("merge adds new records and keeps existing ones as they are", async () => {
      clearVault();
      seedVault("b", null);
      getDb().update(miniatures).set({ title: "Edited here" }).run();
      const { manifest } = await exportZip();
      clearVault();
      seedVault("a", null);
      getDb().update(paintInventory).set({ quantity: 9 }).run();
      // The backup holds vault b, plus a changed copy of vault a's miniature and inventory.
      const tables = {
        ...manifest.tables,
        miniatures: [
          ...manifest.tables.miniatures,
          { ...manifestA.tables.miniatures[0], title: "From backup", imageKey: null },
        ],
        miniatureRecipe: [
          ...manifest.tables.miniatureRecipe,
          {
            id: testId("extra"),
            miniatureId: testId("mini-a"),
            paintId: testUserId("paint-a"),
            step: "VARNISH",
          },
        ],
        paintInventory: [
          ...manifest.tables.paintInventory,
          { paintId: testId("example/base/a"), state: "OWNED", stockLevel: "FULL", quantity: 1 },
        ],
      };
      const response = await restore(zip({ ...manifest, tables }), "merge");
      assert.equal(response.status, 200);
      assert.equal((await response.json()).restored.miniatures, 1);
      const db = getDb();
      assert.deepEqual(
        db
          .select()
          .from(miniatures)
          .all()
          .map((row) => [row.id, row.title])
          .sort((a, b) => a[1].localeCompare(b[1])),
        [
          [testId("mini-b"), "Edited here"],
          [testId("mini-a"), "Mini a"],
        ],
      );
      assert.equal(
        db
          .select()
          .from(miniatureRequiredPaints)
          .all()
          .filter((row) => row.miniatureId === testId("mini-a")).length,
        2,
      );
      assert.equal(
        db
          .select()
          .from(paintInventory)
          .all()
          .find((row) => row.paintId === testId("example/base/a"))!.quantity,
        9,
      );
      assert.equal(db.select().from(catalogSources).all().length, 2);
    });

    await t.test("merge matches a plugin by repository when its UUID differs", async () => {
      clearVault();
      seedVault("a", null);
      const { manifest } = await exportZip();
      clearVault();
      seedVault("a", null);
      const db = getDb();
      // The same plugin, installed in this vault under another UUID.
      const here = testId("plugin-a here");
      db.insert(catalogSources)
        .values({ ...db.select().from(catalogSources).get()!, id: here, repository: "example/plugin-a-copy" })
        .run();
      db.update(catalogSourceItems).set({ sourceId: here }).run();
      db.delete(catalogSources)
        .where(eq(catalogSources.id, testId("plugin-a")))
        .run();
      db.update(catalogSources).set({ repository: "example/plugin-a" }).run();
      manifest.tables.pluginItems.push({
        sourceId: testId("plugin-a"),
        kind: "paint",
        itemId: testId("x"),
      });
      manifest.tables.paints.push({ id: testId("x"), brand: "B", range: "R", name: "X" });
      assert.equal((await restore(zip(manifest), "merge")).status, 200);
      assert.deepEqual(
        db
          .select()
          .from(catalogSources)
          .all()
          .map((row) => row.id),
        [here],
      );
      assert.ok(
        db
          .select()
          .from(catalogSourceItems)
          .all()
          .every((row) => row.sourceId === here),
      );
      assert.equal(db.select().from(catalogSourceItems).all().length, 2);
    });

    await t.test("merge keeps the vault's default substitution for a paint", async () => {
      clearVault();
      const db = getDb();
      db.insert(paintCatalog)
        .values({ id: testUserId("target"), brand: "Mine", range: "Base", name: "Target" })
        .run();
      const substitution = (name: string, isDefault: boolean) => ({
        id: testId(name),
        targetPaintId: testUserId("target"),
        name,
        isDefault,
        createdAt: 1,
      });
      db.insert(paintSubstitutions).values(substitution("mine", true)).run();
      const { manifest } = await exportZip();
      manifest.tables.substitutions = [substitution("theirs", true), substitution("other", true)];
      assert.equal((await restore(zip(manifest), "merge")).status, 200);
      assert.deepEqual(
        db
          .select()
          .from(paintSubstitutions)
          .all()
          .map((row) => [row.name, row.isDefault])
          .sort(),
        [
          ["mine", true],
          ["other", false],
          ["theirs", false],
        ],
      );
    });

    await t.test("a backup with text in a number field is refused", async () => {
      clearVault();
      getDb()
        .insert(paintCatalog)
        .values({ id: testUserId("p"), brand: "Mine", range: "Base", name: "P" })
        .run();
      const { manifest } = await exportZip();
      manifest.tables.paintInventory = [
        { paintId: testUserId("p"), state: "OWNED", stockLevel: "FULL", quantity: "lots" },
      ];
      const response = await restore(zip(manifest), "replace");
      assert.equal(response.status, 400);
      assert.match(await errorOf(response), /records this version can't store/);
      assert.equal(getDb().select().from(paintCatalog).all().length, 1);
    });

    await t.test("a failed restore changes nothing and removes the images it wrote", async () => {
      const NEW_PHOTO = `${testId("new photo")}.png`;
      clearVault();
      seedVault("a", photo);
      const before = (await exportZip()).manifest.tables;
      const tables = {
        ...Object.fromEntries(SECTION_KEYS.map((key) => [key, []])),
        miniatures: [
          { id: testId("broken"), title: "Broken", status: "OWNED", createdAt: 1, imageKey: NEW_PHOTO },
        ],
        miniatureRecipe: [
          { id: testId("r"), miniatureId: testId("broken"), paintId: testId("missing-paint"), step: "OTHER" },
        ],
      };
      const broken = zip(
        { format: "paintwarden-backup", version: 1, exportedAt: "", images: [NEW_PHOTO], tables },
        { [NEW_PHOTO]: new Uint8Array([1]) },
      );
      for (const mode of ["replace", "merge"]) {
        const response = await restore(broken, mode);
        assert.equal(response.status, 400);
        assert.match(await errorOf(response), /refer/);
        assert.deepEqual((await exportZip()).manifest.tables, before);
        assert.equal(existsSync(imagePath(NEW_PHOTO)), false);
      }
    });

    await t.test("a failed concurrent restore cannot delete a successful restore's photo", async () => {
      clearVault();
      mkdirSync(path.join(directory, "images"), { recursive: true });
      const shared = `${testId("concurrent shared photo")}.png`;
      const keys = [shared, ...Array.from({ length: 500 }, (_, index) => `${testId(`race-${index}`)}.png`)];
      const manifest = {
        format: "paintwarden-backup",
        version: 1,
        images: keys,
        tables: {
          paintInventory: [{ paintId: testId("missing race paint"), state: "OWNED", quantity: 1 }],
        },
      };
      const failedFile = path.join(directory, "failed-concurrent.zip");
      const goodFile = path.join(directory, "good-concurrent.zip");
      const id = testId("concurrent miniature");
      writeFileSync(
        failedFile,
        zip(manifest, Object.fromEntries(keys.map((key) => [key, new Uint8Array([1])]))),
      );
      writeFileSync(
        goodFile,
        zip(
          {
            ...manifest,
            images: [shared],
            tables: {
              miniatures: [
                { id, title: "Successful restore", status: "OWNED", imageKey: shared, createdAt: 1 },
              ],
            },
          },
          { [shared]: new Uint8Array([1]) },
        ),
      );
      // Start B after A writes their shared image, while A still has 500 files to write.
      // This is the release audit repro, retained without timing sleeps or polling.
      let observer: ReturnType<typeof watch> | undefined;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const firstImage = new Promise<void>((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Restore did not write its first image")), 10_000);
        observer = watch(path.join(directory, "images"), (_, filename) => {
          if (filename === shared) resolve();
        });
      });
      const failed = restoreBackup(failedFile, "merge").then(
        () => null,
        (error: unknown) => error,
      );
      try {
        await firstImage;
        await restoreBackup(goodFile, "merge");
        assert.ok((await failed) instanceof Error);
        const row = getDb().select().from(miniatures).where(eq(miniatures.id, id)).get();
        assert.equal(row?.imageKey, shared);
        assert.equal(existsSync(imagePath(shared)), true, "committed miniature must retain its image");
        assert.ok(
          keys.slice(1).every((key) => !existsSync(imagePath(key))),
          "failed restore's unused files are removed",
        );
      } finally {
        clearTimeout(timeout);
        observer?.close();
        await failed;
      }
    });

    await t.test("rollback keeps a newly recovered image a committed row already references", async () => {
      clearVault();
      const key = `${testId("recovered committed photo")}.png`;
      const id = testId("committed miniature");
      getDb()
        .insert(miniatures)
        .values({ id, title: "Keep my photo", status: "OWNED", imageKey: key, createdAt: 1 })
        .run();
      const response = await restore(
        zip(
          {
            format: "paintwarden-backup",
            version: 1,
            images: [key],
            tables: {
              paintInventory: [{ paintId: testId("absent recovery paint"), state: "OWNED", quantity: 1 }],
            },
          },
          { [key]: new Uint8Array([2]) },
        ),
      );
      assert.equal(response.status, 400);
      assert.equal(getDb().select().from(miniatures).where(eq(miniatures.id, id)).get()?.imageKey, key);
      assert.equal(existsSync(imagePath(key)), true);
      await deleteImage(key);
      assert.equal(existsSync(imagePath(key)), true, "even stale cleanup may not delete a referenced image");
    });

    await t.test("restore and photo mutations share the same operation-wide lock", async () => {
      clearVault();
      seedVault("locked", null);
      let entered!: () => void;
      let release!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const operation = withImageMutation(async () => {
        entered();
        await gate;
      });
      await started;
      const photo = uploadPhoto(testId("mini-locked"), 15);
      const emptyMerge = restore(zip({ format: "paintwarden-backup", version: 1, images: [], tables: {} }));
      let photoDone = false;
      let restoreDone = false;
      void photo.then(
        () => {
          photoDone = true;
        },
        () => {
          photoDone = true;
        },
      );
      void emptyMerge.then(
        () => {
          restoreDone = true;
        },
        () => {
          restoreDone = true;
        },
      );
      try {
        await Promise.resolve();
        assert.equal(photoDone, false);
        assert.equal(restoreDone, false);
        assert.equal(getDb().select().from(miniatures).get()?.imageKey, null);
      } finally {
        release();
      }
      await operation;
      const key = await photo;
      assert.equal((await emptyMerge).status, 200);
      assert.equal(existsSync(imagePath(key)), true);
    });

    await t.test("Replace rejects every incomplete manifest without changing rows or images", async () => {
      clearVault();
      const kept = await saveImage(png(14));
      seedVault("incomplete", kept);
      const { manifest } = await exportZip();
      const before = manifest.tables;
      // Every section is mandatory, even if it is empty in a complete backup.
      for (const key of SECTION_KEYS) {
        const tables = { ...before };
        delete tables[key];
        const response = await restore(zip({ ...manifest, tables }), "replace");
        assert.equal(response.status, 400, key);
        assert.match(await errorOf(response), /incomplete/);
        assert.deepEqual((await exportZip()).manifest.tables, before);
        assert.equal(existsSync(imagePath(kept)), true);
      }
      const empty = { ...manifest, tables: {}, images: [] };
      assert.match(await errorOf(await restore(zip(empty), "replace")), /incomplete/);
      // Partial merge remains useful and does not erase omitted sections.
      assert.equal((await restore(zip(empty), "merge")).status, 200);
      assert.deepEqual((await exportZip()).manifest.tables, before);
      const completeEmpty = { ...empty, tables: Object.fromEntries(SECTION_KEYS.map((key) => [key, []])) };
      assert.equal((await restore(zip(completeEmpty), "replace")).status, 200);
      assert.ok(Object.values((await exportZip()).manifest.tables).every((rows) => rows.length === 0));
      assert.equal(existsSync(imagePath(kept)), false);
    });

    await t.test("rejects other files, versions and modes", async () => {
      const valid = { format: "paintwarden-backup", version: 1, exportedAt: "", images: [], tables: {} };
      assert.equal((await restore(zip(valid), "overwrite")).status, 400);
      assert.equal((await restore("not a backup")).status, 400);
      assert.equal((await restore(zipSync({ "other.txt": strToU8("x") }))).status, 400);
      assert.equal((await restore(zip({ ...valid, version: 2 }))).status, 400);
      assert.match(
        await errorOf(await restore(zip({ ...valid, tables: { surprise: [] } }))),
        /different version/,
      );
      assert.equal((await restore(zip(valid, { "../escape.png": new Uint8Array([1]) }))).status, 400);
    });

    await t.test("a backup whose image is damaged is refused and leaves nothing behind", async () => {
      clearVault();
      const key = `${testId("damaged photo")}.png`;
      const valid = {
        format: "paintwarden-backup",
        version: 1,
        exportedAt: "",
        images: [key],
        tables: Object.fromEntries(SECTION_KEYS.map((key) => [key, []])),
      };
      const bytes = zipSync({
        "backup.json": strToU8(JSON.stringify(valid)),
        [`images/${key}`]: [strToU8("original image bytes"), { level: 0 }],
      });
      const at = Buffer.from(bytes).indexOf("original");
      bytes[at] ^= 0xff;
      const response = await restore(bytes, "replace");
      assert.equal(response.status, 400);
      assert.match(await errorOf(response), /damaged/);
      assert.equal(existsSync(imagePath(key)), false);
    });

    await t.test("an empty or truncated upload is refused and its temporary file removed", async () => {
      const valid = { format: "paintwarden-backup", version: 1, exportedAt: "", images: [], tables: {} };
      assert.equal((await restore(new Uint8Array())).status, 400);
      const truncated = await restore(zip(valid).subarray(0, 30));
      assert.equal(truncated.status, 400);
      assert.match(await errorOf(truncated), /damaged/);
      assert.deepEqual(readdirSync(path.join(directory, "restore-uploads")), []);
    });

    await t.test("an export is sent in pieces rather than as one buffer", async () => {
      const reader = GET().body!.getReader();
      let chunks = 0;
      while (!(await reader.read()).done) chunks += 1;
      assert.ok(chunks > 1);
    });

    await t.test(
      "replacing or removing a photo deletes the old file only after the row changes",
      async () => {
        clearVault();
        seedVault("a", null);
        const id = testId("mini-a");
        const first = await uploadPhoto(id, 10);
        const second = await uploadPhoto(id, 11);
        assert.equal(existsSync(imagePath(first)), false);
        assert.equal(existsSync(imagePath(second)), true);
        assert.equal((await photoRoute.DELETE(new Request("http://localhost"), params(id))).status, 200);
        assert.equal(getDb().select().from(miniatures).get()!.imageKey, null);
        assert.equal(existsSync(imagePath(second)), false);
        const third = await uploadPhoto(id, 12);
        await miniatureRoute.DELETE(new Request("http://localhost"), params(id));
        assert.equal(getDb().select().from(miniatures).all().length, 0);
        assert.equal(existsSync(imagePath(third)), false);
        const missing = await photoRoute.POST(
          new Request("http://localhost", {
            method: "POST",
            body: (() => {
              const body = new FormData();
              body.set("image", png(13));
              return body;
            })(),
          }),
          params(id),
        );
        assert.equal(missing.status, 404);
      },
    );

    await t.test("a photo replaced during an export is still in that backup", async () => {
      clearVault();
      seedVault("a", null);
      const id = testId("mini-a");
      const old = await uploadPhoto(id, 20);
      const reader = GET().body!.getReader();
      // The first chunk starts the export, which takes its snapshot.
      const chunks: Uint8Array[] = [(await reader.read()).value!];
      const replacement = await uploadPhoto(id, 21);
      assert.equal(existsSync(imagePath(old)), true, "the export still holds the old photo");
      for (let next = await reader.read(); !next.done; next = await reader.read()) chunks.push(next.value);
      const files = unzipSync(new Uint8Array(Buffer.concat(chunks)));
      const manifest = JSON.parse(strFromU8(files["backup.json"])) as Manifest;
      assert.equal(manifest.tables.miniatures[0].imageKey, old);
      assert.deepEqual([...files[`images/${old}`]], [137, 80, 78, 71, 20]);
      // Once the export is done, the replaced photo is deleted.
      assert.equal(existsSync(imagePath(old)), false);
      assert.equal(existsSync(imagePath(replacement)), true);
      // The backup restores as it was.
      assert.equal((await restore(zipSync(files), "replace")).status, 200);
      assert.equal(getDb().select().from(miniatures).get()!.imageKey, old);
      assert.equal(existsSync(imagePath(old)), true);
      assert.equal(existsSync(imagePath(replacement)), false);
    });

    await t.test("an export leaves out references to images already missing from the vault", async () => {
      clearVault();
      const lost = await saveImage(png(30));
      seedVault("a", lost);
      const template = await saveImage(png(31));
      getDb().update(miniatureTemplates).set({ imageKey: template }).run();
      rmSync(imagePath(lost));
      const { files, manifest } = await exportZip();
      assert.equal(manifest.tables.miniatures[0].imageKey, null);
      assert.equal(manifest.tables.templates[0].imageKey, template);
      assert.deepEqual(manifest.images, [template]);
      assert.equal((await restore(zipSync(files), "replace")).status, 200);
      assert.equal(getDb().select().from(miniatures).get()!.imageKey, null);
    });

    await t.test("a backup whose records refer to images it doesn't hold is refused", async () => {
      clearVault();
      const kept = await saveImage(png(40));
      seedVault("a", kept);
      const { files, manifest } = await exportZip();
      const before = manifest.tables;
      const withoutImage = Object.fromEntries(
        Object.entries(files).filter(([name]) => !name.startsWith("images/")),
      );
      const schemeImage = {
        id: testId("scheme image"),
        schemeId: testUserId("scheme-a"),
        imageUrl: `/api/catalog-source-images/${testId("absent")}.png`,
        sortOrder: 0,
      };
      const brokenScheme = zip(
        {
          ...manifest,
          images: [kept],
          tables: { ...manifest.tables, schemeImages: [schemeImage] },
        },
        { [kept]: files[`images/${kept}`] },
      );
      for (const mode of ["replace", "merge"])
        for (const broken of [zipSync(withoutImage), brokenScheme]) {
          const response = await restore(broken, mode);
          assert.equal(response.status, 400);
          assert.match(await errorOf(response), /images its records refer to are missing/);
          assert.deepEqual((await exportZip()).manifest.tables, before);
          assert.equal(existsSync(imagePath(kept)), true);
        }
    });

    await t.test("non-ZIP uploads are refused without changing vault data or images", async () => {
      const before = (await exportZip()).manifest.tables;
      const images = readdirSync(path.join(directory, "images")).sort();
      for (const body of [
        JSON.stringify({ format: "paintwarden-backup", version: 1, tables: before, images: [] }),
        "not a ZIP",
      ]) {
        for (const mode of ["merge", "replace"]) {
          const response = await restore(body, mode);
          assert.equal(response.status, 400);
          assert.match(await errorOf(response), /Choose a Paintwarden backup \(\.zip\) file/);
          assert.deepEqual((await exportZip()).manifest.tables, before);
          assert.deepEqual(readdirSync(path.join(directory, "images")).sort(), images);
          assert.deepEqual(readdirSync(path.join(directory, "restore-uploads")), []);
        }
      }
    });
  } finally {
    getSqlite().close();
    rmSync(directory, { recursive: true, force: true });
  }
});
