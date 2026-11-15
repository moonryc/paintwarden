#!/usr/bin/env node
/** Isolated production website smoke (never builds/serves the app or touches a vault).
 * Node 22.22.2: node scripts/smoke-i18n-site.mjs /absolute/evidence-directory
 * Builds only paintwarden-site, snapshots its static output into disposable storage,
 * uses a random loopback port and a fresh Chromium context, then removes its storage.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { languages } from "../packages/paint-i18n/languages.ts";
import { launchOwned, stopOwned } from "./smoke-library-native.mjs";
import { root, translationDictionary, measureLayout, platformFonts } from "./i18n-layout-checks.mjs";

assert.equal(process.version, "v22.22.2", "Use the exact .nvmrc Node version");
assert.equal(process.argv.length, 3, "Usage: node scripts/smoke-i18n-site.mjs EVIDENCE_DIR");
const evidence = path.resolve(process.argv[2]);
await mkdir(evidence, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  root,
  scope:
    "Production static site: 13 locales × 5 routes, real autonym picker, metadata, navigation/reload persistence; all 13 locales × five routes at 390px",
  catalogs: [],
  results: [],
  runtimeErrors: [],
  consoleErrors: [],
  failedResponses: [],
  screenshots: [],
};
const routes = [
  { pathname: "/", page: "home", label: "website.overview" },
  { pathname: "/docs/", page: "docs", label: "website.howToUse" },
  { pathname: "/phone/", page: "phone", label: "website.phonePrivacy" },
  { pathname: "/faq/", page: "faq", label: "website.faq" },
  { pathname: "/download/", page: "download", label: "website.download" },
];
const catalogs = {};
const dictionaries = {};
const processes = [];
let browser;
let server;
let temporary;
let page;
let current = "en";
let origin;

const settle = async () => {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
};
async function ready(code, route) {
  await page.waitForFunction(
    ({ code, title, description }) =>
      document.documentElement.lang === code &&
      document.title === title &&
      document.querySelector('meta[name="description"]')?.content === description,
    {
      code,
      title: catalogs[code][`meta.${route.page}Title`],
      description: catalogs[code][`meta.${route.page}Description`],
    },
    { timeout: 15000 },
  );
  await page.getByRole("combobox", { name: catalogs[code]["website.language"], exact: true }).waitFor();
  await settle();
}
async function selectLanguage(code, route) {
  const picker = page.getByRole("combobox", { name: catalogs[current]["website.language"], exact: true });
  await picker.click();
  const names = await page.getByRole("option").allTextContents();
  assert.deepEqual(
    names,
    languages.map(({ name }) => name),
    "All 13 native autonyms, in configured order",
  );
  await page
    .getByRole("option", { name: languages.find((language) => language.code === code).name, exact: true })
    .click();
  current = code;
  await ready(code, route);
}
async function navigate(route, mobile) {
  if (mobile) {
    await page.getByRole("button", { name: catalogs[current]["website.openMenu"], exact: true }).click();
    await page
      .locator("#mobile-navigation")
      .getByRole("link", { name: catalogs[current][route.label], exact: true })
      .click();
  } else {
    await page
      .locator("header nav")
      .getByRole("link", { name: catalogs[current][route.label], exact: true })
      .click();
  }
  await page.waitForURL(`${origin}${route.pathname}`);
  await ready(current, route);
}
async function inspect(code, route, phase, mobile) {
  await ready(code, route);
  const row = { code, route: route.pathname, phase, viewport: mobile ? "390px" : "1440px" };
  const metadata = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content,
    ogDescription: document.querySelector('meta[property="og:description"]')?.content,
    savedLanguage: localStorage.getItem("paintwarden-language"),
  }));
  row.metadata = metadata;
  assert.equal(metadata.title, catalogs[code][`meta.${route.page}Title`]);
  assert.equal(metadata.ogTitle, metadata.title);
  assert.equal(metadata.description, catalogs[code][`meta.${route.page}Description`]);
  assert.equal(metadata.ogDescription, metadata.description);
  assert.equal(metadata.savedLanguage, code, "Picker selection persists in isolated browser storage");
  const autonym = languages.find((language) => language.code === code).name;
  assert.equal((await page.getByRole("combobox").innerText()).trim(), autonym);
  for (const item of routes) {
    const navigation = mobile ? page.locator("footer") : page.locator("header nav");
    assert.ok(
      await navigation.getByRole("link", { name: catalogs[code][item.label], exact: true }).isVisible(),
    );
  }
  const expectedHeading = {
    home: `${catalogs[code]["home.paintMore"]} ${catalogs[code]["home.huntLess"]}`,
    docs: catalogs[code]["docs.getFromShelfToSession"],
    faq: catalogs[code]["faq.theLittleDetailsMatter"],
    phone: catalogs[code]["phone.title"],
    download:
      catalogs[code][
        process.env.PUBLIC_RELEASES_AVAILABLE === "true"
          ? "download.pickYourKindOfVault"
          : "download.getPaintwarden"
      ],
  }[route.page];
  const normalize = (text) => text.replace(/\s+/g, " ").trim();
  row.heading = await page.locator("main h1").innerText();
  assert.equal(
    normalize(row.heading),
    normalize(expectedHeading),
    "Main heading uses the selected locale too",
  );
  row.layout = await page.evaluate(measureLayout, dictionaries[code]);
  row.siteUnresolvedKeys = await page.evaluate((keys) => {
    const text = document.body.innerText;
    const tokens = text.match(/(?:site:)?[a-zA-Z]+\.[a-zA-Z][a-zA-Z0-9]*/g) || [];
    const known = new Set(keys);
    return tokens.filter((token) => known.has(token.replace(/^site:/, "")));
  }, Object.keys(catalogs.en));
  row.unresolvedInterpolation = (await page.locator("body").innerText()).match(/\{\{[^}]+\}\}/g) || [];
  if (mobile && phase === "navigation") row.platformFonts = await platformFonts(page, "main h1");
  const flagged =
    row.layout.overflow ||
    row.layout.clipped.length ||
    row.layout.unresolvedKeys.length ||
    row.siteUnresolvedKeys.length ||
    row.unresolvedInterpolation.length;
  if (code === "en" && (phase === "navigation" || phase === "selection")) {
    if (route.page === "phone")
      await page.screenshot({
        path: path.join(evidence, `phone-page-${mobile ? "390" : "1440"}.png`),
        fullPage: true,
      });
    if (route.page === "home")
      await page
        .locator("#phone-privacy")
        .screenshot({ path: path.join(evidence, `home-phone-privacy-${mobile ? "390" : "1440"}.png`) });
  }
  const selectedScreenshot =
    mobile &&
    phase === "navigation" &&
    { de: "home", ja: "docs", "zh-Hans": "faq", es: "download" }[code] === route.page;
  if (flagged || selectedScreenshot) {
    const filename = `site-${code}-${route.page}-${mobile ? "390" : "1440"}-${phase}.png`;
    await page.screenshot({ path: path.join(evidence, filename), fullPage: true });
    row.screenshot = filename;
    report.screenshots.push(filename);
  }
  row.status = flagged ? "FLAGGED" : "PASS";
  report.results.push(row);
}

async function inspectDetails(code, route, mobile) {
  if (route.page === "faq") {
    const questions = page.locator("main button[aria-expanded]");
    assert.equal(await questions.count(), 10, "All FAQ questions render");
    for (const question of await questions.all()) await question.click();
    await page.waitForFunction(() => document.querySelectorAll("main .MuiCollapse-entered").length === 10);
    await inspect(code, route, "faq-expanded", mobile);
  } else if (
    route.page === "download" &&
    (await page.locator('button[aria-controls="server-panel"]').count())
  ) {
    await page.locator('button[aria-controls="server-panel"]').click();
    assert.ok(await page.locator("#server-panel").isVisible());
    assert.ok(!(await page.locator("#desktop-panel").isVisible()));
    await inspect(code, route, "download-server", mobile);
  }
}

try {
  // Do not build with a missing/partial locale: this preflight is deliberately before npm.
  for (const { code } of languages) {
    const file = path.join(root, "packages/paint-i18n/locales", code, "site.json");
    const bytes = await readFile(file);
    const catalog = JSON.parse(bytes.toString());
    assert.ok(Object.values(catalog).every((value) => typeof value === "string" && value.trim()));
    catalogs[code] = catalog;
    report.catalogs.push({
      code,
      file,
      keys: Object.keys(catalog).length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  assert.equal(languages.length, 13);
  for (const { code } of languages) {
    assert.deepEqual(
      Object.keys(catalogs[code]).sort(),
      Object.keys(catalogs.en).sort(),
      `${code}: complete site namespace`,
    );
    for (const route of routes) {
      for (const suffix of ["Title", "Description"]) {
        const key = `meta.${route.page}${suffix}`;
        assert.ok(catalogs[code][key], `${code}: ${key}`);
        if (code !== "en")
          assert.notEqual(catalogs[code][key], catalogs.en[key], `${code}: translated ${key}`);
      }
    }
    dictionaries[code] = await translationDictionary(code);
  }
  console.log("All 13 site catalogs valid; building ONLY paintwarden-site");
  const build = launchOwned(
    process.execPath,
    [
      path.join(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
      "run",
      "build",
      "--workspace",
      "paintwarden-site",
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}`,
        ASTRO_TELEMETRY_DISABLED: "1",
      },
    },
    path.join(evidence, "site-build.log"),
  );
  processes.push(build);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Site-only build exceeded 120 seconds")), 120000);
    build.child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    build.child.once("exit", (code, signal) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`Site build exited ${code}/${signal}`));
    });
  });
  await build.save();
  temporary = await mkdtemp(path.join(os.tmpdir(), "pv-i18n-site-"));
  const production = path.join(temporary, "dist");
  await cp(path.join(root, "apps/paintwarden-site/dist"), production, { recursive: true });
  const mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
  };
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      let file = path.resolve(production, `.${pathname}`);
      assert.ok(file.startsWith(`${production}${path.sep}`) || file === production);
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      const data = await readFile(file);
      response.writeHead(200, {
        "content-type": mime[path.extname(file)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  assert.ok(![3000, 3175].includes(port));
  origin = `http://127.0.0.1:${port}`;
  report.origin = origin;
  report.temporary = temporary;
  console.log(`Serving isolated production snapshot at ${origin}`);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    locale: "en-US",
    serviceWorkers: "block",
  });
  // Website-only test: never contact external release/support links or a user's server.
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  page = await context.newPage();
  page.on("pageerror", (error) =>
    report.runtimeErrors.push({ code: current, url: page.url(), error: error.message }),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      report.consoleErrors.push({ code: current, url: page.url(), text: message.text() });
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      report.failedResponses.push({ url: response.url(), status: response.status() });
  });
  await page.goto(origin);
  await ready("en", routes[0]);
  // MUI does not fire onChange for reselecting the current option. Start with
  // another real selection so English is tested as a persisted change too.
  await selectLanguage("es", routes[0]);
  for (const { code } of languages.filter(
    ({ code }) => !process.env.SITE_SMOKE_LOCALES || process.env.SITE_SMOKE_LOCALES.split(",").includes(code),
  )) {
    // Each locale is selected through the actual header control, never injected storage.
    await page.goto(origin);
    await ready(current, routes[0]);
    await selectLanguage(code, routes[0]);
    for (const route of routes) {
      if (route.page !== "home") await navigate(route, false);
      await inspect(code, route, route.page === "home" ? "selection" : "navigation", false);
      await page.reload();
      await inspect(code, route, "reload", false);
      await inspectDetails(code, route, false);
    }
    console.log(`Desktop ${code}: all five routes, metadata, picker, navigation and reload passed`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const { code } of languages.filter(
    ({ code }) => !process.env.SITE_SMOKE_LOCALES || process.env.SITE_SMOKE_LOCALES.split(",").includes(code),
  )) {
    await page.goto(origin);
    await ready(current, routes[0]);
    await selectLanguage(code, routes[0]);
    for (const route of routes) {
      // Include home in actual mobile-menu navigation (including closing/reopening it).
      await navigate(route, true);
      await inspect(code, route, "navigation", true);
      await inspectDetails(code, route, true);
    }
    console.log(`Mobile ${code}: all five routes checked at 390px`);
  }
  report.status =
    report.results.some((row) => row.status !== "PASS") ||
    report.runtimeErrors.length ||
    report.consoleErrors.length ||
    report.failedResponses.length
      ? "FAIL"
      : "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.stack;
  if (page && !page.isClosed()) {
    report.failureBody = await page
      .locator("body")
      .innerText()
      .catch(() => "unavailable");
    await page.screenshot({ path: path.join(evidence, "site-failure.png"), fullPage: true }).catch(() => {});
  }
} finally {
  await browser?.close();
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  for (const owned of processes.reverse()) {
    await stopOwned(owned.child);
    await owned.save();
  }
  if (temporary) await rm(temporary, { recursive: true, force: true });
  report.temporaryRemoved = Boolean(temporary);
  report.finishedAt = new Date().toISOString();
  report.counts = report.results.reduce(
    (counts, row) => ({ ...counts, [row.status]: (counts[row.status] || 0) + 1 }),
    {},
  );
  await writeFile(path.join(evidence, "site-results.json"), JSON.stringify(report, null, 2));
  console.log(
    `${report.status}: ${report.results.length} route/phase checks; ${JSON.stringify(report.counts)}. Evidence: ${evidence}/site-results.json`,
  );
  if (report.status !== "PASS") process.exitCode = 1;
}
