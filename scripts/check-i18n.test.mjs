import assert from "node:assert/strict";
import test from "node:test";

import { rawJSX, validateResources } from "./check-i18n.mjs";

test("locale validation rejects missing/extra/empty keys and interpolation drift", () => {
  const source = { title: "Hello {{name}}", label: "Label" };
  assert.deepEqual(validateResources(source, { title: "Hallo {{name}}", label: "Name" }, "de"), []);
  assert.ok(validateResources(source, { title: "Hallo {{other}}", extra: "" }, "de").length >= 3);
});
test("locale validation uses CLDR cardinal categories, not English key equality", () => {
  const source = { paint_one: "{{count}} paint", paint_other: "{{count}} paints" };
  assert.deepEqual(validateResources(source, { paint_other: "{{count}} 塗料" }, "ja"), []);
  assert.ok(validateResources(source, source, "pl").some((message) => message.includes("few")));
  assert.deepEqual(
    validateResources(
      source,
      {
        paint_one: "{{count}} farba",
        paint_few: "{{count}} farby",
        paint_many: "{{count}} farb",
        paint_other: "{{count}} farby",
      },
      "pl",
    ),
    [],
  );
  assert.ok(
    validateResources(source, { paint_one: "{{count}} 塗料", paint_other: "{{count}} 塗料" }, "ja").some(
      (message) => message.includes("invalid plural one"),
    ),
  );
});
test("raw JSX checker catches text and accessible attributes, allows explicit exceptions", () => {
  assert.equal(rawJSX('<Button aria-label="Add paint">Add paint</Button>', "test.tsx").length, 2);
  assert.deepEqual(rawJSX('<Button aria-label={t("addPaint")}>{t("addPaint")}</Button>', "test.tsx"), []);
  assert.deepEqual(rawJSX("<span>Paint Vault</span>", "test.tsx"), []);
  assert.deepEqual(
    rawJSX("{/* i18n-allow: official product name */}\n<span>Brand Name</span>", "test.tsx"),
    [],
  );
});
