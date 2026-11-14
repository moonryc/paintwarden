import assert from "node:assert/strict";
import { mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { unzipSync } from "fflate";
import sharp from "sharp";

const directory = await mkdtemp(path.join(os.tmpdir(), "paintwarden-thumbnails-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getSqlite } = await import("../db");
const { saveImageBytes, writeImage, copyImage, deleteImage, imageResponse } = await import("./image-store");
const { thumbnailPath, thumbnailWidths, ensureThumbnail } = await import("./image-thumbnails");
const { createBackup, restoreBackup } = await import("./backup");
const { withImageMutation } = await import("./image-mutations");
const db = getSqlite();
const imagePath = (key: string) => path.join(directory, "images", key);
const request = (key: string, width = "320") => new Request(`http://fixture/api/image?v=${key}&w=${width}`);
const jpeg = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: "#53769a" } })
  .jpeg({ quality: 90 })
  .toBuffer();

void test("photo uploads generate immutable bounded WebP variants, with strict width validation", async () => {
  const key = await saveImageBytes(jpeg, "image/jpeg");
  for (const width of thumbnailWidths) {
    const metadata = await sharp(thumbnailPath(imagePath(key), width)).metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.format, "webp");
    assert.ok((await stat(thumbnailPath(imagePath(key), width))).size < jpeg.length);
    const response = await imageResponse(key, request(key, String(width)));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control")!, /immutable/);
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal((await response.arrayBuffer()).byteLength, Number(response.headers.get("content-length")));
  }
  for (const invalid of ["", "0", "319", "100000", "0320", "320.0", "../320"])
    assert.equal((await imageResponse(key, request(key, invalid))).status, 400);
  const full = await imageResponse(key, new Request(`http://fixture/api/image?v=${key}`));
  assert.equal(full.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), jpeg);
  assert.equal((await imageResponse("../secret", request(key))).status, 404);
  await deleteImage(key);
  assert.deepEqual(await readdir(path.join(directory, "images")), []);
});

void test("restored images regenerate lazily and concurrent misses coalesce without partial files", async () => {
  const key = "12345678-1234-4234-8234-123456789abc.jpg";
  await writeImage(key, jpeg);
  assert.deepEqual(await readdir(path.join(directory, "images")), [key]);
  const results = await Promise.all(Array.from({ length: 20 }, () => imageResponse(key, request(key))));
  const bodies = await Promise.all(
    results.map(async (response) => {
      assert.equal(response.status, 200);
      return Buffer.from(await response.arrayBuffer());
    }),
  );
  for (const body of bodies) assert.deepEqual(body, bodies[0]);
  assert.equal((await sharp(bodies[0]).metadata()).width, 320);
  assert.deepEqual(
    (await readdir(path.join(directory, "images"))).sort(),
    [key, path.basename(thumbnailPath(key, 320))].sort(),
  );
  await deleteImage(key);
});

void test("decode and cleanup cannot publish an orphan or deadlock a concurrent upload", async () => {
  const key = "12345678-1234-4234-8234-123456789abd.jpg";
  await writeImage(key, jpeg);
  // An on-demand decoder may finish while a mutation owns the publication lock.
  // Its native slot must be released before it waits for that lock.
  let entered!: () => void;
  let start!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const resume = new Promise<void>((resolve) => {
    start = resolve;
  });
  let uploaded!: string;
  const mutation = withImageMutation(async () => {
    entered();
    await resume;
    uploaded = await saveImageBytes(jpeg, "image/jpeg");
    await deleteImage(key);
  });
  await ready;
  const lazy = ensureThumbnail(imagePath(key), 640);
  const rejected = assert.rejects(lazy);
  start();
  await mutation;
  await rejected;
  assert.ok((await stat(thumbnailPath(imagePath(uploaded), 320))).isFile());
  assert.ok(!(await readdir(path.join(directory, "images"))).some((name) => name.startsWith(key)));
  await deleteImage(uploaded);
});

void test("backup skips derivatives, restores exact originals and keeps referenced photos during cleanup", async () => {
  const key = await saveImageBytes(jpeg, "image/jpeg");
  const id = "12345678-1234-4234-8234-123456789abe";
  db.prepare(
    "INSERT INTO miniatures(id,title,status,image_key,created_at,updated_at) VALUES(?,'Photo fixture','OWNED',?,1,1)",
  ).run(id, key);
  const backup = Buffer.from(await new Response(createBackup()).arrayBuffer());
  const entries = unzipSync(backup);
  assert.ok(entries[`images/${key}`]);
  assert.ok(!Object.keys(entries).some((name) => name.includes("thumb-v")));
  await deleteImage(key);
  assert.ok((await stat(imagePath(key))).isFile());
  const clone = await copyImage(key);
  assert.ok(clone && clone !== key);
  await deleteImage(clone);
  const file = path.join(directory, "roundtrip.zip");
  await writeFile(file, backup);
  db.prepare("DELETE FROM miniatures WHERE id=?").run(id);
  await deleteImage(key);
  await restoreBackup(file, "replace");
  assert.deepEqual((await readdir(path.join(directory, "images"))).sort(), [key]);
  const full = await imageResponse(key);
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), jpeg);
  const thumb = await imageResponse(key, request(key));
  assert.equal(thumb.status, 200);
  assert.equal((await sharp(Buffer.from(await thumb.arrayBuffer())).metadata()).width, 320);
  assert.deepEqual(db.prepare("SELECT image_key FROM miniatures WHERE id=?").get(id), { image_key: key });
});
