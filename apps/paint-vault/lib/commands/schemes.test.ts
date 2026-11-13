import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { TEXT_LIMITS } from "@paint-vault/core/text-limits";
import { isUserId, isUuid } from "@paint-vault/core/vault-ids";
import { eq } from "drizzle-orm";

import { testId, testUserId } from "../test-ids.ts";

import type { SchemeEntryInput, SchemeInput } from "./schemes.ts";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-scheme-commands-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getDb, getSqlite } = await import("../../db/index.ts");
const {
  colorSchemes,
  colorSchemeDividers,
  colorSchemeImages,
  colorSchemePaints,
  miniatureColorSchemes,
  miniatures,
  paintCatalog,
} = await import("../../db/schema.ts");
const { createScheme, updateScheme, deleteScheme, SchemeCommandError } = await import("./schemes.ts");
const { POST, PUT, DELETE } = await import("../../app/api/color-schemes/route.ts");
const db = getDb();
const PAINT = testUserId("scheme-command-paint");
db.insert(paintCatalog).values({ id: PAINT, brand: "Mine", range: "Base", name: "Blue" }).run();
after(() => {
  getSqlite().close();
  rmSync(directory, { recursive: true, force: true });
});

const start: SchemeEntryInput = { type: "DIVIDER", label: "GET READY!", tone: "MILESTONE", role: "START" };
const complete: SchemeEntryInput = {
  type: "DIVIDER",
  label: "YOU'RE READY!",
  tone: "MILESTONE",
  role: "COMPLETE",
};
const step: SchemeEntryInput = { type: "DIVIDER", label: "BASECOAT", tone: "SECTION" };
const paint: SchemeEntryInput = { type: "PAINT", paintId: PAINT };
const input = (entries: (SchemeEntryInput | null)[] = [step, paint]): SchemeInput => ({
  name: "  Blue  ",
  category: "BLUE",
  entries,
});
function fails(operation: () => unknown, message: string, status = 400) {
  assert.throws(operation, (error: unknown) => {
    assert.ok(error instanceof SchemeCommandError);
    assert.equal(error.status, status);
    assert.equal(error.message, message);
    return true;
  });
}
const call = (handler: (request: Request) => Promise<Response>, method: string, body: unknown) =>
  handler(new Request("http://localhost/api/color-schemes", { method, body: JSON.stringify(body) }));

test("create/update/delete are synchronous and persist normalized ordered entries", () => {
  const kept = testId("scheme-command-kept");
  const result = createScheme(
    input([
      { ...start, id: "legacy-id" },
      { ...step, id: kept },
      paint,
      {
        type: "IMAGE",
        id: kept,
        imageUrl: "https://EXAMPLE.com",
        thumbnailUrl: null,
        imageType: `  ${"x".repeat(TEXT_LIMITS.imageLabel + 10)} `,
        method: "  Brush  ",
      },
      complete,
    ]),
  );
  assert.ok(isUserId(result.id));
  assert.equal("then" in result, false);
  const row = db.select().from(colorSchemes).where(eq(colorSchemes.id, result.id)).get()!;
  assert.equal(row.name, "Blue");
  assert.equal(row.category, "BLUE");
  const dividers = db
    .select()
    .from(colorSchemeDividers)
    .where(eq(colorSchemeDividers.schemeId, result.id))
    .all();
  assert.equal(dividers.length, 3);
  assert.ok(dividers.every((entry) => isUuid(entry.id)));
  assert.equal(dividers.find((entry) => entry.tone === "SECTION")!.id, kept);
  const image = db.select().from(colorSchemeImages).where(eq(colorSchemeImages.schemeId, result.id)).get()!;
  assert.ok(isUuid(image.id));
  assert.notEqual(image.id, kept);
  assert.equal(image.sortOrder, 3);
  assert.equal(image.imageUrl, "https://example.com/");
  assert.equal(image.thumbnailUrl, null);
  assert.equal(image.imageType?.length, TEXT_LIMITS.imageLabel);
  assert.equal(image.method, "Brush");
  assert.equal(
    updateScheme(result.id, { ...input([start, step, paint, paint, complete]), name: "New" }),
    undefined,
  );
  assert.equal(
    db.select().from(colorSchemeImages).where(eq(colorSchemeImages.schemeId, result.id)).all().length,
    0,
  );
  assert.deepEqual(
    db
      .select()
      .from(colorSchemePaints)
      .where(eq(colorSchemePaints.schemeId, result.id))
      .all()
      .map((entry) => entry.sortOrder),
    [2, 3],
  );
  assert.equal(deleteScheme(result.id), undefined);
  assert.equal(db.select().from(colorSchemes).where(eq(colorSchemes.id, result.id)).get(), undefined);
});

test("validations retain their REST messages and leave existing rows untouched", () => {
  const cases: [SchemeInput, string][] = [
    [{ ...input(), name: null }, "Give the color scheme a name"],
    [{ ...input(), name: "x".repeat(TEXT_LIMITS.name + 1) }, "Scheme name must be 200 characters or fewer"],
    [{ ...input(), category: null }, "Choose a color category"],
    [input([null]), "Invalid color scheme entry"],
    [input([{ type: "UNKNOWN" }]), "Invalid color scheme entry"],
    [input([paint]), "Place every paint beneath a step"],
    [input([step, complete, paint]), "Place every paint beneath a step"],
    [input([step]), "Add at least one paint"],
    [input([{ ...step, label: "" }, paint]), "Give each divider a label and style"],
    [input([{ ...step, tone: "OTHER" }, paint]), "Give each divider a label and style"],
    [
      input([{ ...step, label: "x".repeat(TEXT_LIMITS.dividerLabel + 1) }, paint]),
      "Give each divider a label and style",
    ],
    [input([{ ...step, role: "OTHER" }, paint]), "Invalid milestone role"],
    [input([{ ...step, label: "CUSTOM" }, paint]), "Choose a listed step or milestone label"],
    [input([step, { ...paint, paintId: testUserId("missing") }]), "One or more paints are unavailable"],
    [{ ...input(), entries: null, paintIds: [PAINT] }, "Place every paint beneath a step"],
    [{ ...input(), entries: null, paintIds: null }, "Add at least one paint"],
  ];
  const id = createScheme(input()).id;
  const before = db.select().from(colorSchemeDividers).where(eq(colorSchemeDividers.schemeId, id)).all();
  for (const [body, message] of cases) {
    fails(() => createScheme(body), message);
    fails(() => updateScheme(id, body), message);
  }
  assert.deepEqual(
    db.select().from(colorSchemeDividers).where(eq(colorSchemeDividers.schemeId, id)).all(),
    before,
  );
  deleteScheme(id);
});

test("images require HTTPS, bounded URLs and valid thumbnails", () => {
  for (const imageUrl of [
    "http://example.com/a",
    "file:///a",
    "javascript:alert(1)",
    "bad",
    "https://example.com/" + "x".repeat(TEXT_LIMITS.url),
  ])
    fails(
      () => createScheme(input([step, paint, { type: "IMAGE", imageUrl }])),
      "Use a valid HTTPS image URL",
    );
  fails(
    () =>
      createScheme(
        input([
          step,
          paint,
          { type: "IMAGE", imageUrl: "https://example.com", thumbnailUrl: "http://example.com" },
        ]),
      ),
    "Use a valid HTTPS image URL",
  );
});

test("required milestone roles and fixed labels are retained on update", () => {
  const id = createScheme(input([start, step, paint, complete])).id;
  for (const entries of [
    [start, step, paint],
    [step, paint, complete],
    [start, start, step, paint, complete],
    [{ ...start, label: "GET BATTLE READY!" }, step, paint, complete],
    [{ ...step, role: "START" }, paint, complete],
  ])
    fails(() => updateScheme(id, input(entries)), "Required milestones must be kept");
  // Roles are preserved, not entry IDs; old schemes without roles need not add them.
  updateScheme(id, input([start, step, paint, complete]));
  deleteScheme(id);
  const oldId = createScheme(input()).id;
  updateScheme(oldId, input());
  deleteScheme(oldId);
});

test("unchanged legacy divider labels survive only for the same ID and tone", () => {
  const id = createScheme(input()).id;
  const divider = db.select().from(colorSchemeDividers).where(eq(colorSchemeDividers.schemeId, id)).get()!;
  db.update(colorSchemeDividers)
    .set({ label: "Old custom step" })
    .where(eq(colorSchemeDividers.schemeId, id))
    .run();
  const legacy = { ...step, id: divider.id, label: " old CUSTOM step " };
  updateScheme(id, input([legacy, paint]));
  assert.equal(
    db.select().from(colorSchemeDividers).where(eq(colorSchemeDividers.schemeId, id)).get()!.label,
    "Old custom step",
  );
  for (const invalid of [
    { ...legacy, id: testId("other") },
    { ...legacy, tone: "MILESTONE" },
    { ...legacy, label: "Changed" },
  ])
    fails(() => updateScheme(id, input([invalid, paint])), "Choose a listed step or milestone label");
  fails(() => createScheme(input([legacy, paint])), "Choose a listed step or milestone label");
  deleteScheme(id);
});

test("missing and catalog source schemes retain distinct status and error messages", () => {
  const catalogId = testId("scheme-command-catalog");
  db.insert(colorSchemes).values({ id: catalogId, name: "Catalog", createdAt: 1 }).run();
  for (const operation of [() => updateScheme("", input()), () => deleteScheme("")])
    fails(operation, "Color scheme is required");
  for (const operation of [
    () => updateScheme(testUserId("missing"), input()),
    () => deleteScheme(testUserId("missing")),
  ])
    fails(operation, "Color scheme not found", 404);
  fails(() => updateScheme(catalogId, {}), "Catalog source schemes are read-only", 403);
  fails(() => deleteScheme(catalogId), "Catalog source schemes cannot be deleted here", 403);
  db.delete(colorSchemes).where(eq(colorSchemes.id, catalogId)).run();
});

test("outer transactions see commands immediately and roll back all writes and change-log rows", () => {
  const sqlite = getSqlite();
  const existing = createScheme(input()).id;
  const original = db
    .select()
    .from(colorSchemeDividers)
    .where(eq(colorSchemeDividers.schemeId, existing))
    .all();
  const changes = sqlite.prepare("SELECT count(*) AS count FROM vault_changes").get();
  let created = "";
  const abort = new Error("abort outer GraphQL transaction");
  assert.throws(
    () =>
      sqlite.transaction(() => {
        created = createScheme(input()).id;
        assert.ok(db.select().from(colorSchemes).where(eq(colorSchemes.id, created)).get());
        updateScheme(existing, { ...input(), name: "Inside transaction" });
        assert.equal(
          db.select().from(colorSchemes).where(eq(colorSchemes.id, existing)).get()!.name,
          "Inside transaction",
        );
        deleteScheme(existing);
        assert.equal(db.select().from(colorSchemes).where(eq(colorSchemes.id, existing)).get(), undefined);
        throw abort;
      })(),
    (error: unknown) => error === abort,
  );
  assert.equal(db.select().from(colorSchemes).where(eq(colorSchemes.id, created)).get(), undefined);
  assert.equal(db.select().from(colorSchemes).where(eq(colorSchemes.id, existing)).get()!.name, "Blue");
  assert.deepEqual(
    db.select().from(colorSchemeDividers).where(eq(colorSchemeDividers.schemeId, existing)).all(),
    original,
  );
  assert.deepEqual(sqlite.prepare("SELECT count(*) AS count FROM vault_changes").get(), changes);
  // A Drizzle transaction can also enclose the command savepoint.
  db.transaction(() => {
    const id = createScheme(input()).id;
    deleteScheme(id);
  });
  deleteScheme(existing);
});

test("delete cascades through entries and miniature attachments without deleting the miniature", () => {
  const id = createScheme(input([step, paint, { type: "IMAGE", imageUrl: "https://example.com/a" }])).id;
  const miniatureId = testId("scheme-command-miniature");
  db.insert(miniatures).values({ id: miniatureId, title: "Miniature", status: "OWNED", createdAt: 1 }).run();
  db.insert(miniatureColorSchemes).values({ miniatureId, schemeId: id }).run();
  deleteScheme(id);
  for (const table of [colorSchemePaints, colorSchemeDividers, colorSchemeImages, miniatureColorSchemes])
    assert.equal(db.select().from(table).where(eq(table.schemeId, id)).all().length, 0);
  assert.ok(db.select().from(miniatures).where(eq(miniatures.id, miniatureId)).get());
  db.delete(miniatures).where(eq(miniatures.id, miniatureId)).run();
});

test("REST adapters preserve success and command-error JSON/status", async () => {
  const response = await call(POST, "POST", input());
  assert.equal(response.status, 201);
  const { id } = (await response.json()) as { id: string };
  const updated = await call(PUT, "PUT", { ...input(), id });
  assert.equal(updated.status, 200);
  assert.deepEqual(await updated.json(), { ok: true });
  const removed = await DELETE(
    new Request(`http://localhost/api/color-schemes?id=${id}`, { method: "DELETE" }),
  );
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), { ok: true });
  for (const [handler, method, body, status, error] of [
    [POST, "POST", {}, 400, "Give the color scheme a name"],
    [PUT, "PUT", input(), 400, "Color scheme is required"],
    [PUT, "PUT", { ...input(), id }, 404, "Color scheme not found"],
  ] as const) {
    const failed = await call(handler, method, body);
    assert.equal(failed.status, status);
    assert.deepEqual(await failed.json(), { error });
  }
});
