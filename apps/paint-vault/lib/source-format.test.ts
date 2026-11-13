import assert from "node:assert/strict";
import test from "node:test";

import { APP_VERSION } from "./app-version.ts";
import { parseAssets, parseCatalog, parseManifest, SourceFormatError } from "./source-format.ts";
import { testId } from "./test-ids.ts";

const RED = testId("red paint"),
  RED_SCHEME = testId("red scheme"),
  STEP = testId("step"),
  PAINT_ENTRY = testId("paint entry");

const manifest = {
  formatVersion: 1,
  name: "Example",
  version: "1.0.0",
  dependencies: [],
  catalog: "catalog.json",
  assets: "assets.json",
};
const paint = { id: RED, brand: "Example", range: "Base", name: "Red" };
const scheme = {
  id: RED_SCHEME,
  name: "Red",
  category: "RED",
  entries: [
    { id: STEP, type: "STEP", label: "EDGE_HIGHLIGHT" },
    { id: PAINT_ENTRY, type: "PAINT", paintId: RED },
  ],
};
const template = {
  id: testId("model"),
  name: "Model",
  manufacturer: "",
  faction: "",
  categories: [],
  schemeIds: [RED_SCHEME],
  paints: [
    { paintId: RED, step: "BASECOAT", notes: "", sortOrder: 0 },
    { paintId: RED, step: "GLAZE", notes: "", sortOrder: 1 },
  ],
};
const catalog = (overrides: Record<string, unknown> = {}) => ({
  paints: [paint],
  schemes: [scheme],
  templates: [template],
  ...overrides,
});
const rejects = (run: () => unknown, message: RegExp) =>
  assert.throws(run, (error) => error instanceof SourceFormatError && message.test(error.message));

test("a valid version 1 source with every optional field is accepted", () => {
  assert.equal(
    parseManifest({ ...manifest, license: "MIT", attribution: "Me", minimumAppVersion: APP_VERSION }).license,
    "MIT",
  );
  const parsed = parseCatalog(
    catalog({
      paints: [
        {
          ...paint,
          type: "BASE",
          discontinued: true,
          colorHex: "#aa0000",
          sourceUrl: "https://example.com",
          sourceLabel: null,
        },
      ],
    }),
  );
  assert.equal(parsed.paints[0].type, "BASE");
  assert.equal(parsed.templates[0].paints.length, 2);
});

test("unknown fields are rejected and named", () => {
  rejects(
    () => parseManifest({ ...manifest, homepage: "https://x" }),
    /source\.json has an unknown field "homepage"/,
  );
  rejects(() => parseCatalog(catalog({ extras: [] })), /catalog\.json has an unknown field "extras"/);
  rejects(
    () => parseCatalog(catalog({ paints: [{ ...paint, finish: "matte" }] })),
    /Paint 1 \("Red"\) has an unknown field "finish"/,
  );
  rejects(
    () =>
      parseCatalog(
        catalog({
          schemes: [{ ...scheme, entries: [{ id: STEP, type: "STEP", label: "BASECOAT", paintId: "x" }] }],
        }),
      ),
    /entry 1 has an unknown field "paintId"/,
  );
  rejects(
    () =>
      parseCatalog(
        catalog({ templates: [{ ...template, paints: [{ ...template.paints[0], colour: "red" }] }] }),
      ),
    /Template 1 \("Model"\) paint 1 has an unknown field "colour"/,
  );
  rejects(
    () => parseAssets({ "images/a.png": { sha256: "a".repeat(64), size: 3 } }, new Set()),
    /unknown field "size"/,
  );
});

test("format versions, app versions and values are checked", () => {
  rejects(() => parseManifest({ ...manifest, formatVersion: 2 }), /needs a newer version of Paint Vault/);
  rejects(() => parseManifest({ ...manifest, formatVersion: 0 }), /unsupported format/);
  rejects(
    () => parseManifest({ ...manifest, minimumAppVersion: "999.0.0" }),
    /needs Paint Vault 999\.0\.0 or newer/,
  );
  rejects(() => parseCatalog(catalog({ paints: [{ ...paint, type: "SPEEDPAINT" }] })), /invalid "type"/);
  rejects(() => parseCatalog(catalog({ paints: [{ ...paint, colorHex: "red" }] })), /invalid "colorHex"/);
  rejects(
    () => parseCatalog(catalog({ paints: [{ ...paint, sourceUrl: "http://x.com" }] })),
    /invalid "sourceUrl"/,
  );
  // Item and entry IDs are lowercase UUIDs; readable names, upper case and `user:` IDs are refused.
  for (const id of ["example/base/red", RED.toUpperCase(), `user:${RED}`])
    rejects(() => parseCatalog(catalog({ paints: [{ ...paint, id }] })), /invalid "id"/);
  rejects(
    () => parseCatalog(catalog({ schemes: [{ ...scheme, entries: [{ ...scheme.entries[0], id: "s" }] }] })),
    /invalid "id"/,
  );
  rejects(() => parseCatalog(catalog({ paints: [paint, paint] })), /Duplicate paint ID/);
  rejects(
    () => parseCatalog(catalog({ schemes: [{ ...scheme, entries: [scheme.entries[1]] }] })),
    /paint outside a STEP/,
  );
  rejects(() => parseAssets({}, new Set(["images/a.png"])), /missing images\/a\.png/);
  rejects(
    () =>
      parseCatalog(catalog({ schemes: [{ ...scheme, entries: [...scheme.entries, scheme.entries[1]] }] })),
    /duplicate entry ID/,
  );
});

test("a template lists each scheme once and each paint once per step", () => {
  rejects(
    () => parseCatalog(catalog({ templates: [{ ...template, schemeIds: [RED_SCHEME, RED_SCHEME] }] })),
    /lists a scheme more than once/,
  );
  rejects(
    () =>
      parseCatalog(
        catalog({
          templates: [
            {
              ...template,
              paints: [
                { paintId: RED, step: "BASECOAT", notes: "", sortOrder: 0 },
                { paintId: RED, step: "BASECOAT", notes: "again", sortOrder: 1 },
              ],
            },
          ],
        }),
      ),
    /paint 2 repeats a paint within the same step/,
  );
});
