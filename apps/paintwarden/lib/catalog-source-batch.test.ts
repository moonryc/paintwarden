import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-batch-"));
process.env.DATA_DIR = directory;
const { addCatalogSource, checkCatalogSource, checkCatalogSources, listCatalogSources } =
  await import("./catalog-sources.ts");
const { getSqlite } = await import("../db/index.ts");
const { testId } = await import("./test-ids.ts");
const originalFetch = globalThis.fetch;
let version = "1.0.0";
let broken = false;
let offline = false;
globalThis.fetch = async (input) => {
  if (offline) throw new Error("Offline test");
  const url = new URL(input instanceof Request ? input.url : String(input));
  const repository =
    url.hostname === "api.github.com" ? url.pathname.split("/")[3] : url.pathname.split("/")[2];
  if (url.pathname.endsWith(`/repos/batch/${repository}`)) return Response.json({ default_branch: "main" });
  if (url.pathname.endsWith("/commits/main")) return Response.json({ sha: "a".repeat(40) });
  if (url.pathname.endsWith("/contents/source.json"))
    return Response.json({
      encoding: "base64",
      content: Buffer.from(
        JSON.stringify({
          formatVersion: 1,
          name: repository,
          version,
          dependencies: [],
          catalog: "catalog.json",
          assets: "assets.json",
        }),
      ).toString("base64"),
    });
  if (url.pathname.endsWith("/catalog.json"))
    return Response.json({
      paints: [
        {
          id: testId(`batch-${repository}`),
          brand: "Synthetic",
          range: "Tests",
          name: `${repository} ${version}`,
        },
      ],
      schemes:
        broken && repository === "second"
          ? [
              {
                id: testId("broken-scheme"),
                name: "Missing reference",
                category: "BLUE",
                entries: [
                  { id: testId("step"), type: "STEP", label: "BASECOAT" },
                  { id: testId("paint"), type: "PAINT", paintId: testId("missing") },
                ],
              },
            ]
          : [],
      templates: [],
    });
  if (url.pathname.endsWith("/assets.json")) return Response.json({});
  return new Response(null, { status: 404 });
};

function rows() {
  return JSON.stringify({
    sources: getSqlite().prepare("SELECT * FROM catalog_sources ORDER BY id").all(),
    paints: getSqlite().prepare("SELECT * FROM paint_catalog ORDER BY id").all(),
  });
}

test.after(() => {
  globalThis.fetch = originalFetch;
  getSqlite().close();
  rmSync(directory, { recursive: true, force: true });
  rmSync(path.join(directory, ".plugin-staging"), { recursive: true, force: true });
});

void test("job-context Update all is atomic across independent sources and failures propagate without lastError writes", async () => {
  await addCatalogSource("batch/first");
  await addCatalogSource("batch/second");
  const before = rows();
  version = "1.1.0";
  broken = true;
  await assert.rejects(checkCatalogSources({ progress() {} }), /needs missing paint/);
  assert.equal(rows(), before);
  broken = false;
  const controller = new AbortController();
  await assert.rejects(
    checkCatalogSources({
      signal: controller.signal,
      progress(stage) {
        if (stage === "committing") controller.abort(new Error("Cancel both"));
      },
    }),
    /Cancel both/,
  );
  assert.equal(rows(), before);
  const result = await checkCatalogSources({ progress() {} });
  assert.equal(result.length, 2);
  assert.ok(result.every((source) => source.version === "1.1.0" && source.updated));
  assert.ok(listCatalogSources().every((source) => source.version === "1.1.0"));
  const updated = rows();
  offline = true;
  await assert.rejects(checkCatalogSource(result[0].id, { progress() {} }), /Offline test/);
  assert.equal(rows(), updated);
});
