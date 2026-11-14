import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localeRoot = path.join(root, "packages/paint-i18n/locales");
export const languageCodes = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt-BR",
  "nl",
  "pl",
  "ru",
  "ja",
  "ko",
  "zh-Hans",
  "zh-Hant",
];
const plural = /_(zero|one|two|few|many|other)$/;
export const baseKey = (key) => key.replace(plural, "");
export function validateResourceStructure(text) {
  const value = JSON.parse(text);
  const failures = [];
  const source = ts.parseJsonText("locale.json", text);
  function visit(node, prefix = "") {
    if (!ts.isObjectLiteralExpression(node)) {
      failures.push(`${prefix || "root"}: expected object`);
      return;
    }
    if (!node.properties.length) failures.push(`${prefix || "root"}: empty object`);
    const keys = new Set();
    for (const property of node.properties) {
      const key = property.name?.text;
      const name = prefix ? `${prefix}.${key}` : key;
      if (keys.has(key)) failures.push(`${name}: duplicate key`);
      keys.add(key);
      if (ts.isStringLiteral(property.initializer)) {
        if (!property.initializer.text.trim()) failures.push(`${name}: empty value`);
      } else if (ts.isObjectLiteralExpression(property.initializer)) visit(property.initializer, name);
      else failures.push(`${name}: expected string or object`);
    }
  }
  visit(source.statements[0].expression);
  return { value, failures };
}
function objectPaths(value, prefix = []) {
  return Object.entries(value)
    .flatMap(([key, item]) =>
      item && typeof item === "object"
        ? [JSON.stringify([...prefix, key]), ...objectPaths(item, [...prefix, key])]
        : [],
    )
    .sort();
}
export function flatten(object, prefix = "") {
  return Object.fromEntries(
    Object.entries(object).flatMap(([key, value]) => {
      const name = prefix ? `${prefix}.${key}` : key;
      return value && typeof value === "object" && !Array.isArray(value)
        ? Object.entries(flatten(value, name))
        : [[name, value]];
    }),
  );
}
export function placeholders(value) {
  return [...value.matchAll(/\{\{\s*(-?\s*[\w.]+)(?:\s*,[^}]*)?\s*\}\}/g)]
    .map((match) => match[0].slice(2, -2).replace(/\s/g, ""))
    .sort();
}
export function validateResources(source, translated, language) {
  const failures = [];
  const sourceBase = [...new Set(Object.keys(source).map(baseKey))].sort();
  const translatedBase = [...new Set(Object.keys(translated).map(baseKey))].sort();
  try {
    assert.deepEqual(translatedBase, sourceBase);
  } catch {
    failures.push("missing or extra translation keys");
  }
  for (const [key, value] of Object.entries(translated)) {
    if (typeof value !== "string" || !value.trim()) {
      failures.push(`${key}: empty or non-string value`);
      continue;
    }
    const original = source[key] ?? source[`${baseKey(key)}_other`] ?? source[`${baseKey(key)}_one`];
    if (typeof original !== "string") continue;
    try {
      assert.deepEqual(placeholders(value), placeholders(original));
    } catch {
      failures.push(`${key}: interpolation mismatch`);
    }
    if (
      (value.match(/\{\{/g) || []).length !== (value.match(/\}\}/g) || []).length ||
      (value.match(/\{\{/g) || []).length !== placeholders(value).length
    )
      failures.push(`${key}: unbalanced interpolation`);
  }
  const categories = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
  for (const name of sourceBase.filter((key) => source[`${key}_other`] !== undefined)) {
    const actual = Object.keys(translated)
      .filter((key) => baseKey(key) === name)
      .map((key) => key.match(plural)?.[1])
      .filter(Boolean);
    // i18next permits an explicit zero override in every language, independently of CLDR.
    const expected = new Set(categories);
    for (const category of expected)
      if (!actual.includes(category)) failures.push(`${name}: missing plural ${category}`);
    for (const category of actual)
      if (!expected.has(category) && category !== "zero")
        failures.push(`${name}: invalid plural ${category}`);
    if (translated[name] !== undefined && source[name] === undefined)
      failures.push(`${name}: unexpected unqualified plural key`);
    if (source[name] !== undefined && translated[name] === undefined)
      failures.push(`${name}: missing non-plural key`);
  }
  return failures;
}
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}
const allowedText = new Map([
  ["Paintwarden", "Product name"],
  ["GitHub", "Brand"],
  ["Docker", "Product name"],
  ["［Pseudo］", "Development-only language autonym"],
]);
export function rawJSX(source, filename) {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];
  const inspect = (node) => {
    let text;
    if (ts.isJsxText(node)) text = node.text.replace(/\s+/g, " ").trim();
    if (ts.isStringLiteral(node)) {
      const parent = node.parent;
      if (
        ts.isJsxAttribute(parent) &&
        /^(?:aria-label|aria-description|alt|title|label|placeholder|helperText)$/.test(
          parent.name.getText(ast),
        )
      )
        text = node.text;
      let expression = node;
      let ancestor = parent;
      let display = true;
      while (
        ts.isConditionalExpression(ancestor) ||
        ts.isBinaryExpression(ancestor) ||
        ts.isParenthesizedExpression(ancestor)
      ) {
        if (ts.isConditionalExpression(ancestor) && ancestor.condition === expression) display = false;
        if (
          ts.isBinaryExpression(ancestor) &&
          ![
            ts.SyntaxKind.BarBarToken,
            ts.SyntaxKind.AmpersandAmpersandToken,
            ts.SyntaxKind.QuestionQuestionToken,
          ].includes(ancestor.operatorToken.kind)
        )
          display = false;
        expression = ancestor;
        ancestor = ancestor.parent;
      }
      if (ts.isJsxExpression(ancestor) && display) {
        const attribute = ancestor.parent;
        if (
          !ts.isJsxAttribute(attribute) ||
          /^(?:aria-label|aria-description|alt|title|label|placeholder|helperText)$/.test(
            attribute.name.getText(ast),
          )
        )
          text = node.text;
      }
    }
    if (text && /\p{L}/u.test(text) && !allowedText.has(text) && !/^https?:\/\//.test(text)) {
      const start = node.getStart(ast);
      const previous = source.slice(0, start).split("\n").slice(-3).join("\n");
      if (!/i18n-allow:\s*\S+/.test(previous)) {
        const line = ast.getLineAndCharacterOfPosition(start).line + 1;
        violations.push(`${filename}:${line}: untranslated JSX ${JSON.stringify(text)}`);
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(ast);
  return violations;
}
export function main() {
  const failures = [];
  const namespaces = fs
    .readdirSync(path.join(localeRoot, "en"))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const source = Object.fromEntries(
    namespaces.map((name) => [
      name,
      flatten(JSON.parse(fs.readFileSync(path.join(localeRoot, "en", name), "utf8"))),
    ]),
  );
  for (const language of languageCodes) {
    const directory = path.join(localeRoot, language);
    const actual = fs.existsSync(directory)
      ? fs
          .readdirSync(directory)
          .filter((name) => name.endsWith(".json"))
          .sort()
      : [];
    try {
      assert.deepEqual(actual, namespaces);
    } catch {
      failures.push(`${language}: namespace file mismatch`);
    }
    for (const namespace of actual.filter((name) => namespaces.includes(name))) {
      const parsed = validateResourceStructure(fs.readFileSync(path.join(directory, namespace), "utf8"));
      failures.push(...parsed.failures.map((message) => `${language}/${namespace}: ${message}`));
      const original = JSON.parse(fs.readFileSync(path.join(localeRoot, "en", namespace), "utf8"));
      try {
        assert.deepEqual(objectPaths(parsed.value), objectPaths(original));
      } catch {
        failures.push(`${language}/${namespace}: nested object structure mismatch`);
      }
      const translated = flatten(parsed.value);
      failures.push(
        ...validateResources(source[namespace], translated, language).map(
          (message) => `${language}/${namespace}: ${message}`,
        ),
      );
    }
  }
  const production = [
    "packages/vault-ui/src/dom",
    "apps/paintwarden-web/src",
    "apps/paintwarden-site/src/site",
  ]
    .flatMap((directory) => files(path.join(root, directory)))
    .filter(
      (file) => file.endsWith(".tsx") && !/\.(?:stories|test)\./.test(file) && !file.includes("/storybook/"),
    );
  for (const file of production)
    failures.push(...rawJSX(fs.readFileSync(file, "utf8"), path.relative(root, file)));
  // Every statically referenced key is checked by TypeScript. This additionally detects orphaned
  // flat keys. Glossary is the deliberately complete hobby dictionary, not only today's UI subset.
  const usage = [
    ...production,
    ...files(path.join(root, "packages/vault-ui/src/dom")).filter(
      (file) => file.endsWith(".ts") && !file.includes("/generated/"),
    ),
    ...files(path.join(root, "apps/paintwarden-site/src")).filter((file) => file.endsWith(".astro")),
    ...files(path.join(root, "apps/paintwarden-electron")).filter(
      (file) => file.endsWith(".cjs") && !file.includes("/desktop-server/"),
    ),
  ]
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  const unused = [];
  for (const [namespace, resource] of Object.entries(source)) {
    if (namespace === "glossary.json" || namespace === "errors.json") continue;
    for (const key of new Set(Object.keys(resource).map(baseKey))) {
      if (
        !usage.includes(key) &&
        !(namespace === "desktop.json" && key.startsWith("menu.") && usage.includes(`"${key.slice(5)}"`))
      )
        unused.push(`${namespace}:${key}`);
    }
  }
  // Computed plural/enum families must declare their prefix in code; never silently exempt a namespace.
  const dynamicPrefixes = [
    "backup",
    "stage",
    "step",
    "colorCategory",
    "colorCategoryLabel",
    "category",
    "recipeStep",
    "method",
    "stock",
    "paintCategory",
  ];
  const unexplained = unused.filter(
    (entry) => !dynamicPrefixes.some((prefix) => entry.split(":")[1].startsWith(prefix)),
  );
  failures.push(...unexplained.map((entry) => `${entry}: unused key`));
  if (failures.length) {
    process.stderr.write(failures.join("\n") + "\n");
    process.exitCode = 1;
  } else
    process.stdout.write(
      `i18n: ${languageCodes.length} languages, ${namespaces.length} namespaces; resource, plural, interpolation, JSX and unused-key checks passed.\n`,
    );
  return failures;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
