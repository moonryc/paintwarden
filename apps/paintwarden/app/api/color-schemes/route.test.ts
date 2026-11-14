import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { isUuid } from "@paintwarden/core/vault-ids";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-schemes-"));
process.env.DATA_DIR = directory;
const { POST, PUT } = await import("./route");
const requirements = await import("../requirements/route");
const { getDb, getSqlite } = await import("../../../db");
const { colorSchemeDividers, colorSchemeImages, miniatureRequiredPaints, miniatures, paintCatalog } =
  await import("../../../db/schema");
const { testId, testUserId } = await import("../../../lib/test-ids");

const call = (handler: (request: Request) => Promise<Response>, method: string, body: unknown) =>
  handler(new Request("http://localhost/api", { method, body: JSON.stringify(body) }));
const PAINT = testUserId("paint");
const start = { type: "DIVIDER", label: "GET READY!", tone: "MILESTONE", role: "START" };
const complete = { type: "DIVIDER", label: "YOU'RE READY!", tone: "MILESTONE", role: "COMPLETE" };
const step = { type: "DIVIDER", label: "BASECOAT", tone: "SECTION" };
const paint = { type: "PAINT", paintId: PAINT };

test("scheme entries and recipe rows always get UUIDs", async (t) => {
  const db = getDb();
  try {
    db.insert(paintCatalog).values({ id: PAINT, brand: "Mine", range: "Base", name: "Blue" }).run();

    let schemeId = "";
    await t.test("IDs that aren't UUIDs are replaced; UUIDs are kept", async () => {
      const kept = testId("kept step");
      const response = await call(POST, "POST", {
        name: "Blue",
        category: "BLUE",
        entries: [
          { ...start, id: "required-battle-milestone:start:old" },
          { ...step, id: kept },
          paint,
          { type: "IMAGE", id: "image-1", imageUrl: "https://example.com/a.png" },
          { ...complete, id: kept },
        ],
      });
      assert.equal(response.status, 201);
      schemeId = ((await response.json()) as { id: string }).id;
      const dividers = db.select().from(colorSchemeDividers).all();
      assert.equal(dividers.length, 3);
      assert.ok(dividers.every((row) => isUuid(row.id)));
      assert.equal(dividers.find((row) => row.tone === "SECTION")!.id, kept);
      assert.deepEqual(dividers.map((row) => row.role).sort(), ["COMPLETE", "START", null].sort());
      assert.ok(isUuid(db.select().from(colorSchemeImages).get()!.id));
    });

    await t.test("required milestones are kept by role and keep their fixed labels", async () => {
      const update = (entries: unknown[]) =>
        call(PUT, "PUT", { id: schemeId, name: "Blue", category: "BLUE", entries });
      assert.equal((await update([start, step, paint])).status, 400);
      assert.equal(
        (await update([{ ...start, label: "GET BATTLE READY!" }, step, paint, complete])).status,
        400,
      );
      assert.equal((await update([start, start, step, paint, complete])).status, 400);
      assert.equal((await update([{ ...step, role: "START" }, paint, complete])).status, 400);
      assert.equal((await update([start, step, paint, complete])).status, 200);
    });

    await t.test("recipe rows keep a UUID ID and replace anything else", async () => {
      const miniatureId = testId("mini");
      db.insert(miniatures).values({ id: miniatureId, title: "Mini", status: "OWNED", createdAt: 1 }).run();
      const kept = testId("row");
      const response = await call(requirements.PUT, "PUT", {
        miniatureId,
        entries: [
          { id: kept, paintId: PAINT, step: "BASECOAT" },
          { id: "row-2", paintId: PAINT, step: "GLAZE" },
        ],
      });
      assert.equal(response.status, 200);
      const ids = db
        .select()
        .from(miniatureRequiredPaints)
        .all()
        .map((row) => row.id);
      assert.ok(ids.includes(kept));
      assert.ok(ids.every((id) => isUuid(id)));
    });

    await t.test("text longer than its limit is refused, naming the field", async () => {
      const long = (count: number) => "x".repeat(count);
      const scheme = await call(POST, "POST", { name: long(201), category: "BLUE", entries: [step, paint] });
      assert.equal(scheme.status, 400);
      assert.match(
        ((await scheme.json()) as { error: string }).error,
        /Scheme name must be 200 characters or fewer/,
      );
      const recipe = await call(requirements.PUT, "PUT", {
        miniatureId: testId("mini"),
        entries: [{ paintId: PAINT, step: "BASECOAT", notes: long(2001) }],
      });
      assert.equal(recipe.status, 400);
      assert.match(((await recipe.json()) as { error: string }).error, /Notes must be 2,000 characters/);
    });
  } finally {
    getSqlite().close();
    rmSync(directory, { recursive: true, force: true });
  }
});
