import assert from "node:assert/strict";
import test from "node:test";

import { parseCatalogImport } from "./catalog-import.ts";

test("imports quoted CSV fields and line breaks", () => {
  assert.deepEqual(
    parseCatalogImport('brand,range,name\r\nCitadel,Base,"Blue, Bright"\r\nCustom,,"Shade\nOne"'),
    [
      { brand: "Citadel", range: "Base", name: "Blue, Bright" },
      { brand: "Custom", range: "", name: "Shade\nOne" },
    ],
  );
});

test("rejects malformed JSON and unclosed CSV quotes", () => {
  assert.throws(() => parseCatalogImport("[1]"), /JSON array of paints/);
  assert.throws(() => parseCatalogImport('brand,name\nCitadel,"Blue'), /Unclosed quoted/);
});
