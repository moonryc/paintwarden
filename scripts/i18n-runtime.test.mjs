import { readFile } from "node:fs/promises";
import { languages } from "../packages/paint-i18n/languages.ts";
import { flatten } from "./check-i18n.mjs";
import { localizedFontVars } from "../packages/vault-ui/src/dom/theme-tokens.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {
  i18n,
  pseudoText,
  resolveLanguage,
  formatNumber,
  formatDate,
  formatRelativeTime,
  translateServerError,
} from "../packages/paint-i18n/runtime.ts";
import { publicError, withPublicError } from "../apps/paint-vault/lib/public-errors.ts";

test("language detection resolves regional variants and Chinese scripts", () => {
  for (const [tag, expected] of [
    ["pt-PT", "pt-BR"],
    ["es-MX", "es"],
    ["zh_TW", "zh-Hant"],
    ["zh-Hans-SG", "zh-Hans"],
    ["zh-HK", "zh-Hant"],
    ["de-AT", "de"],
    ["ar", "en"],
  ])
    assert.equal(resolveLanguage(tag), expected);
});
test("lazy resource backend preserves namespaces containing a default key", () => {
  assert.equal(i18n.t("components:default"), "Default");
  assert.equal(i18n.t("components:loadingPage", { title: "Workbench" }), "Loading Workbench…");
  assert.deepEqual(Object.keys(i18n.services.resourceStore.data), ["en"]);
  assert.equal(i18n.hasResourceBundle("en", "site"), false);
});
test("pseudo text expands readable text but preserves interpolation, nesting and markup", () => {
  const source = "Miniature {{name}} <strong>ready</strong> $t(glossary:paint)";
  const pseudo = pseudoText(source);
  assert.match(pseudo, /Mïnïátürë/);
  for (const token of ["{{name}}", "<strong>", "</strong>", "$t(glossary:paint)"])
    assert.ok(pseudo.includes(token));
  assert.ok(
    pseudoText("A miniature on your workbench").length >= 1.4 * "A miniature on your workbench".length,
  );
});
test("Intl formatting follows the active language and pseudo uses English", async () => {
  try {
    await i18n.changeLanguage("ja");
    assert.equal(formatNumber(1234.5), new Intl.NumberFormat("ja").format(1234.5));
    assert.equal(
      formatDate(0, { timeZone: "UTC" }),
      new Intl.DateTimeFormat("ja", { timeZone: "UTC" }).format(0),
    );
    assert.equal(formatRelativeTime(-1, "day"), "昨日");
    await i18n.changeLanguage("en-XA");
    assert.equal(formatNumber(1234.5), "1,234.5");
    assert.notEqual(i18n.t("components:default"), "Default");
  } finally {
    await i18n.changeLanguage("en");
  }
});
test("server error boundaries provide stable codes, parameters and safe client fallback", async () => {
  const error = publicError("Each paint needs brand and name");
  assert.deepEqual(error, { errorCode: "EACH_PAINT_NEEDS_BRAND_AND_NAME", errorParameters: {} });
  assert.equal(translateServerError(error), "Each paint needs brand and name");
  assert.equal(
    translateServerError({ error: "private filesystem details", errorCode: "UNKNOWN" }),
    i18n.t("errors:REQUEST_FAILED"),
  );
  const response = await withPublicError(
    Response.json(
      { error: "Each paint needs brand and name" },
      { status: 400, headers: { "x-test": "retained" } },
    ),
  );
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("x-test"), "retained");
  assert.deepEqual(await response.json(), { error: "Each paint needs brand and name", ...error });
  const successful = Response.json({ content: "User and plugin data stays untouched" });
  assert.equal(await withPublicError(successful), successful);
});

test("regional CJK fallback faces do not use the wrong script's font", () => {
  assert.match(localizedFontVars("ja")["--font-serif"], /Hiragino Mincho/);
  assert.doesNotMatch(localizedFontVars("ja")["--font-serif"], /Songti SC/);
  assert.match(localizedFontVars("zh-Hant")["--font-serif"], /Songti TC/);
  assert.match(localizedFontVars("ko")["--font-sans"], /Apple SD Gothic Neo/);
});

test("all 13 languages resolve all 56 plural families using current CLDR categories and Intl interpolation", async () => {
  const families = [];
  for (const namespace of ["components", "pages", "shell"]) {
    const resource = flatten(
      JSON.parse(
        await readFile(
          new URL(`../packages/paint-i18n/locales/en/${namespace}.json`, import.meta.url),
          "utf8",
        ),
      ),
    );
    for (const key of Object.keys(resource).filter((key) => key.endsWith("_one")))
      families.push([namespace, key.slice(0, -4)]);
  }
  assert.equal(families.length, 56);
  try {
    for (const { code } of languages) {
      await i18n.changeLanguage(code);
      const rules = new Intl.PluralRules(code);
      for (const count of [0, 1, 2, 5, 21, 22, 25, 1.5, 1_000_000])
        for (const [namespace, key] of families) {
          const raw = i18n.getResource(code, namespace, `${key}_${rules.select(count)}`);
          assert.equal(typeof raw, "string", `${code}/${namespace}/${key}/${count}`);
          const text = i18n.t(`${namespace}:${key}`, { count });
          const expected = raw
            .replace(/\{\{count, number\}\}/g, new Intl.NumberFormat(code).format(count))
            .replace(/\{\{count\}\}/g, String(count));
          assert.equal(text, expected, `${code}/${namespace}/${key}/${count}`);
        }
    }
  } finally {
    await i18n.changeLanguage("en");
  }
});
