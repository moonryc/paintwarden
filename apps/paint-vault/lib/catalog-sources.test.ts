import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-sources-"));
process.env.DATA_DIR = directory;
const {
  addCatalogSource,
  checkCatalogSource,
  checkCatalogSourceVersions,
  checkCatalogSources,
  listCatalogSources,
  normalizeRepository,
  previewSourceRemoval,
  removeCatalogSource,
  sourceImage,
  sourceLogo,
  validLogoSvg,
  LOGO_MAX_BYTES,
} = await import("./catalog-sources.ts");
const { getDb } = await import("../db/index.ts");
const { testId } = await import("./test-ids.ts");

// Plugins are addressed by their UUID in the vault; tests find it by repository.
const sourceId = (repository: string) =>
  listCatalogSources().find((source) => source.repository === repository)!.id;
const {
  colorSchemeImages,
  colorSchemes,
  miniatureColorSchemes,
  miniatureTemplatePaints,
  miniatureTemplateSchemes,
  miniatureTemplates,
  miniatures,
  paintCatalog,
  paintInventory,
} = await import("../db/schema.ts");

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=",
  "base64",
);
const sha256 = createHash("sha256").update(image).digest("hex");
let version = "1.0.0";
let colorHex = "#3366cc";
let online = true;
let catalogRequests = 0;
let logo: string | null = null;
// The `example/shrinking` source drops every item in its second version.
let shrinkingVersion = "1.0.0";
const shrinkingCatalog = () =>
  shrinkingVersion === "1.0.0"
    ? {
        paints: [
          { id: testId("shrink/used"), brand: "Example", range: "Base", name: "Used" },
          { id: testId("shrink/unused"), brand: "Example", range: "Base", name: "Unused" },
          { id: testId("shrink/in-scheme"), brand: "Example", range: "Base", name: "In scheme" },
        ],
        schemes: [
          {
            id: testId("shrink/used-scheme"),
            name: "Used scheme",
            category: "BLUE",
            entries: [
              { id: testId("shrink step"), type: "STEP", label: "BASECOAT" },
              { id: testId("shrink paint"), type: "PAINT", paintId: testId("shrink/in-scheme") },
              { id: testId("shrink image"), type: "IMAGE", imageUrl: "images/blue.png" },
            ],
          },
          { id: testId("shrink/unused-scheme"), name: "Unused scheme", category: "BLUE", entries: [] },
        ],
        templates: [
          {
            id: testId("shrink/template"),
            name: "Template",
            manufacturer: "",
            faction: "",
            categories: [],
            imageUrl: null,
            schemeIds: [testId("shrink/used-scheme")],
            paints: [{ paintId: testId("shrink/used"), step: "BASECOAT", notes: "", sortOrder: 0 }],
          },
        ],
      }
    : { paints: [], schemes: [], templates: [] };
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input) => {
  if (!online) throw new Error("Offline");
  const url = input instanceof Request ? input.url : String(input);
  const pathname = new URL(url).pathname;
  if (url === "https://api.github.com/repos/example/paint-source")
    return Response.json({ default_branch: "main", private: false });
  if (url === "https://api.github.com/repos/example/dependent")
    return Response.json({ default_branch: "main", private: false });
  if (url === "https://api.github.com/repos/example/broken")
    return Response.json({ default_branch: "main", private: false });
  if (url === "https://api.github.com/repos/example/failing-dependency")
    return Response.json({ default_branch: "main", private: false });
  if (url === "https://api.github.com/repos/example/reserved")
    return Response.json({ default_branch: "main", private: false });
  if (url === "https://api.github.com/repos/example/shrinking")
    return Response.json({ default_branch: "main", private: false });
  if (pathname.endsWith("/commits/main")) return Response.json({ sha: "a".repeat(40) });
  if (pathname.endsWith("/contents/source.json")) {
    const dependent = pathname.includes("/example/dependent/");
    const broken = pathname.includes("/example/broken/");
    const failingDependency = pathname.includes("/example/failing-dependency/");
    const manifest = pathname.includes("/example/shrinking/")
      ? {
          formatVersion: 1,
          name: "Shrinking",
          version: shrinkingVersion,
          dependencies: [],
          catalog: "catalog.json",
          assets: "assets.json",
        }
      : failingDependency
        ? {
            formatVersion: 1,
            name: "Failing dependency chain",
            version: "1.0.0",
            dependencies: [
              { repository: "github:example/paint-source" },
              { repository: "github:example/unavailable" },
            ],
            catalog: "catalog.json",
            assets: "assets.json",
          }
        : dependent || broken
          ? {
              formatVersion: 1,
              name: broken ? "Broken templates" : "Dependent templates",
              version: "1.0.0",
              dependencies: [
                { repository: "github:example/paint-source", minimumVersion: broken ? "1.0.0" : "1.0.1" },
              ],
              catalog: "catalog.json",
              assets: "assets.json",
            }
          : {
              formatVersion: 1,
              name: "Test paints",
              version,
              license: "CC0-1.0",
              attribution: "Example Co.",
              dependencies: [],
              catalog: "catalog.json",
              assets: "assets.json",
            };
    return Response.json({
      encoding: "base64",
      content: Buffer.from(JSON.stringify(manifest)).toString("base64"),
    });
  }
  if (pathname.includes("/example/broken/")) {
    if (pathname.endsWith("/catalog.json"))
      return Response.json({
        paints: [],
        schemes: [],
        templates: [
          {
            id: testId("broken-template"),
            name: "Broken model",
            manufacturer: "Example",
            faction: "Examples",
            categories: ["Examples"],
            imageUrl: null,
            schemeIds: [testId("missing-scheme")],
            paints: [],
          },
        ],
      });
    if (pathname.endsWith("/assets.json")) return Response.json({});
  }
  if (pathname.includes("/example/shrinking/")) {
    if (pathname.endsWith("/catalog.json")) return Response.json(shrinkingCatalog());
    if (pathname.endsWith("/assets.json"))
      return Response.json(shrinkingVersion === "1.0.0" ? { "images/blue.png": { sha256 } } : {});
  }
  if (pathname.includes("/example/reserved/")) {
    if (pathname.endsWith("/catalog.json"))
      return Response.json({
        paints: [{ id: "user:taken", brand: "Example", range: "Base", name: "Reserved" }],
        schemes: [],
        templates: [],
      });
    if (pathname.endsWith("/assets.json")) return Response.json({});
  }
  if (pathname.includes("/example/dependent/")) {
    if (pathname.endsWith("/catalog.json"))
      return Response.json({
        paints: [],
        schemes: [],
        templates: [
          {
            id: testId("dependent-template"),
            name: "Dependent model",
            manufacturer: "Example",
            faction: "Examples",
            categories: ["Examples"],
            imageUrl: null,
            schemeIds: [testId("blue-scheme")],
            paints: [{ paintId: testId("shared-blue"), step: "BASING", notes: "", sortOrder: 0 }],
          },
        ],
      });
    if (pathname.endsWith("/assets.json")) return Response.json({});
  }
  if (pathname.endsWith("/catalog.json")) {
    catalogRequests++;
    return Response.json({
      paints: [
        {
          id: testId("shared-blue"),
          brand: "Example",
          range: "Base",
          name: "Blue",
          type: "BASE",
          colorHex,
        },
      ],
      schemes: [
        {
          id: testId("blue-scheme"),
          name: "Blue scheme",
          category: "BLUE",
          entries: [
            { id: testId("blue-step"), type: "STEP", label: "BASECOAT" },
            { id: testId("blue-stage"), type: "PAINT", paintId: testId("shared-blue") },
            { id: testId("blue-image"), type: "IMAGE", imageUrl: "images/blue.png" },
          ],
        },
      ],
      templates: [
        {
          id: testId("blue-template"),
          name: "Blue model",
          manufacturer: "Example",
          faction: "Examples",
          categories: ["Examples"],
          imageUrl: "images/blue.png",
          schemeIds: [testId("blue-scheme")],
          paints: [{ paintId: testId("shared-blue"), step: "BASING", notes: "", sortOrder: 0 }],
        },
      ],
    });
  }
  if (pathname === `/example/paint-source/${"a".repeat(40)}/logo.svg`)
    return logo === null
      ? new Response("Not found", { status: 404 })
      : new Response(logo, { headers: { "content-type": "image/svg+xml" } });
  if (pathname.endsWith("/assets.json"))
    return Response.json({ "images/blue.png": { sha256, originalUrl: "fixture:generated" } });
  if (pathname.endsWith("/images/blue.png"))
    return new Response(new Uint8Array(image), { headers: { "content-type": "image/png" } });
  return new Response("Not found", { status: 404 });
};

void test("simultaneous source checks share in-flight work, but later checks are fresh", async () => {
  const fixtureFetch = globalThis.fetch;
  try {
    await addCatalogSource("example/paint-source");
    await addCatalogSource("example/shrinking");
    const id = sourceId("example/paint-source");
    const otherId = sourceId("example/shrinking");
    const requests = new Map<string, number>();
    let release = () => {};
    let gate = Promise.resolve();
    let started = () => {};
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const pathname = new URL(url).pathname;
      if (pathname.endsWith("/commits/main")) {
        requests.set(pathname, (requests.get(pathname) ?? 0) + 1);
        if (pathname.includes("/example/paint-source/")) {
          started();
          await gate;
        }
      }
      return fixtureFetch(input, init);
    };
    const count = (repository: string) => requests.get(`/repos/example/${repository}/commits/main`) ?? 0;

    // Keep the first request pending deterministically, without timers or real network I/O.
    for (const fail of [false, true]) {
      online = !fail;
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const before = count("paint-source");
      const entered = new Promise<void>((resolve) => {
        started = resolve;
      });
      const first = checkCatalogSource(id);
      const all = checkCatalogSources();
      const single = checkCatalogSource(id);
      assert.equal(first, single);
      await entered;
      assert.equal(count("paint-source"), before + 1);
      // Installs own the image-mutation lock through preparation and commit so a restore
      // cannot delete cached assets between those phases. Other installs queue safely.
      const otherBefore = count("shrinking");
      const other = checkCatalogSource(otherId);
      assert.equal(count("shrinking"), otherBefore);
      release();
      await other;
      assert.equal(count("shrinking"), otherBefore + 1);
      const [result, results, duplicate] = await Promise.all([first, all, single]);
      assert.deepEqual(result, duplicate);
      assert.deepEqual(
        result,
        results.find((source) => source.id === id),
      );
      assert.equal("error" in result, fail);
      assert.equal(count("paint-source"), before + 1);
      online = true;
      const later = await checkCatalogSource(id);
      assert.equal("error" in later, false);
      assert.equal(count("paint-source"), before + 2);
      assert.equal(listCatalogSources().find((source) => source.id === id)!.lastError, null);
    }

    for (const fail of [false, true]) {
      online = !fail;
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const before = count("paint-source");
      const first = checkCatalogSourceVersions();
      const duplicate = checkCatalogSourceVersions();
      assert.equal(count("paint-source"), before + 1);
      release();
      const [result, repeated] = await Promise.all([first, duplicate]);
      assert.deepEqual(result, repeated);
      assert.equal("error" in result.find((source) => source.id === id)!, fail);
      assert.equal(count("paint-source"), before + 1);
      online = true;
      version = "1.0.1";
      const later = await checkCatalogSourceVersions();
      assert.deepEqual(
        later.find((source) => source.id === id),
        {
          id,
          availableVersion: "1.0.1",
          updateAvailable: true,
        },
      );
      assert.equal(count("paint-source"), before + 2);
    }
    // A later explicit install sees new content, not the earlier settled check result.
    assert.equal((await checkCatalogSource(id)).updated, true);
    assert.equal(listCatalogSources().find((source) => source.id === id)!.version, "1.0.1");
    const missing = checkCatalogSource("missing");
    await assert.rejects(missing, /Catalog source not found/);
    const retried = checkCatalogSource("missing");
    assert.notEqual(retried, missing);
    await assert.rejects(retried, /Catalog source not found/);
  } finally {
    globalThis.fetch = fixtureFetch;
    online = true;
    version = "1.0.0";
    await removeCatalogSource(sourceId("example/paint-source"));
    await removeCatalogSource(sourceId("example/shrinking"));
    catalogRequests = 0;
  }
});

test("items a source update drops are deleted unless the vault still uses them", async () => {
  const db = getDb();
  await addCatalogSource("example/shrinking");
  const imageKey = db.select().from(colorSchemeImages).get()!.imageUrl.split("/").at(-1)!;
  db.insert(paintInventory)
    .values({ paintId: testId("shrink/used"), state: "OWNED" })
    .run();
  db.insert(miniatures)
    .values({ id: testId("mini"), title: "Mini", status: "OWNED", createdAt: 1 })
    .run();
  db.insert(miniatureColorSchemes)
    .values({ miniatureId: testId("mini"), schemeId: testId("shrink/used-scheme") })
    .run();

  shrinkingVersion = "1.0.1";
  assert.equal((await checkCatalogSources())[0].updated, true);
  const paints = new Map(
    db
      .select()
      .from(paintCatalog)
      .all()
      .map((row) => [row.id, row.discontinued]),
  );
  // The owned paint and the paint inside the used scheme stay, marked discontinued.
  assert.deepEqual(
    paints,
    new Map([
      [testId("shrink/used"), true],
      [testId("shrink/in-scheme"), true],
    ]),
  );
  assert.deepEqual(
    db
      .select()
      .from(colorSchemes)
      .all()
      .map((row) => row.id),
    [testId("shrink/used-scheme")],
  );
  assert.equal(db.select().from(miniatureTemplates).all().length, 0);
  // Kept items stay linked, so the source's removal still accounts for them.
  assert.deepEqual(listCatalogSources()[0].counts, { paints: 2, schemes: 1, templates: 0 });
  assert.equal((await sourceImage(imageKey)).status, 200);
  assert.equal(previewSourceRemoval(sourceId("example/shrinking")).canRemove, false);

  db.delete(miniatures).run();
  db.delete(paintInventory).run();
  const shrinking = sourceId("example/shrinking");
  assert.match(shrinking, /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/);
  assert.equal((await removeCatalogSource(shrinking)).canRemove, true);
  assert.equal(db.select().from(paintCatalog).all().length, 0);
  assert.equal(db.select().from(colorSchemes).all().length, 0);
  assert.equal((await sourceImage(imageKey)).status, 404);
});

test("source imports once per version, updates by ID, and stays usable offline", async () => {
  try {
    await assert.rejects(
      addCatalogSource("https://github.com/example/failing-dependency"),
      /Source request failed/,
    );
    assert.equal(listCatalogSources().length, 0);
    assert.deepEqual(readdirSync(path.join(directory, "images")), []);

    await assert.rejects(addCatalogSource("https://github.com/example/broken"), /missing scheme/);
    assert.equal(listCatalogSources().length, 0);
    assert.equal(getDb().select().from(paintCatalog).all().length, 0);

    // `user:` IDs belong to the vault owner, so a source can never collide with their items.
    await assert.rejects(
      addCatalogSource("https://github.com/example/reserved"),
      /Paint 1 \("Reserved"\) has an invalid "id"/,
    );
    assert.equal(listCatalogSources().length, 0);
    assert.deepEqual(readdirSync(path.join(directory, "images")), []);

    const first = await addCatalogSource("https://github.com/example/paint-source");
    assert.equal(first.updated, true);
    assert.equal(listCatalogSources()[0].version, "1.0.0");
    assert.deepEqual(listCatalogSources()[0].counts, { paints: 1, schemes: 1, templates: 1 });
    assert.equal(getDb().select().from(paintCatalog).all().length, 1);
    assert.equal(getDb().select().from(colorSchemes).all().length, 1);
    assert.equal(getDb().select().from(miniatureTemplates).all().length, 1);
    assert.equal(getDb().select().from(paintCatalog).get()!.type, "BASE");
    assert.equal(listCatalogSources()[0].license, "CC0-1.0");
    assert.equal(listCatalogSources()[0].attribution, "Example Co.");
    assert.deepEqual(
      getDb()
        .select()
        .from(miniatureTemplatePaints)
        .all()
        .map(({ templateId, paintId, step }) => ({ templateId, paintId, step })),
      [{ templateId: testId("blue-template"), paintId: testId("shared-blue"), step: "BASING" }],
    );
    assert.deepEqual(
      getDb()
        .select()
        .from(miniatureTemplateSchemes)
        .all()
        .map(({ templateId, schemeId }) => ({ templateId, schemeId })),
      [{ templateId: testId("blue-template"), schemeId: testId("blue-scheme") }],
    );
    const imageUrl = getDb().select().from(colorSchemeImages).get()!.imageUrl;
    assert.equal((await sourceImage(imageUrl.split("/").at(-1)!)).status, 200);
    assert.equal((await checkCatalogSources())[0].updated, false);
    assert.equal(catalogRequests, 3);

    assert.equal(listCatalogSources()[0].logoUrl, null);
    assert.equal(sourceLogo(sourceId("example/paint-source")).status, 404);
    logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>';
    assert.equal((await checkCatalogSources())[0].updated, false);
    const logoUrl = listCatalogSources()[0].logoUrl;
    assert.equal(
      String(logoUrl).split("?")[0],
      `/api/catalog-source-logos/${sourceId("example/paint-source")}`,
    );
    assert.match(String(logoUrl), /\?v=[a-f\d]{12}$/);
    const served = sourceLogo(sourceId("example/paint-source"));
    assert.equal(served.status, 200);
    assert.match(served.headers.get("content-type")!, /^image\/svg\+xml/);
    assert.match(served.headers.get("content-security-policy")!, /default-src 'none'/);
    assert.equal(await served.text(), logo);
    logo = "<html><body>not a logo</body></html>";
    await checkCatalogSources();
    assert.equal(listCatalogSources()[0].logoUrl, null);
    logo = null;
    assert.equal(catalogRequests, 3);

    colorHex = "#2244bb";
    version = "1.0.1";
    await assert.rejects(addCatalogSource("https://github.com/example/broken"), /missing scheme/);
    assert.equal(listCatalogSources()[0].version, "1.0.0");
    assert.equal(getDb().select().from(paintCatalog).get()!.colorHex, "#3366cc");
    assert.deepEqual(readdirSync(path.join(directory, "images")), [imageUrl.split("/").at(-1)]);
    assert.deepEqual(await checkCatalogSourceVersions(), [
      { id: sourceId("example/paint-source"), availableVersion: "1.0.1", updateAvailable: true },
    ]);
    assert.equal(listCatalogSources()[0].version, "1.0.0");
    assert.equal((await checkCatalogSources())[0].updated, true);
    assert.equal(getDb().select().from(paintCatalog).get()!.colorHex, "#2244bb");
    assert.equal(getDb().select().from(paintCatalog).all().length, 1);
    assert.equal(catalogRequests, 5);
    assert.equal(getDb().select().from(colorSchemes).all().length, 1);
    assert.equal((await checkCatalogSourceVersions())[0].updateAvailable, false);

    // A repository that moves back to an older version keeps the installed one.
    version = "1.0.0";
    const older = (await checkCatalogSources())[0];
    assert.match(
      String("error" in older && older.error),
      /now has version 1\.0\.0, older than the installed 1\.0\.1/,
    );
    assert.equal(listCatalogSources()[0].version, "1.0.1");
    assert.equal(getDb().select().from(paintCatalog).get()!.colorHex, "#2244bb");
    assert.equal(catalogRequests, 5);
    version = "1.0.1";
    assert.equal((await checkCatalogSources())[0].updated, false);
    assert.equal(listCatalogSources()[0].lastError, null);

    await addCatalogSource("https://github.com/example/dependent");
    assert.equal(getDb().select().from(paintCatalog).all().length, 1);
    const removal = previewSourceRemoval(sourceId("example/paint-source"));
    assert.equal(removal.canRemove, false);
    assert.ok(removal.blockers.some((blocker) => blocker.label === "Other catalog sources"));
    assert.equal((await removeCatalogSource(sourceId("example/paint-source"))).canRemove, false);
    assert.equal(getDb().select().from(paintCatalog).all().length, 1);

    online = false;
    const offline = (await checkCatalogSources())[0];
    assert.ok("error" in offline);
    assert.match(String(offline.error), /Offline/);
    assert.equal(getDb().select().from(paintCatalog).get()!.colorHex, "#2244bb");

    assert.equal((await removeCatalogSource(sourceId("example/dependent"))).canRemove, true);
    assert.equal(getDb().select().from(miniatureTemplates).all().length, 1);
    assert.equal((await removeCatalogSource(sourceId("example/paint-source"))).canRemove, true);
    assert.equal(getDb().select().from(paintCatalog).all().length, 0);
    assert.equal(getDb().select().from(colorSchemes).all().length, 0);
    assert.equal(getDb().select().from(miniatureTemplates).all().length, 0);
    assert.equal((await sourceImage(imageUrl.split("/").at(-1)!)).status, 404);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("source logos must be standalone SVG documents within the size limit", () => {
  const svg = (text: string) => validLogoSvg(Buffer.from(text));
  assert.ok(svg('<svg viewBox="0 0 1 1"></svg>'));
  assert.ok(svg('\uFEFF<?xml version="1.0"?>\n<!-- logo -->\n<svg>\n</svg>\n'));
  assert.equal(svg("<html><svg></svg></html>"), null);
  assert.equal(svg("<svg>"), null);
  assert.equal(svg("<svgfoo></svgfoo>"), null);
  assert.equal(svg(""), null);
  assert.equal(svg(`<svg>${" ".repeat(LOGO_MAX_BYTES)}</svg>`), null);
});

test("repository input accepts GitHub URLs and owner/name shorthand", () => {
  for (const input of [
    "https://github.com/Example/Paint-Source",
    "https://github.com/Example/Paint-Source.git",
    "http://www.github.com/Example/Paint-Source/",
    "github.com/Example/Paint-Source",
    "github:Example/Paint-Source",
    "Example/Paint-Source",
  ])
    assert.deepEqual(normalizeRepository(input), {
      id: "example/paint-source",
      url: "https://github.com/Example/Paint-Source",
    });
  assert.throws(() => normalizeRepository("https://gitlab.com/example/source"), /public GitHub/);
  assert.throws(() => normalizeRepository("example"), /public GitHub/);
});
