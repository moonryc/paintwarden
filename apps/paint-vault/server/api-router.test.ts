import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { strFromU8, unzipSync } from "fflate";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-nest-api-"));
process.env.DATA_DIR = directory;
process.env.HOST = "127.0.0.1";
const { routeApi } = await import("./api-router");
const { APP_VERSION } = await import("../lib/app-version");
const base = "http://127.0.0.1:3000";
const request = (url: string, method = "GET", body?: object, headers?: HeadersInit) =>
  routeApi(
    new Request(base + url, {
      method,
      headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );

// Reads backup.json from an exported backup zip.
const readBackup = async (cookie: string) => {
  const response = await request("/api/backup", "GET", undefined, { cookie });
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    bytes,
    manifest: JSON.parse(strFromU8(unzipSync(bytes)["backup.json"])) as {
      images: string[];
      tables: Record<string, Record<string, unknown>[]>;
    },
  };
};
const restoreBackup = (bytes: Uint8Array, mode: string, cookie: string) =>
  routeApi(
    new Request(`${base}/api/backup?mode=${mode}`, {
      method: "POST",
      headers: { cookie, "content-type": "application/zip" },
      body: new Uint8Array(bytes),
    }),
  );

test("setup, authentication and data routes retain their API contract", async (t) => {
  try {
    // The version is public, so the desktop app can check it before signing in.
    const version = await request("/api/version");
    assert.equal(version.status, 200);
    assert.deepEqual(await version.json(), { name: "paint-vault", version: APP_VERSION });
    const before = await request("/api/auth/status");
    assert.equal((await before.json()).setupRequired, true);
    assert.equal((await request("/api/state")).status, 428);

    const setup = await request("/api/auth/setup", "POST", {
      username: "owner",
      password: "a secure password",
    });
    assert.equal(setup.status, 200);
    assert.match(setup.headers.get("set-cookie") ?? "", /pv_session=/);
    const cookie = setup.headers.get("set-cookie")!.split(";")[0];
    const state = await request("/api/state", "GET", undefined, { cookie });
    assert.equal(state.status, 200);
    const payload = await state.json();
    assert.ok(Array.isArray(payload.miniatures));
    assert.ok(Array.isArray(payload.catalog));

    await t.test("fresh vault has no bundled catalog", async () => {
      const templates = await (
        await request("/api/miniature-templates", "GET", undefined, { cookie })
      ).json();
      assert.deepEqual(templates.templates, []);
      const state = await (await request("/api/state", "GET", undefined, { cookie })).json();
      assert.deepEqual(state.catalog, []);
      assert.deepEqual(state.colorSchemes, []);
    });
    const imported = await request(
      "/api/catalog",
      "POST",
      { paints: [{ id: "test-paint", brand: "Test Brand", range: "Base", name: "Sample Blue" }] },
      { cookie },
    );
    assert.equal(imported.status, 201);
    const testPaintId = (await (await request("/api/state", "GET", undefined, { cookie })).json()).catalog[0]
      .id as string;
    assert.match(testPaintId, /^user:/);
    const createdScheme = await request(
      "/api/color-schemes",
      "POST",
      {
        name: "Sample scheme",
        category: "BLUE",
        entries: [
          { type: "DIVIDER", id: "sample-step", label: "BASECOAT", tone: "SECTION" },
          { type: "PAINT", paintId: testPaintId },
        ],
      },
      { cookie },
    );
    assert.equal(createdScheme.status, 201);
    // Entry IDs only need to be unique within their scheme.
    const sameEntryIds = await request(
      "/api/color-schemes",
      "POST",
      {
        name: "Second scheme",
        category: "RED",
        entries: [
          { type: "DIVIDER", id: "sample-step", label: "BASECOAT", tone: "SECTION" },
          { type: "PAINT", paintId: testPaintId },
        ],
      },
      { cookie },
    );
    assert.equal(sameEntryIds.status, 201);
    await request(
      "/api/color-schemes?id=" + encodeURIComponent(((await sameEntryIds.json()) as { id: string }).id),
      "DELETE",
      undefined,
      {
        cookie,
      },
    );

    const created = await request("/api/miniatures", "POST", { title: "Test miniature" }, { cookie });
    assert.equal(created.status, 201);
    const createdMiniature = await created.json();
    assert.ok(createdMiniature.id);
    await t.test("template summaries omit recipes and recipe reads are ordered and scoped", async () => {
      const current = await (await request("/api/state", "GET", undefined, { cookie })).json();
      const schemeId = current.colorSchemes[0].id as string;
      const paintId = current.catalog[0].id as string;
      const secondScheme = await request(
        "/api/color-schemes",
        "POST",
        {
          name: "Template ordering scheme",
          category: "BLUE",
          entries: [
            { type: "DIVIDER", id: "template-order-step", label: "BASECOAT", tone: "SECTION" },
            { type: "PAINT", paintId },
          ],
        },
        { cookie },
      );
      assert.equal(secondScheme.status, 201);
      const secondSchemeId = (await secondScheme.json()).id as string;
      const paints = [
        { paintId, step: "LAYER", notes: "First coat", sortOrder: 0 },
        { paintId, step: "HIGHLIGHT", notes: "Edges", sortOrder: 1 },
      ];
      const populated = await request(
        "/api/miniature-templates",
        "POST",
        {
          name: "Ordered recipe",
          schemeIds: [secondSchemeId, schemeId],
          paints: [...paints].reverse(),
        },
        { cookie },
      );
      assert.equal(populated.status, 201);
      const populatedId = (await populated.json()).id as string;
      const empty = await request("/api/miniature-templates", "POST", { name: "Empty recipe" }, { cookie });
      assert.equal(empty.status, 201);
      const emptyId = (await empty.json()).id as string;
      const listing = (await (
        await request("/api/miniature-templates", "GET", undefined, { cookie })
      ).json()) as {
        templates: { id: string; schemeCount: number; paintCount: number }[];
      };
      for (const summary of listing.templates) {
        assert.equal(Object.hasOwn(summary, "schemeIds"), false);
        assert.equal(Object.hasOwn(summary, "paints"), false);
        assert.equal(summary.schemeCount, summary.id === populatedId ? 2 : 0);
        assert.equal(summary.paintCount, summary.id === populatedId ? 2 : 0);
      }
      const recipePath = `/api/miniature-templates/${encodeURIComponent(populatedId)}/recipe`;
      const recipe = await request(recipePath, "GET", undefined, { cookie });
      assert.equal(recipe.status, 200);
      assert.deepEqual(await recipe.json(), { schemeIds: [secondSchemeId, schemeId], paints });
      assert.deepEqual(
        await (
          await request(`/api/miniature-templates/${emptyId}/recipe`, "GET", undefined, { cookie })
        ).json(),
        {
          schemeIds: [],
          paints: [],
        },
      );
      const missing = await request("/api/miniature-templates/source%3Amissing/recipe", "GET", undefined, {
        cookie,
      });
      assert.equal(missing.status, 404);
      assert.deepEqual(await missing.json(), { error: "Template not found" });
      assert.equal((await request(recipePath, "POST", {}, { cookie })).status, 405);
      for (const id of [populatedId, emptyId])
        assert.equal((await request("/api/miniature-templates", "DELETE", { id }, { cookie })).status, 200);
      await request(`/api/color-schemes?id=${encodeURIComponent(secondSchemeId)}`, "DELETE", undefined, {
        cookie,
      });
    });
    await t.test("user miniature templates are editable, reusable, protected, and backed up", async () => {
      const current = await (await request("/api/state", "GET", undefined, { cookie })).json();
      const schemeId = current.colorSchemes[0].id as string;
      const paintId = current.catalog[0].id as string;
      const createdTemplate = await request(
        "/api/miniature-templates",
        "POST",
        {
          name: "My reusable model",
          manufacturer: "My studio",
          faction: "Test faction",
          schemeIds: [schemeId],
          paints: [{ paintId, step: "LAYER", notes: "Thin coats", sortOrder: 0 }],
        },
        { cookie },
      );
      assert.equal(createdTemplate.status, 201);
      const userTemplate = (await createdTemplate.json()) as { id: string };
      assert.match(userTemplate.id, /^user:/);
      const listed = await (await request("/api/miniature-templates", "GET", undefined, { cookie })).json();
      assert.equal(listed.templates.length, 1);
      assert.equal(listed.templates.find((item: { id: string }) => item.id === userTemplate.id).kind, "user");
      const added = await request("/api/miniatures", "POST", { templateId: userTemplate.id }, { cookie });
      assert.equal(added.status, 201);
      const miniature = await added.json();
      assert.equal(miniature.title, "My reusable model");
      const copied = await (await request("/api/state", "GET", undefined, { cookie })).json();
      assert.ok(
        copied.miniatureColorSchemes.some(
          (row: { miniatureId: string; schemeId: string }) =>
            row.miniatureId === miniature.id && row.schemeId === schemeId,
        ),
      );
      assert.ok(
        copied.requirements.some(
          (row: { miniatureId: string; paintId: string; step: string; notes: string }) =>
            row.miniatureId === miniature.id &&
            row.paintId === paintId &&
            row.step === "LAYER" &&
            row.notes === "Thin coats",
        ),
      );
      assert.equal(
        (await request("/api/miniature-templates", "PUT", { id: "source:unknown", name: "No" }, { cookie }))
          .status,
        403,
      );
      assert.equal(
        (
          await request(
            "/api/miniature-templates",
            "PUT",
            { id: userTemplate.id, name: "Renamed model" },
            { cookie },
          )
        ).status,
        200,
      );
      const snapshot = await request(
        "/api/miniature-templates",
        "POST",
        { sourceMiniatureId: miniature.id },
        { cookie },
      );
      assert.equal(snapshot.status, 201);
      const localSource = await request("/api/miniatures", "POST", { title: "Photo source" }, { cookie });
      const localMiniature = (await localSource.json()) as { id: string };
      const form = new FormData();
      form.set("image", new File([new Uint8Array([137, 80, 78, 71])], "test.png", { type: "image/png" }));
      assert.equal(
        (
          await routeApi(
            new Request(`${base}/api/miniatures/${localMiniature.id}/image`, {
              method: "POST",
              headers: { cookie },
              body: form,
            }),
          )
        ).status,
        200,
      );
      const photoTemplateResponse = await request(
        "/api/miniature-templates",
        "POST",
        {
          sourceMiniatureId: localMiniature.id,
        },
        { cookie },
      );
      assert.equal(photoTemplateResponse.status, 201);
      const photoTemplate = (await photoTemplateResponse.json()) as { id: string };
      assert.equal(
        (await request(`/api/miniature-templates/${photoTemplate.id}/image`, "GET", undefined, { cookie }))
          .status,
        200,
      );
      assert.equal(
        (await request(`/api/miniatures/${localMiniature.id}`, "DELETE", undefined, { cookie })).status,
        200,
      );
      const photoClone = await request(
        "/api/miniatures",
        "POST",
        { templateId: photoTemplate.id },
        { cookie },
      );
      const photoCloneId = ((await photoClone.json()) as { id: string }).id;
      assert.equal(
        (await request(`/api/miniatures/${photoCloneId}/image`, "GET", undefined, { cookie })).status,
        200,
      );
      const backup = await readBackup(cookie);
      assert.ok(backup.manifest.tables.templates.some((row) => row.id === userTemplate.id));
      const templateImage = backup.manifest.tables.templates.find(
        (row) => row.id === photoTemplate.id,
      )!.imageKey;
      assert.ok(backup.manifest.images.includes(templateImage as string));
      assert.equal((await restoreBackup(backup.bytes, "merge", cookie)).status, 200);
      assert.equal((await restoreBackup(backup.bytes, "replace", cookie)).status, 200);
      // The owner stays signed in after replacing the vault.
      assert.equal((await request("/api/state", "GET", undefined, { cookie })).status, 200);
      const after = await (await request("/api/miniature-templates", "GET", undefined, { cookie })).json();
      assert.equal(after.templates.filter((item: { id: string }) => item.id === userTemplate.id).length, 1);
      assert.equal(
        (await request("/api/miniature-templates", "DELETE", { id: userTemplate.id }, { cookie })).status,
        200,
      );
      assert.equal(
        (await request("/api/miniature-templates", "DELETE", { id: "source:unknown" }, { cookie })).status,
        403,
      );
    });
    await t.test("empty recipe steps persist and appear in backups", async () => {
      const miniatureId = createdMiniature.id as string;
      assert.equal(
        (await request("/api/recipe-steps", "PUT", { miniatureId, steps: ["PRIMER", "LAYER"] }, { cookie }))
          .status,
        200,
      );
      const state = await (await request("/api/state", "GET", undefined, { cookie })).json();
      assert.deepEqual(
        state.recipeSteps
          .filter((row: { miniatureId: string }) => row.miniatureId === miniatureId)
          .map((row: { step: string }) => row.step)
          .sort(),
        ["LAYER", "PRIMER"],
      );
      const { manifest } = await readBackup(cookie);
      assert.equal(manifest.tables.miniatureSteps.filter((row) => row.miniatureId === miniatureId).length, 2);
      assert.equal(
        (await request("/api/recipe-steps", "PUT", { miniatureId, steps: ["INVALID"] }, { cookie })).status,
        400,
      );
    });
    await t.test("scheme divider choices validate new labels and retain existing labels", async () => {
      const current = await (await request("/api/state", "GET", undefined, { cookie })).json();
      const paintId = current.catalog[0].id as string;
      const payload = (label: string, tone: "SECTION" | "MILESTONE") => ({
        name: "Validation scheme",
        category: "RED",
        entries: [
          { type: "DIVIDER", id: "test-divider", label, tone },
          { type: "PAINT", paintId },
        ],
      });
      assert.equal(
        (await request("/api/color-schemes", "POST", payload("FREEFORM", "SECTION"), { cookie })).status,
        400,
      );
      assert.equal(
        (await request("/api/color-schemes", "POST", payload("BASECOAT", "MILESTONE"), { cookie })).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/api/color-schemes",
            "POST",
            {
              name: "No step",
              category: "RED",
              entries: [{ type: "PAINT", paintId }],
            },
            { cookie },
          )
        ).status,
        400,
      );
      const created = await request("/api/color-schemes", "POST", payload("DRYBRUSH", "SECTION"), { cookie });
      assert.equal(created.status, 201);
      const { id } = (await created.json()) as { id: string };
      assert.equal(
        (await request("/api/color-schemes", "PUT", { ...payload("TECHNICAL", "SECTION"), id }, { cookie }))
          .status,
        200,
      );
      assert.equal(
        (await request("/api/color-schemes", "PUT", { ...payload("FREEFORM", "SECTION"), id }, { cookie }))
          .status,
        400,
      );
      assert.equal(
        (
          await request(
            "/api/color-schemes",
            "PUT",
            { ...payload("GET PARADE READY!", "MILESTONE"), id },
            { cookie },
          )
        ).status,
        400,
      );
    });
    await t.test("a body over its route's limit is refused", async () => {
      const response = await request("/api/auth/login", "POST", { username: "x".repeat(20_000) });
      assert.equal(response.status, 413);
      const declared = await routeApi(
        new Request(base + "/api/catalog-sources", {
          method: "POST",
          headers: { cookie, "content-type": "application/zip", "content-length": String(300 * 1024 * 1024) },
          body: new Uint8Array(1),
        }),
      );
      assert.equal(declared.status, 413);
      assert.deepEqual(await declared.json(), { error: "The plugin file must be under 250 MB" });
      // A JSON body only names a repository, so it doesn't get the upload limit.
      const json = await routeApi(
        new Request(base + "/api/catalog-sources", {
          method: "POST",
          headers: { cookie, "content-type": "application/json", "content-length": String(40 * 1024 * 1024) },
          body: "{}",
        }),
      );
      assert.equal(json.status, 413);
    });
    assert.equal((await request("/api/not-a-route", "GET", undefined, { cookie })).status, 404);
    assert.equal(
      (await request("/api/state", "GET", undefined, { origin: "https://outside.example", cookie })).status,
      403,
    );

    await t.test("catalog imports ignore incoming IDs and skip duplicate normalized names", async () => {
      const original = {
        id: "catalog-import-existing",
        brand: "Import tests",
        range: "Base",
        name: "Existing paint",
        colorHex: "#123456",
      };
      assert.equal((await request("/api/catalog", "POST", { paints: [original] }, { cookie })).status, 201);
      const response = await request(
        "/api/catalog",
        "POST",
        {
          paints: [
            { ...original, name: "A reused ID is a new paint", colorHex: "#ffffff" },
            {
              id: "catalog-import-name-duplicate",
              brand: " import   TESTS ",
              range: " base ",
              name: " Existing   Paint ",
            },
            { id: "catalog-import-new-a", brand: "Import tests", range: "Base", name: "Deep Blue" },
            { id: "catalog-import-new-a", brand: "Import tests", range: "Base", name: "Same incoming ID" },
            {
              id: "catalog-import-batch-name-duplicate",
              brand: "IMPORT TESTS",
              range: "BASE",
              name: "deep   blue",
            },
            { id: "catalog-import-new-b", brand: "Import tests", range: "Base", name: "Fresh Green" },
            { id: "catalog-import-invalid", brand: "Import tests", name: " " },
          ],
        },
        { cookie },
      );
      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), { imported: 4, skipped: 3 });
      const data = await (await request("/api/state", "GET", undefined, { cookie })).json();
      const paints = data.catalog.filter((paint: { brand: string }) => paint.brand === "Import tests") as {
        id: string;
        name: string;
        colorHex: string | null;
      }[];
      assert.deepEqual(paints.map((paint) => paint.name).sort(), [
        "A reused ID is a new paint",
        "Deep Blue",
        "Existing paint",
        "Fresh Green",
        "Same incoming ID",
      ]);
      assert.ok(paints.every((paint) => paint.id.startsWith("user:")));
      assert.equal(paints.find((paint) => paint.name === original.name)!.colorHex, original.colorHex);
    });

    await t.test(
      "an entirely duplicate catalog import succeeds without changing existing paints",
      async () => {
        const paint = {
          id: "catalog-duplicate-only",
          brand: "Duplicate tests",
          range: "Layer",
          name: "Warm Red",
        };
        assert.equal((await request("/api/catalog", "POST", { paints: [paint] }, { cookie })).status, 201);
        const before = (await (await request("/api/state", "GET", undefined, { cookie })).json()).catalog;
        const response = await request(
          "/api/catalog",
          "POST",
          {
            paints: [{ ...paint, id: "catalog-duplicate-only-name", name: "warm  red" }, paint],
          },
          { cookie },
        );
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { imported: 0, skipped: 2 });
        assert.deepEqual(
          (await (await request("/api/state", "GET", undefined, { cookie })).json()).catalog,
          before,
        );
      },
    );

    await t.test(
      "catalog imports still reject missing paints and rows without valid brand and name",
      async () => {
        for (const body of [
          {},
          { paints: [] },
          { paints: [{ brand: "Only brand" }] },
          { paints: [{ brand: " ", name: "Name" }] },
          { paints: [null, { brand: 42, name: "Name" }] },
        ]) {
          assert.equal((await request("/api/catalog", "POST", body, { cookie })).status, 400);
        }
        const response = await request(
          "/api/catalog",
          "POST",
          { paints: [{ name: "Missing brand" }] },
          { cookie },
        );
        assert.deepEqual(await response.json(), { error: "Each paint needs brand and name" });
      },
    );

    const paintNames = ["recipe-test-a", "recipe-test-b", "recipe-test-c"];
    assert.equal(
      (
        await request(
          "/api/catalog",
          "POST",
          { paints: paintNames.map((name) => ({ id: name, brand: "Recipe route tests", name })) },
          { cookie },
        )
      ).status,
      201,
    );
    const catalog = (await (await request("/api/state", "GET", undefined, { cookie })).json()).catalog as {
      id: string;
      name: string;
    }[];
    // Imported paints are the owner's own, so they get new `user:` IDs rather than the given ones.
    const paintIds = paintNames.map((name) => catalog.find((paint) => paint.name === name)!.id);
    assert.ok(paintIds.every((id) => id.startsWith("user:")));
    const createMiniature = async (title: string) => {
      const response = await request("/api/miniatures", "POST", { title }, { cookie });
      assert.equal(response.status, 201);
      return (await response.json()).id as string;
    };
    type Requirement = {
      id: string;
      miniatureId: string;
      paintId: string;
      notes: string;
      step: string;
      sortOrder: number;
    };
    const rowsFor = async (miniatureId: string) => {
      const response = await request("/api/state", "GET", undefined, { cookie });
      const data = (await response.json()) as { requirements: Requirement[] };
      return data.requirements
        .filter((row) => row.miniatureId === miniatureId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ id: _id, updatedAt: _updatedAt, ...row }: Requirement & { updatedAt?: number }) => row);
    };
    const idsFor = async (miniatureId: string) => {
      const response = await request("/api/state", "GET", undefined, { cookie });
      const data = (await response.json()) as { requirements: Requirement[] };
      return data.requirements
        .filter((row) => row.miniatureId === miniatureId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => row.id);
    };
    const putRecipe = (miniatureId: string, entries: Partial<Requirement>[]) =>
      request("/api/requirements", "PUT", { miniatureId, entries }, { cookie });

    await t.test("a recipe can use one paint in several steps, but once per step", async () => {
      const miniatureId = await createMiniature("Repeated paint test");
      const saved = await putRecipe(miniatureId, [
        { paintId: paintIds[0], step: "BASECOAT", notes: "", sortOrder: 0 },
        { paintId: paintIds[1], step: "SHADE", notes: "", sortOrder: 1 },
        { paintId: paintIds[0], step: "HIGHLIGHT", notes: "edges", sortOrder: 2 },
        { paintId: paintIds[0], step: "HIGHLIGHT", notes: "duplicate", sortOrder: 3 },
      ]);
      assert.equal(saved.status, 200);
      assert.deepEqual(await rowsFor(miniatureId), [
        { miniatureId, paintId: paintIds[0], notes: "", step: "BASECOAT", sortOrder: 0 },
        { miniatureId, paintId: paintIds[1], notes: "", step: "SHADE", sortOrder: 1 },
        { miniatureId, paintId: paintIds[0], notes: "edges", step: "HIGHLIGHT", sortOrder: 2 },
      ]);
      // Saving the recipe again with its row IDs keeps those IDs.
      const ids = await idsFor(miniatureId);
      const rows = await rowsFor(miniatureId);
      assert.equal(
        (
          await putRecipe(
            miniatureId,
            rows.map((row, index) => ({ ...row, id: ids[index] })),
          )
        ).status,
        200,
      );
      assert.deepEqual(await idsFor(miniatureId), ids);
      // A second row for a paint already in that step is refused.
      const repeated = await request(
        "/api/requirements",
        "POST",
        { miniatureId, paintId: paintIds[0], step: "BASECOAT" },
        { cookie },
      );
      assert.equal(repeated.status, 409);
      const moved = await request("/api/requirements", "PATCH", { id: ids[2], step: "BASECOAT" }, { cookie });
      assert.equal(moved.status, 409);
    });

    await t.test("rows are added, patched and removed by ID without touching siblings", async () => {
      const miniatureId = await createMiniature("Recipe patch test"),
        otherId = await createMiniature("Other recipe");
      assert.equal(
        (
          await putRecipe(miniatureId, [
            { paintId: paintIds[0], notes: "First", step: "BASECOAT", sortOrder: 5 },
            { paintId: paintIds[1], notes: "Second", step: "LAYER", sortOrder: 12 },
          ])
        ).status,
        200,
      );
      assert.equal(
        (
          await putRecipe(otherId, [
            { paintId: paintIds[0], notes: "Other miniature", step: "PRIMER", sortOrder: 31 },
          ])
        ).status,
        200,
      );
      const [first, second] = await idsFor(miniatureId);
      const updates = await Promise.all([
        request("/api/requirements", "PATCH", { id: first, notes: "  two thin coats\n  " }, { cookie }),
        request("/api/requirements", "PATCH", { id: second, notes: "1:2 mix " }, { cookie }),
        request("/api/requirements", "PATCH", { id: first, step: "HIGHLIGHT" }, { cookie }),
        request("/api/requirements", "PATCH", { id: second, step: "SHADE" }, { cookie }),
      ]);
      assert.deepEqual(
        updates.map((response) => response.status),
        [200, 200, 200, 200],
      );
      assert.deepEqual(await rowsFor(miniatureId), [
        { miniatureId, paintId: paintIds[0], notes: "  two thin coats\n  ", step: "HIGHLIGHT", sortOrder: 5 },
        { miniatureId, paintId: paintIds[1], notes: "1:2 mix ", step: "SHADE", sortOrder: 12 },
      ]);
      assert.deepEqual(await rowsFor(otherId), [
        {
          miniatureId: otherId,
          paintId: paintIds[0],
          notes: "Other miniature",
          step: "PRIMER",
          sortOrder: 31,
        },
      ]);

      const added = await request(
        "/api/requirements",
        "POST",
        { miniatureId, paintId: paintIds[2], step: "DETAIL" },
        { cookie },
      );
      assert.equal(added.status, 201);
      const { id: addedId } = (await added.json()) as { id: string };
      assert.deepEqual((await rowsFor(miniatureId))[2], {
        miniatureId,
        paintId: paintIds[2],
        notes: "",
        step: "DETAIL",
        sortOrder: 13,
      });
      assert.equal((await request("/api/requirements", "DELETE", { id: second }, { cookie })).status, 200);
      assert.equal((await request("/api/requirements", "DELETE", { id: second }, { cookie })).status, 404);
      assert.deepEqual(await idsFor(miniatureId), [first, addedId]);
    });

    await t.test("targeted requests reject invalid fields and report missing rows", async () => {
      const miniatureId = await createMiniature("Recipe validation test");
      const added = await request(
        "/api/requirements",
        "POST",
        { miniatureId, paintId: paintIds[0] },
        { cookie },
      );
      assert.equal(added.status, 201);
      const { id } = (await added.json()) as { id: string };
      const before = await rowsFor(miniatureId);
      for (const patch of [
        {},
        { notes: null },
        { notes: 3 },
        { step: null },
        { step: "not-a-step" },
        { step: "LAYER", sortOrder: 99 },
        { paintId: paintIds[1], notes: "x" },
      ])
        assert.equal((await request("/api/requirements", "PATCH", { id, ...patch }, { cookie })).status, 400);
      for (const body of [{ notes: "changed" }, { id: "", notes: "changed" }, { id: 42, notes: "changed" }])
        assert.equal((await request("/api/requirements", "PATCH", body, { cookie })).status, 400);
      assert.equal(
        (
          await routeApi(
            new Request(base + "/api/requirements", {
              method: "PATCH",
              headers: { cookie, "content-type": "application/json" },
              body: "{",
            }),
          )
        ).status,
        400,
      );
      assert.equal(
        (await request("/api/requirements", "PATCH", { id: "missing", notes: "x" }, { cookie })).status,
        404,
      );
      for (const body of [
        { miniatureId: "missing", paintId: paintIds[0] },
        { miniatureId, paintId: "missing" },
      ])
        assert.equal((await request("/api/requirements", "POST", body, { cookie })).status, 404);
      assert.equal(
        (
          await request(
            "/api/requirements",
            "POST",
            { miniatureId, paintId: paintIds[1], step: "nope" },
            { cookie },
          )
        ).status,
        400,
      );
      assert.equal(
        (await request("/api/requirements", "DELETE", { id, notes: "not permitted" }, { cookie })).status,
        400,
      );
      assert.deepEqual(await rowsFor(miniatureId), before);
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
