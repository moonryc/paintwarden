#!/usr/bin/env node
// Measure existing CLEAN Vite builds only. This script never builds or changes dist.
import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile, mkdtemp, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { init, parse as parseImports } from "es-module-lexer";
import { parse as parseAst } from "acorn";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiNamespaces = ["common", "glossary", "pages", "components", "shell", "errors"];
const nonUiNamespaces = ["desktop", "site"];
const jsPattern = /\.(?:m?js)$/;

async function walk(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(directory, name)));
    else if (entry.isFile()) files.push(name);
  }
  return files.sort();
}
function sum(files) {
  return files.reduce(
    (total, file) => ({
      rawBytes: total.rawBytes + file.rawBytes,
      gzipBytes: total.gzipBytes + file.gzipBytes,
    }),
    { rawBytes: 0, gzipBytes: 0 },
  );
}
function visit(node, callback) {
  if (!node || typeof node !== "object") return;
  if (node.type) callback(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => visit(child, callback));
    else if (value && typeof value === "object") visit(value, callback);
  }
}
function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((match) => [
      match[1].toLowerCase(),
      match[2] ?? match[3] ?? match[4],
    ]),
  );
}

export async function measure(directory) {
  await init;
  directory = path.resolve(directory);
  const names = await walk(directory);
  const assets = new Map();
  const sources = new Map();
  const staticImports = new Map();
  const dynamicImports = new Map();
  const localeMappings = [];
  for (const file of names.filter((name) => jsPattern.test(name) || name.endsWith(".css"))) {
    const bytes = await readFile(path.join(directory, file));
    assets.set(file, { file, rawBytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 6 }).length });
    if (jsPattern.test(file)) sources.set(file, bytes.toString("utf8"));
  }
  function resolve(specifier, importer) {
    assert.ok(!/^(?:[a-z]+:|\/\/)/i.test(specifier), `External module ${specifier} in ${importer}`);
    const clean = decodeURIComponent(specifier.split(/[?#]/)[0]);
    const file = clean.startsWith("/")
      ? path.posix.normalize(clean.slice(1))
      : path.posix.normalize(path.posix.join(path.posix.dirname(importer), clean));
    assert.ok(assets.has(file), `Missing built asset ${file}, imported by ${importer}`);
    return file;
  }
  for (const [file, source] of sources) {
    const [imports] = parseImports(source, file);
    // v3 full build uses type/specifier; older/minimal builds use d/n.
    const normalized = imports.map((item) => ({
      specifier: item.specifier ?? item.n,
      isStatic: item.type === "static" || item.type === "reexport-star" || item.d === -1,
      isDynamic: item.type === "dynamic" || item.d >= 0,
      glob: item.glob,
    }));
    staticImports.set(
      file,
      normalized
        .filter((item) => item.isStatic && item.specifier !== undefined)
        .map((item) => resolve(item.specifier, file)),
    );
    dynamicImports.set(
      file,
      normalized
        .filter((item) => item.isDynamic && item.specifier !== undefined && !item.glob)
        .map((item) => resolve(item.specifier, file)),
    );
    // Vite's generated glob object preserves locale source paths as property keys.
    // Parse its property values rather than guessing hashes or matching chunk names.
    if (!source.includes("/locales/") && !source.includes("./locales/")) continue;
    const ast = parseAst(source, { ecmaVersion: "latest", sourceType: "module" });
    visit(ast, (node) => {
      if (node.type !== "Property" || node.key.type !== "Literal" || typeof node.key.value !== "string")
        return;
      const match = node.key.value.match(/(?:^|\/)locales\/([^/]+)\/([^/]+)\.json$/);
      if (!match) return;
      const targets = [];
      visit(node.value, (child) => {
        if (child.type === "ImportExpression" && typeof child.source.value === "string") {
          targets.push(resolve(child.source.value, file));
        }
      });
      assert.equal(targets.length, 1, `Expected one dynamic namespace import: ${node.key.value}`);
      localeMappings.push({ language: match[1], namespace: match[2], file: targets[0], mappedIn: file });
    });
  }
  const html = await readFile(path.join(directory, "index.html"), "utf8");
  const entries = [...html.matchAll(/<script\b[^>]*>/gi)]
    .map(([tag]) => attributes(tag))
    .filter((attrs) => attrs.type === "module" && attrs.src)
    .map((attrs) => resolve(attrs.src, "index.html"));
  assert.ok(entries.length, `No HTML module entry found in ${directory}`);
  function closure(entries) {
    const result = new Set();
    function add(file) {
      if (result.has(file)) return;
      assert.ok(sources.has(file), `Non-JS static module: ${file}`);
      result.add(file);
      for (const imported of staticImports.get(file) || []) add(imported);
    }
    entries.forEach(add);
    return [...result].sort();
  }
  function group(files) {
    const details = [...new Set(files)].sort().map((file) => assets.get(file));
    return { ...sum(details), fileCount: details.length, files: details };
  }
  const startupFiles = closure(entries);
  const languages = {};
  for (const language of [...new Set(localeMappings.map((item) => item.language))].sort()) {
    const mappings = localeMappings.filter((item) => item.language === language);
    const namespaces = {};
    for (const item of mappings) {
      assert.ok(!namespaces[item.namespace], `Duplicate ${language}/${item.namespace} mapping`);
      namespaces[item.namespace] = {
        ...group(closure([item.file])),
        chunk: item.file,
        mappedIn: item.mappedIn,
        loadedByUi: uiNamespaces.includes(item.namespace),
        staticallyInStartup: startupFiles.includes(item.file),
      };
    }
    for (const namespace of [...uiNamespaces, ...nonUiNamespaces]) {
      assert.ok(namespaces[namespace], `Missing ${language}/${namespace} emitted mapping`);
    }
    const uiFiles = uiNamespaces.flatMap((namespace) => namespaces[namespace].files.map(({ file }) => file));
    const offlineFiles = nonUiNamespaces.flatMap((namespace) =>
      namespaces[namespace].files.map(({ file }) => file),
    );
    languages[language] = {
      uiNamespaceChunks: group(uiFiles),
      incrementalUiNamespaceLoad: group(uiFiles.filter((file) => !startupFiles.includes(file))),
      startupWithSelectedLanguage: group([...startupFiles, ...uiFiles]),
      notLoadedByUi: group(offlineFiles),
      namespaces,
    };
  }
  return {
    directory,
    htmlEntries: entries,
    startupJs: group(startupFiles),
    totalJs: group([...sources.keys()]),
    css: group([...assets.keys()].filter((file) => file.endsWith(".css"))),
    localeChunks: {
      uiNamespaces,
      notLoadedByUiNamespaces: nonUiNamespaces,
      languageCount: Object.keys(languages).length,
      mappingCount: localeMappings.length,
      languages,
    },
    staticImports: Object.fromEntries(staticImports),
    dynamicImports: Object.fromEntries(dynamicImports),
    localizationMarkerFiles: [...sources]
      .filter(([, source]) => /i18next|localization/i.test(source))
      .map(([file]) => file),
  };
}

function delta(baseline, current) {
  return Object.fromEntries(
    ["startupJs", "totalJs", "css"].map((group) => [
      group,
      Object.fromEntries(
        ["rawBytes", "gzipBytes"].map((metric) => [metric, current[group][metric] - baseline[group][metric]]),
      ),
    ]),
  );
}
function describe(label, measurement) {
  const { startupJs, totalJs, css, localeChunks } = measurement;
  return `${label}: static startup JS ${startupJs.rawBytes} raw / ${startupJs.gzipBytes} gzip bytes; total JS ${totalJs.rawBytes} / ${totalJs.gzipBytes}; CSS ${css.rawBytes} / ${css.gzipBytes}. ${localeChunks.languageCount} languages mapped.`;
}
async function selfTest() {
  const directory = await mkdtemp(path.join(tmpdir(), "i18n-bundle-report-test-"));
  try {
    const fixture = {
      "index.html": '<script type="module" src="./assets/entry.js"></script>',
      "assets/entry.js":
        'import "./shared.js"; export * from "./shared.js"; import("./lazy.js"); const text="import fake";',
      "assets/shared.js": 'export const value = 1; import "./leaf.js";',
      "assets/leaf.js": "export const leaf = 2;",
      "assets/lazy.js": 'import "./lazy-dep.js";',
      "assets/lazy-dep.js": "export default 3;",
      "assets/style.css": "body{color:red}",
      "sw.js": "// Not a startup module",
    };
    const mapping = [];
    for (const language of ["en", "es", "zh-Hant"]) {
      for (const namespace of [...uiNamespaces, ...nonUiNamespaces]) {
        const file = `${language}-${namespace}.js`;
        fixture[`assets/${file}`] = `export default ${JSON.stringify({ language, namespace })};`;
        mapping.push(
          `${JSON.stringify(`./locales/${language}/${namespace}.json`)}:()=>import(${JSON.stringify(`./${file}`)})`,
        );
      }
    }
    fixture["assets/entry.js"] += `const glob={${mapping.join(",")}}; export {glob};`;
    for (const [file, content] of Object.entries(fixture)) {
      await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
      await writeFile(path.join(directory, file), content);
    }
    const result = await measure(directory);
    assert.deepEqual(
      result.startupJs.files.map(({ file }) => file),
      ["assets/entry.js", "assets/leaf.js", "assets/shared.js"],
    );
    assert.equal(result.localeChunks.languageCount, 3);
    assert.equal(result.localeChunks.mappingCount, 24);
    assert.equal(result.localeChunks.languages.en.uiNamespaceChunks.fileCount, 6);
    assert.equal(result.localeChunks.languages.en.notLoadedByUi.fileCount, 2);
    assert.equal(result.localeChunks.languages.en.startupWithSelectedLanguage.fileCount, 9);
    assert.equal(result.totalJs.fileCount, 30);
    assert.equal(result.css.rawBytes, Buffer.byteLength(fixture["assets/style.css"]));
    assert.equal(
      result.startupJs.rawBytes,
      ["entry", "shared", "leaf"].reduce((n, file) => n + Buffer.byteLength(fixture[`assets/${file}.js`]), 0),
    );
    assert.ok(result.startupJs.gzipBytes > 0);
    console.log(
      "PASS: recursive static imports/re-exports, lazy exclusion, glob namespace mapping, selected-language union, service-worker exclusion, CSS/raw/gzip accounting",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "Usage: node scripts/i18n-bundle-report.mjs --baseline <dist> --output <json> [--current <dist>] [--baseline-metadata <json>] [--baseline-only]\nDefault current: apps/paintwarden-web/dist. Explicit --output is required; put audit evidence outside the source worktree. Baseline metadata defaults to baseline-build-metadata.json beside the output.\nUse --self-test for isolated synthetic parser/accounting tests. Existing clean outputs only; no builds.",
    );
    return;
  }
  if (args.includes("--self-test")) return selfTest();
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    assert.ok(
      ["--baseline", "--current", "--output", "--baseline-metadata", "--baseline-only"].includes(arg),
      `Unknown argument ${arg}`,
    );
    if (arg === "--baseline-only") options[arg] = true;
    else {
      assert.ok(args[i + 1] && !args[i + 1].startsWith("--"), `Missing value for ${arg}`);
      options[arg] = args[++i];
    }
  }
  assert.ok(options["--baseline"], "--baseline <dist> is required; use --help");
  assert.ok(
    options["--output"],
    "--output <json> is required; keep audit evidence outside the source worktree",
  );
  const output = path.resolve(options["--output"]);
  const baseline = await measure(options["--baseline"]);
  const current = options["--baseline-only"]
    ? null
    : await measure(options["--current"] || path.join(root, "apps/paintwarden-web/dist"));
  let baselineBuild = null;
  const metadataFile =
    options["--baseline-metadata"] || path.join(path.dirname(output), "baseline-build-metadata.json");
  try {
    baselineBuild = JSON.parse(await readFile(metadataFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT" || options["--baseline-metadata"]) throw error;
  }
  if (baselineBuild) {
    assert.equal(
      await realpath(baselineBuild.distDirectory),
      await realpath(baseline.directory),
      "Baseline metadata describes another build",
    );
  }
  if (current)
    assert.ok(
      current.localeChunks.languageCount > 0,
      "Current dist contains no locale mappings; build the i18n candidate first",
    );
  const interpretation = [describe("Baseline", baseline)];
  if (!current)
    interpretation.push(
      "Baseline-only report: no current build measured and no migration delta claimed. Rerun without --baseline-only after the candidate build.",
    );
  if (current) {
    interpretation.push(describe("Current", current));
    const difference = delta(baseline, current);
    interpretation.push(
      `Static startup JS change: ${difference.startupJs.rawBytes} raw / ${difference.startupJs.gzipBytes} gzip bytes. All languages are NOT counted as initial JS; add only the selected language's six UI namespaces (startupWithSelectedLanguage). Desktop/site chunks are emitted by the broad glob but not requested by the UI runtime.`,
    );
    const english = current.localeChunks.languages.en;
    if (english) {
      const startup = english.startupWithSelectedLanguage;
      interpretation.push(
        `Selected English startup: ${startup.rawBytes} raw / ${startup.gzipBytes} gzip bytes, including six runtime-loaded namespaces; change vs baseline ${startup.rawBytes - baseline.startupJs.rawBytes} raw / ${startup.gzipBytes - baseline.startupJs.gzipBytes} gzip bytes.`,
      );
    }
  }
  const report = {
    measuredAt: new Date().toISOString(),
    node: process.version,
    method: {
      startupJs:
        "HTML module src entries plus recursively STATIC JS imports/re-exports, parsed by es-module-lexer; excludes dynamic imports and workers/service worker unless statically imported.",
      selectedLanguage:
        "Static startup union with the six UI namespace chunks and their static dependencies; runtime requests these before rendering. Other screen lazy chunks excluded. Not a browser network trace.",
      totals:
        "All .js/.mjs files recursively in dist (including worker/service worker and all lazy catalogs); CSS measured separately. Clean dist required: stale files inflate totals.",
      gzip: "Sum of independent gzipSync level 6 sizes per file, deduplicated within each group. No headers/cache/Brotli; excludes fonts/images/maps/HTML.",
      localeMapping:
        "Acorn AST: Vite import.meta.glob property locale source path -> literal dynamic import target. Six UI namespaces vs desktop/site; no assumptions about hashed file names.",
    },
    baselineBuild,
    baseline,
    current,
    currentMinusBaseline: current ? delta(baseline, current) : null,
    interpretation,
  };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(interpretation.join("\n"));
  console.log(`Report: ${output}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
