import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { strToU8, zipSync, type Zippable } from "fflate";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-upload-"));
process.env.DATA_DIR = directory;
const { addUploadedCatalogSource, checkCatalogSourceVersions, checkCatalogSources, listCatalogSources } =
  await import("./catalog-sources.ts");
const { readSourceZip, uploadedSourceId } = await import("./catalog-source-upload.ts");
const { getDb } = await import("../db/index.ts");
const { colorSchemeImages, paintCatalog } = await import("../db/schema.ts");
const { testId } = await import("./test-ids.ts");

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=",
  "base64",
);
const sha256 = createHash("sha256").update(image).digest("hex");
const logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>';

// A plugin laid out as Create plugin exports it, optionally inside one folder as GitHub zips it.
function pluginZip({ version = "1.0.0", name = "My Schemes", folder = "", paintName = "Blue" } = {}) {
  const files: Zippable = {
    "source.json": strToU8(
      JSON.stringify({
        formatVersion: 1,
        name,
        version,
        dependencies: [],
        catalog: "catalog.json",
        assets: "assets.json",
      }),
    ),
    "catalog.json": strToU8(
      JSON.stringify({
        paints: [
          { id: testId("mine/blue"), brand: "Mine", range: "Base", name: paintName, colorHex: "#3366cc" },
        ],
        schemes: [
          {
            id: testId("mine/blue-scheme"),
            name: "Blue scheme",
            category: "BLUE",
            entries: [
              { id: testId("step"), type: "STEP", label: "BASECOAT" },
              { id: testId("paint"), type: "PAINT", paintId: testId("mine/blue") },
              { id: testId("image"), type: "IMAGE", imageUrl: "images/blue.png" },
            ],
          },
        ],
        templates: [],
      }),
    ),
    "assets.json": strToU8(JSON.stringify({ "images/blue.png": { sha256 } })),
    "images/blue.png": new Uint8Array(image),
    "logo.svg": strToU8(logo),
  };
  const nested: Zippable = folder ? { [folder]: files } : files;
  return zipSync(nested);
}

test.after(() => rmSync(directory, { recursive: true, force: true }));

test("an uploaded plugin installs without GitHub and updates when a newer zip is uploaded", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("No network in this test");
  };
  try {
    const result = await addUploadedCatalogSource(pluginZip());
    const [source] = listCatalogSources();
    assert.deepEqual(result, {
      id: source.id,
      repository: "upload:my-schemes",
      name: "My Schemes",
      version: "1.0.0",
      updated: true,
    });
    assert.match(source.id, /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/);
    assert.equal(source.repository, "upload:my-schemes");
    assert.equal(source.url, "");
    assert.ok(source.logoUrl);
    assert.deepEqual(source.counts, { paints: 1, schemes: 1, templates: 0 });
    const db = getDb();
    assert.match(db.select().from(colorSchemeImages).get()!.imageUrl, /^\/api\/catalog-source-images\//);

    // Uploaded plugins have nothing to check online and never report an error for it.
    assert.deepEqual(await checkCatalogSourceVersions(), [{ id: source.id }]);
    assert.deepEqual(await checkCatalogSources(), [
      {
        id: source.id,
        repository: "upload:my-schemes",
        name: "My Schemes",
        version: "1.0.0",
        updated: false,
      },
    ]);

    await addUploadedCatalogSource(pluginZip({ version: "1.1.0", paintName: "Bluer", folder: "repo-main" }));
    assert.equal(listCatalogSources().length, 1);
    // The newer upload updates the same plugin, keeping its UUID.
    assert.equal(listCatalogSources()[0].id, source.id);
    assert.equal(listCatalogSources()[0].version, "1.1.0");
    assert.equal(db.select().from(paintCatalog).get()!.name, "Bluer");

    // The same version changes nothing, even when its contents differ.
    const same = await addUploadedCatalogSource(pluginZip({ version: "1.1.0", paintName: "Other" }));
    assert.equal(same.updated, false);
    assert.equal(db.select().from(paintCatalog).get()!.name, "Bluer");

    // An older version is refused, and a name differing only in case and punctuation is the same plugin.
    await assert.rejects(
      addUploadedCatalogSource(pluginZip({ version: "1.0.5", name: "my-schemes" })),
      /My Schemes 1\.1\.0 is installed, and this \.zip has the older version 1\.0\.5/,
    );
    assert.equal(listCatalogSources().length, 1);
    assert.equal(listCatalogSources()[0].version, "1.1.0");
    assert.equal(db.select().from(paintCatalog).get()!.name, "Bluer");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Create plugin refuses to depend on an uploaded plugin", async () => {
  const { POST } = await import("../app/api/catalog-share/route.ts");
  const { colorSchemePaints, colorSchemes } = await import("../db/schema.ts");
  const schemeId = `user:${testId("my-uploaded-blue-scheme")}`;
  const db = getDb();
  db.insert(colorSchemes).values({ id: schemeId, name: "My blue", createdAt: Date.now() }).run();
  db.insert(colorSchemePaints)
    .values({ schemeId, paintId: testId("mine/blue"), sortOrder: 0 })
    .run();
  const response = await POST(
    new Request("http://vault.test/api/catalog-share", {
      method: "POST",
      body: JSON.stringify({
        name: "Shared",
        version: "1.0.0",
        paintIds: [],
        schemeIds: [schemeId],
        templateIds: [],
      }),
    }),
  );
  assert.equal(response.status, 400);
  assert.match(
    ((await response.json()) as { error: string }).error,
    /Bluer comes from My Schemes, which was installed from a \.zip/,
  );
});

test("a zip without a valid plugin is refused with a clear message", async () => {
  await assert.rejects(readSourceZip(new Uint8Array([1, 2, 3])), /Choose a plugin \.zip file/);
  await assert.rejects(readSourceZip(zipSync({ "readme.md": strToU8("hi") })), /no source\.json/);
  await assert.rejects(
    readSourceZip(zipSync({ "source.json": strToU8("{") })),
    /source\.json isn't valid JSON/,
  );
});

test("a zip is checked against its limits before anything is unpacked", async () => {
  await assert.rejects(
    readSourceZip(pluginZip(), { maxEntries: 2, maxExpandedBytes: 1_000_000 }),
    /too many files/,
  );
  // Highly compressible data: tiny in the zip, large once unpacked.
  const bomb = zipSync({ "source.json": new Uint8Array(2_000_000) });
  assert.ok(bomb.byteLength < 50_000);
  await assert.rejects(
    readSourceZip(bomb, { maxEntries: 10, maxExpandedBytes: 1_000_000 }),
    /too large once unpacked/,
  );
  // A single file is refused by its declared size, whatever limit the reader asks for.
  const upload = await readSourceZip(pluginZip());
  await assert.rejects(upload.read("catalog.json", 10), /catalog\.json is too large/);
});

test("an entry whose header understates its size is refused", async () => {
  const zip = zipSync({ "source.json": new Uint8Array(100_000) });
  // Rewrite the central directory's uncompressed size to claim one byte.
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let offset = zip.byteLength - 22;
  offset = view.getUint32(offset + 16, true);
  view.setUint32(offset + 24, 1, true);
  await assert.rejects(readSourceZip(zip), /source\.json is damaged/);
});

test("a GitHub download is stopped as soon as it passes its limit", async () => {
  const { requestBytes } = await import("./github-source.ts");
  const originalFetch = globalThis.fetch;
  let pulled = 0;
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        pull(controller) {
          pulled += 1;
          controller.enqueue(new Uint8Array(1000));
        },
      }),
    );
  try {
    await assert.rejects(requestBytes("https://example.test/file", 2500), /too large/);
    assert.ok(pulled < 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uploaded plugin IDs come from the plugin's name", () => {
  assert.equal(uploadedSourceId("Grimdark Schemes!"), "upload:grimdark-schemes");
  assert.throws(() => uploadedSourceId("!!!"), /Give the plugin a name/);
});
