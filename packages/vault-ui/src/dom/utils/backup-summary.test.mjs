import assert from "node:assert/strict";
import test from "node:test";

import { strToU8, zipSync } from "fflate";

import { summarizeBackup } from "./backup-summary.ts";

const zipBackup = (manifest, extra = {}) =>
  zipSync({ "backup.json": strToU8(JSON.stringify(manifest)), ...extra });
const summarize = (bytes) => summarizeBackup(new Blob([bytes]));

test("summarizes the contents of a zip backup", async () => {
  const summary = await summarize(
    zipBackup(
      {
        format: "paint-vault-backup",
        version: 1,
        exportedAt: "2026-10-01T12:00:00.000Z",
        images: ["a.png"],
        tables: {
          miniatures: [{ id: "m1" }, { id: "m2" }],
          plugins: [{ id: "owner/repo" }],
          paints: [{ id: "user:p1" }, { id: "citadel/base/red" }],
          paintInventory: [{ paintId: "user:p1" }],
          schemes: [{ id: "user:s1" }, { id: "source-scheme" }],
          templates: [],
        },
      },
      { "images/a.png": new Uint8Array([1, 2, 3]) },
    ),
  );
  assert.equal(summary.ok, true);
  assert.equal(summary.legacy, false);
  assert.equal(summary.exportedAt?.toISOString(), "2026-10-01T12:00:00.000Z");
  assert.deepEqual(summary.counts, [
    { label: "miniatures", count: 2 },
    { label: "image", count: 1 },
    { label: "plugin", count: 1 },
    { label: "custom paint", count: 1 },
    { label: "paint record", count: 1 },
    { label: "scheme", count: 1 },
  ]);
});

test("recognizes pre-release JSON backups, which can only be merged", async () => {
  const summary = await summarize(
    strToU8(
      JSON.stringify({
        format: "paint-vault-backup",
        version: 4,
        miniatures: [{}],
        colorSchemes: [
          { id: "abc", isSystem: false },
          { id: "source", isSystem: true },
        ],
      }),
    ),
  );
  assert.equal(summary.ok, true);
  assert.equal(summary.legacy, true);
  assert.deepEqual(summary.counts, [
    { label: "miniature", count: 1 },
    { label: "scheme", count: 1 },
  ]);
});

test("rejects other files and versions", async () => {
  assert.equal((await summarize(strToU8("not a backup"))).ok, false);
  assert.equal((await summarize(zipSync({ "other.txt": strToU8("x") }))).ok, false);
  assert.equal(
    (await summarize(zipBackup({ format: "paint-vault-backup", version: 2, tables: {} }))).ok,
    false,
  );
  assert.equal(
    (await summarize(strToU8(JSON.stringify({ format: "paint-vault-backup", version: 1 })))).ok,
    false,
  );
  assert.equal((await summarize(zipBackup({ format: "something-else", version: 1 }))).ok, false);
});
