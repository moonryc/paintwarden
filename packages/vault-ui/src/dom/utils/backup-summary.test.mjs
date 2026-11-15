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
        format: "paintwarden-backup",
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
  assert.equal(summary.exportedAt?.toISOString(), "2026-10-01T12:00:00.000Z");
  assert.deepEqual(summary.counts, [
    { label: "miniatures", count: 2, key: "backupMiniature" },
    { label: "image", count: 1, key: "backupImage" },
    { label: "plugin", count: 1, key: "backupPlugin" },
    { label: "custom paint", count: 1, key: "backupCustomPaint" },
    { label: "paint record", count: 1, key: "backupPaintRecord" },
    { label: "scheme", count: 1, key: "backupScheme" },
  ]);
});

test("rejects other files and versions", async () => {
  assert.equal((await summarize(strToU8("not a backup"))).ok, false);
  assert.equal((await summarize(zipSync({ "other.txt": strToU8("x") }))).ok, false);
  assert.equal(
    (await summarize(zipBackup({ format: "paintwarden-backup", version: 3, tables: {} }))).ok,
    false,
  );
  assert.equal(
    (await summarize(strToU8(JSON.stringify({ format: "paintwarden-backup", version: 1 })))).ok,
    false,
  );
  assert.equal((await summarize(zipBackup({ format: "something-else", version: 1 }))).ok, false);
});

test("rejects JSON backups even when they use the current brand", async () => {
  for (const version of [1, 3, 4])
    assert.equal(
      (await summarize(strToU8(JSON.stringify({ format: "paintwarden-backup", version })))).ok,
      false,
    );
});

test("previews current folders v2 exports as well as v1 before Replace restore", async () => {
  for (const version of [1, 2]) {
    const result = await summarize(
      zipBackup({
        format: "paintwarden-backup",
        version,
        tables: {
          miniatures: [{ id: "user:mini" }],
          folders: version === 2 ? [{ id: "user:folder", kind: "miniature" }] : [],
        },
        images: [],
      }),
    );
    assert.equal(result.ok, true);
    assert.ok(result.counts.some(({ key, count }) => key === "backupMiniature" && count === 1));
  }
});
