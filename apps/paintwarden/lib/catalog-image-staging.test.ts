import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

const directory = await mkdtemp(path.join(os.tmpdir(), "paintwarden-catalog-staging-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const root = path.join(directory, ".plugin-staging");
const { getSqlite } = await import("../db");
const { createCatalogImageStage, sweepCatalogImageStages } = await import("./catalog-image-staging");
const { imageResponse } = await import("./image-store");
const { prepareStagedThumbnails, thumbnailPath, thumbnailWidths } = await import("./image-thumbnails");
const { withImageMutation } = await import("./image-mutations");
const database = getSqlite();
const original = (key: string) => path.join(directory, "images", key);
const photo = await sharp({ create: { width: 800, height: 500, channels: 3, background: "#547798" } })
  .png()
  .toBuffer();

function insertReference(key: string) {
  database
    .prepare(
      "INSERT INTO miniatures(id,title,status,image_key,created_at,updated_at) VALUES(?,'Stage fixture','OWNED',?,1,1)",
    )
    .run(randomUUID(), key);
}

void test("staged images and derivatives are private, outside HTTP images and unreachable, without waiting on its mutation lock", async () => {
  const stage = await createCatalogImageStage();
  let unblock!: () => void;
  let entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const release = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  const blocked = withImageMutation(async () => {
    entered();
    await release;
  });
  await ready;
  let key: string;
  try {
    // If staging accidentally acquires the lock, the timeout fails instead of hanging.
    key = await Promise.race([
      stage.stage(photo, "png"),
      new Promise<never>((_resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Staging waited on vault lock")), 5000);
        timeout.unref();
      }),
    ]);
  } finally {
    unblock();
    await blocked;
  }
  assert.equal((await imageResponse(key)).status, 404);
  assert.equal((await imageResponse(key, new Request("http://fixture/image?w=160"))).status, 404);
  assert.equal(existsSync(original(key)), false);
  const stages = await readdir(root);
  assert.equal(stages.length, 1);
  const stageDirectory = path.join(root, stages[0]);
  assert.equal((await stat(stageDirectory)).dev, (await stat(directory)).dev);
  for (const width of thumbnailWidths) {
    const metadata = await sharp(thumbnailPath(path.join(stageDirectory, key), width)).metadata();
    assert.equal(metadata.width, width);
  }
  await sweepCatalogImageStages(); // A live stage must not be mistaken for crash debris.
  assert.ok(existsSync(stageDirectory));
  await stage.dispose();
  await stage.dispose();
  assert.deepEqual(await readdir(root), []);
});

void test("partial promotion rollback removes only owned fresh files, never colliding destinations", async () => {
  const stage = await createCatalogImageStage();
  const key = await stage.stage(photo, "png");
  const untouched = await stage.stage(photo, "png");
  assert.notEqual(untouched, key);
  await mkdir(path.dirname(original(key)), { recursive: true });
  const collision = thumbnailPath(original(key), 320);
  await writeFile(collision, "preexisting unrelated file");
  await withImageMutation(async () => {
    assert.throws(
      () =>
        database.transaction(() => {
          insertReference(key);
          stage.promote();
        })(),
      /already exists/,
    );
    assert.ok(existsSync(original(key)));
    stage.rollback();
    stage.rollback();
  });
  assert.equal(existsSync(original(key)), false);
  assert.equal(existsSync(thumbnailPath(original(key), 160)), false);
  assert.equal(existsSync(original(untouched)), false);
  assert.equal(await readFile(collision, "utf8"), "preexisting unrelated file");
  await stage.dispose();
  await rm(collision);
  assert.deepEqual(await readdir(root), []);
});

void test("commit and dispose preserve referenced originals and variants, even if rollback is called", async () => {
  const stage = await createCatalogImageStage();
  const key = await stage.stage(photo, "png");
  await withImageMutation(async () => {
    database.transaction(() => {
      stage.promote();
      insertReference(key);
    })();
    stage.rollback();
    await stage.dispose();
  });
  assert.equal((await imageResponse(key)).status, 200);
  for (const width of thumbnailWidths) assert.ok(existsSync(thumbnailPath(original(key), width)));
  assert.deepEqual(await readdir(root), []);
});

function crashAt(point: "staged" | "before-commit" | "after-commit") {
  const script = `
    import { randomUUID } from 'node:crypto';
    import sharp from 'sharp';
    import { createCatalogImageStage } from './lib/catalog-image-staging.ts';
    import { getSqlite } from './db/index.ts';
    const stage = await createCatalogImageStage();
    const photo = await sharp({ create: { width: 800, height: 500, channels: 3, background: '#547798' } }).png().toBuffer();
    const key = await stage.stage(photo, 'png');
    const database = getSqlite();
    console.log(JSON.stringify({key}));
    if (${JSON.stringify(point)} === 'staged') process.exit(0);
    database.transaction(() => {
      stage.promote();
      database.prepare("INSERT INTO miniatures(id,title,status,image_key,created_at,updated_at) VALUES(?,'Crash fixture','OWNED',?,1,1)").run(randomUUID(),key);
      if (${JSON.stringify(point)} === 'before-commit') process.exit(0);
    })();
    process.exit(0);
  `;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
    cwd: process.cwd(),
    env: { ...process.env, DATA_DIR: directory },
    encoding: "utf8",
    timeout: 20_000,
  });
  assert.equal(child.status, 0, child.stderr);
  return (JSON.parse(child.stdout.trim()) as { key: string }).key;
}

void test("crash sweep cleans abandoned stages and promotions before commit, but preserves post-commit data", async () => {
  const staged = crashAt("staged");
  const before = crashAt("before-commit");
  const after = crashAt("after-commit");
  assert.equal(existsSync(original(staged)), false);
  assert.equal(existsSync(original(before)), true);
  assert.equal(existsSync(original(after)), true);
  for (const width of thumbnailWidths) {
    assert.ok(existsSync(thumbnailPath(original(before), width)));
    assert.ok(existsSync(thumbnailPath(original(after), width)));
  }
  await sweepCatalogImageStages();
  assert.equal(existsSync(original(staged)), false);
  assert.equal(existsSync(original(before)), false);
  assert.equal(existsSync(original(after)), true);
  for (const width of thumbnailWidths) {
    assert.equal(existsSync(thumbnailPath(original(before), width)), false);
    assert.ok(existsSync(thumbnailPath(original(after), width)));
  }
  assert.deepEqual(await readdir(root), []);
  await sweepCatalogImageStages();
  assert.equal((await imageResponse(after)).status, 200);
});

void test("unsafe extensions and malicious journals fail closed without deleting any vault image", async () => {
  const stage = await createCatalogImageStage();
  await assert.rejects(stage.stage(photo, "../png"), /Unsafe/);
  await assert.rejects(stage.stage(photo, ".png"), /Unsafe/);
  await stage.dispose();
  const key = crashAt("after-commit");
  const [id] = await readdir(root);
  const journal = path.join(root, id, `${key}.json`);
  const contents = JSON.parse(await readFile(journal, "utf8")) as { files: { name: string }[] };
  contents.files[0].name = "../../victim.png";
  await writeFile(journal, JSON.stringify(contents));
  await assert.rejects(sweepCatalogImageStages(), /Unsafe/);
  assert.ok(existsSync(original(key)));
  assert.ok(existsSync(journal));
  await rm(path.join(root, id), { recursive: true });
});

void test("pending stages cannot promote, and malformed supported originals retain legacy tolerance", async () => {
  const stage = await createCatalogImageStage();
  const task = stage.stage(Buffer.from("not actually a png"), "png");
  assert.throws(() => stage.promote(), /not ready/);
  const key = await task;
  await withImageMutation(async () => {
    database.transaction(() => {
      stage.promote();
      insertReference(key);
    })();
  });
  await stage.dispose();
  assert.equal(await readFile(original(key), "utf8"), "not actually a png");
  for (const width of thumbnailWidths) assert.equal(existsSync(thumbnailPath(original(key), width)), false);
  await assert.rejects(stage.stage(photo, "png"), /closed/);
  assert.throws(() => stage.promote(), /not ready/);
});

void test("staged derivative filesystem failures are strict, not mistaken for tolerated malformed originals", async () => {
  await assert.rejects(
    prepareStagedThumbnails(path.join(directory, "missing-directory", `${randomUUID()}.png`), photo),
    { code: "ENOENT" },
  );
});
