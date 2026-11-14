import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

type Entry = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };
type ReleasedEntry = Entry & { sha256: string; snapshot: string; snapshotSha256: string };
const migrations = new URL("../drizzle/", import.meta.url);
const released = JSON.parse(
  readFileSync(
    new URL("../test-fixtures/data-compatibility/released-migrations.json", import.meta.url),
    "utf8",
  ),
) as { entries: ReleasedEntry[] };
const hash = (file: URL) => createHash("sha256").update(readFileSync(file)).digest("hex");

void test("released migration SQL, snapshots and journal entries are immutable; new entries append only", () => {
  const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", migrations), "utf8")) as {
    entries: Entry[];
  };
  assert.ok(journal.entries.length >= released.entries.length, "Never remove a released migration");
  for (const [index, { sha256, snapshot, snapshotSha256, ...entry }] of released.entries.entries()) {
    assert.deepEqual(journal.entries[index], entry, `Released journal entry ${entry.tag} changed`);
    const sql = new URL(`${entry.tag}.sql`, migrations);
    assert.equal(hash(sql), sha256, `Do not edit released ${fileURLToPath(sql)}; append a migration instead`);
    assert.equal(
      hash(new URL(snapshot, migrations)),
      snapshotSha256,
      `Released snapshot ${snapshot} changed`,
    );
  }
  for (const [index, entry] of journal.entries.entries()) {
    assert.equal(entry.idx, index, "Journal entries must retain their order");
    if (index > 0)
      assert.ok(entry.when > journal.entries[index - 1].when, "New migration timestamps must advance");
  }
});
