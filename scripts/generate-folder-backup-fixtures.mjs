// Additive synthetic ZIP2 fixtures. Never overwrite the frozen ZIP1/SQLite artifacts.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BACKUP_SECTIONS, BACKUP_VERSION } from "../apps/paintwarden/lib/backup-format.ts";
import { testId } from "../apps/paintwarden/lib/test-ids.ts";
import { writeZip } from "../apps/paintwarden/lib/zip-writer.ts";

const root = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
assert.ok(process.argv[2], "Pass an empty directory outside the repository");
mkdirSync(path.resolve(process.argv[2]), { recursive: true });
const output = realpathSync(path.resolve(process.argv[2]));
assert.ok(output !== root && !output.startsWith(`${root}${path.sep}`));
assert.deepEqual(readdirSync(output), [], "Never overwrite existing fixtures");
assert.equal(BACKUP_VERSION, 2);
const fixtures = path.join(root, "apps/paintwarden/test-fixtures/data-compatibility");
const oldTables = JSON.parse(readFileSync(path.join(fixtures, "v1-tables.json"), "utf8"));
const stamp = 1700000000000;
const folder = (name, kind, parentId = null, sortOrder = 0) => ({
  id: testId(`folder-fixture-${name}`),
  name,
  kind,
  parentId,
  sortOrder,
  createdAt: stamp,
  updatedAt: stamp,
});
const project = folder("Synthetic project", "miniature");
const subproject = folder("Synthetic subproject", "miniature", project.id, 1);
const templates = folder("Synthetic templates", "template");
const subtemplates = folder("Synthetic nested templates", "template", templates.id, 2);
const tables = {
  folders: [project, subproject, templates, subtemplates],
  ...oldTables,
  templates: oldTables.templates.map((row) => ({ ...row, folderId: subtemplates.id })),
  miniatures: oldTables.miniatures.map((row) => ({ ...row, folderId: subproject.id })),
};
for (const [key, section] of Object.entries(BACKUP_SECTIONS))
  for (const row of tables[key]) assert.deepEqual(Object.keys(row).sort(), [...section.fields].sort(), key);
const image = readFileSync(path.join(fixtures, "pixel.png"));
const imageKey = tables.templates[0].imageKey;
const manifest = {
  format: "paintwarden-backup",
  version: 2,
  appVersion: "1.0.0",
  exportedAt: new Date(stamp).toISOString(),
  tables,
  images: [imageKey],
};
async function* files() {
  yield { name: `images/${imageKey}`, data: image };
  yield { name: "backup.json", data: Buffer.from(JSON.stringify(manifest)), compress: true };
}
const chunks = [];
for await (const chunk of writeZip(files(), new Date(2023, 10, 14, 22, 13, 20))) chunks.push(chunk);
const write = (name, bytes) => writeFileSync(path.join(output, name), bytes);
write("zip-v2-folders.zip", Buffer.concat(chunks));
write("v2-folders-tables.json", `${JSON.stringify(tables, null, 2)}\n`);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sourceFiles = [
  "scripts/generate-folder-backup-fixtures.mjs",
  "apps/paintwarden/lib/backup-format.ts",
  "apps/paintwarden/lib/zip-writer.ts",
];
write(
  "provenance-v2-folders.json",
  `${JSON.stringify(
    {
      kind: "synthetic-folder-backup-v2",
      description:
        "Additive ZIP2 contract fixture, invented nested folders and frozen synthetic ZIP1 rows; not a historical release artifact",
      sources: Object.fromEntries(
        sourceFiles.map((file) => [file, sha256(readFileSync(path.join(root, file)))]),
      ),
      files: Object.fromEntries(
        ["zip-v2-folders.zip", "v2-folders-tables.json"].map((file) => [
          file,
          sha256(readFileSync(path.join(output, file))),
        ]),
      ),
    },
    null,
    2,
  )}\n`,
);
