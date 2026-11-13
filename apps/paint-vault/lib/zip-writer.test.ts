import assert from "node:assert/strict";
import test from "node:test";
import { inflateRawSync } from "node:zlib";

import { ZipFormatError, readZipDirectory, readZipEntryData } from "@paint-vault/core/zip-reader";
import { strFromU8, unzipSync } from "fflate";

import { writeZip, type ZipFile } from "./zip-writer.ts";

async function* filesOf(files: ZipFile[]) {
  yield* files;
}

async function zipBytes(files: ZipFile[]) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of writeZip(filesOf(files))) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const sourceOf = (bytes: Uint8Array) => ({
  size: bytes.byteLength,
  read: (offset: number, length: number) => Promise.resolve(bytes.subarray(offset, offset + length)),
});

const files: ZipFile[] = [
  { name: "images/a.webp", data: new Uint8Array([1, 2, 3]) },
  { name: "backup.json", data: Buffer.from('{"name":"Déjà"}'.repeat(20)), compress: true },
];

test("writes a zip that other tools can read", async () => {
  const entries = unzipSync(await zipBytes(files));
  assert.deepEqual([...entries["images/a.webp"]], [1, 2, 3]);
  assert.equal(strFromU8(entries["backup.json"]), '{"name":"Déjà"}'.repeat(20));
});

test("reads back what was written", async () => {
  const source = sourceOf(await zipBytes(files));
  const [image, manifest] = await readZipDirectory(source);
  assert.equal(image.name, "images/a.webp");
  assert.equal(image.method, 0);
  assert.deepEqual([...(await readZipEntryData(source, image))], [1, 2, 3]);
  assert.equal(manifest.method, 8);
  assert.equal(
    inflateRawSync(await readZipEntryData(source, manifest)).toString(),
    '{"name":"Déjà"}'.repeat(20),
  );
});

test("uses ZIP64 records for more files than the classic format can count", async () => {
  const count = 70_000;
  const bytes = await zipBytes(
    Array.from({ length: count }, (_, index) => ({ name: `${index}`, data: new Uint8Array() })),
  );
  const entries = await readZipDirectory(sourceOf(bytes));
  assert.equal(entries.length, count);
  assert.equal(entries[count - 1].name, `${count - 1}`);
});

test("reads a ZIP64 offset from an entry's extra field", async () => {
  const bytes = await zipBytes(files);
  const entries = await readZipDirectory(sourceOf(bytes));
  // Rewrites the last central header as a ZIP64 entry, as an archive over 4 GiB would have.
  const name = Buffer.from(entries[1].name);
  const headerAt = bytes.lastIndexOf(Buffer.concat([Buffer.from([0x50, 0x4b, 1, 2])]));
  const headerEnd = headerAt + 46 + name.byteLength;
  const extra = Buffer.alloc(12);
  extra.writeUInt16LE(1, 0);
  extra.writeUInt16LE(8, 2);
  extra.writeBigUInt64LE(BigInt(entries[1].headerOffset), 4);
  const header = Buffer.from(bytes.subarray(headerAt, headerEnd));
  header.writeUInt16LE(extra.byteLength, 30);
  header.writeUInt32LE(0xffffffff, 42);
  const end = Buffer.from(bytes.subarray(headerEnd));
  end.writeUInt32LE(headerEnd - bytes.indexOf(Buffer.from([0x50, 0x4b, 1, 2])) + extra.byteLength, 12);
  const patched = Buffer.concat([bytes.subarray(0, headerAt), header, extra, end]);
  const [, manifest] = await readZipDirectory(sourceOf(patched));
  assert.equal(manifest.headerOffset, entries[1].headerOffset);
});

test("reports damaged files", async () => {
  const bytes = await zipBytes(files);
  await assert.rejects(readZipDirectory(sourceOf(bytes.subarray(0, 40))), ZipFormatError);
  await assert.rejects(readZipDirectory(sourceOf(new Uint8Array(4))), ZipFormatError);
  const entries = await readZipDirectory(sourceOf(bytes));
  await assert.rejects(
    readZipEntryData(sourceOf(bytes), { ...entries[0], compressedSize: bytes.byteLength }),
    ZipFormatError,
  );
  await assert.rejects(readZipEntryData(sourceOf(bytes), { ...entries[0], method: 99 }), ZipFormatError);
  await assert.rejects(readZipEntryData(sourceOf(bytes), { ...entries[0], flags: 1 }), ZipFormatError);
});
