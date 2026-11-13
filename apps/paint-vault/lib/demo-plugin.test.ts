import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { zipSync, type Zippable } from "fflate";

// Keeps examples/demo-plugin, the sample linked from docs/plugins.md, valid and installable.

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-demo-plugin-"));
process.env.DATA_DIR = directory;
const { addUploadedCatalogSource, listCatalogSources } = await import("./catalog-sources.ts");
const { parseAssets, parseCatalog, parseManifest, imagePaths } = await import("./source-format.ts");
const { getDb } = await import("../db/index.ts");
const { paintCatalog } = await import("../db/schema.ts");

const root = path.resolve(import.meta.dirname, "../../../examples/demo-plugin");
const readJson = (file: string): unknown => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const imageFiles = readdirSync(path.join(root, "images")).map((name) => `images/${name}`);

test.after(() => rmSync(directory, { recursive: true, force: true }));

test("the demo plugin follows the source format, and its images match assets.json", () => {
  const manifest = parseManifest(readJson("source.json"));
  assert.deepEqual(manifest.dependencies, []);
  const catalog = parseCatalog(readJson("catalog.json"));
  const needed = imagePaths(catalog);
  const assets = parseAssets(readJson("assets.json"), needed);
  // Every image is used, listed and present, so the folder has nothing to tidy up.
  assert.deepEqual(Object.keys(assets).sort(), [...needed].sort());
  assert.deepEqual(imageFiles.sort(), [...needed].sort());
  for (const [file, asset] of Object.entries(assets))
    assert.equal(
      createHash("sha256")
        .update(readFileSync(path.join(root, file)))
        .digest("hex"),
      asset.sha256,
      `${file} doesn't match its sha256 in assets.json`,
    );
});

test("the demo plugin installs from a .zip", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("No network in this test");
  };
  try {
    const files: Zippable = {};
    for (const file of ["source.json", "catalog.json", "assets.json", "logo.svg", ...imageFiles])
      files[file] = new Uint8Array(readFileSync(path.join(root, file)));
    const result = await addUploadedCatalogSource(zipSync({ "demo-plugin": files }));
    assert.equal(result.name, "Paint Vault demo plugin");
    assert.equal(result.updated, true);
    const [source] = listCatalogSources();
    assert.deepEqual(source.counts, { paints: 8, schemes: 2, templates: 1 });
    assert.equal(source.license, "CC0-1.0");
    assert.ok(source.logoUrl, "the demo plugin's logo.svg is accepted");
    const paints = getDb().select().from(paintCatalog).all();
    assert.equal(paints.find((paint) => paint.name === "Old Bone")?.discontinued, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
