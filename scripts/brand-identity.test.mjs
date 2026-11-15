import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");
const json = async (path) => JSON.parse(await text(path));

test("web and desktop identities use the untranslated Paintwarden brand", async () => {
  const html = await text("apps/paintwarden-web/index.html");
  assert.match(html, /<title>Paintwarden<\/title>/);
  assert.match(html, /name="apple-mobile-web-app-title" content="Paintwarden"/);
  const manifest = await json("apps/paintwarden-web/public/manifest.webmanifest");
  assert.equal(manifest.name, "Paintwarden");
  assert.equal(manifest.short_name, "Paintwarden");
  const desktop = await json("apps/paintwarden-electron/package.json");
  assert.equal(desktop.build.productName, "Paintwarden");
  assert.match(await text("apps/paintwarden-electron/main.cjs"), /title: "Paintwarden"/);
  assert.match(
    await text("apps/paintwarden-site/src/layouts/SiteLayout.astro"),
    /property="og:site_name" content="Paintwarden"/,
  );
});

test("all thirteen locales retain the exact app and site brand", async () => {
  const locales = await readdir(new URL("packages/paint-i18n/locales/", root));
  assert.equal(locales.length, 13);
  for (const locale of locales) {
    const prefix = `packages/paint-i18n/locales/${locale}/`;
    assert.equal((await json(`${prefix}pages.json`)).layoutBrand, "Paintwarden", locale);
    assert.equal((await json(`${prefix}site.json`))["primitives.paintwarden"], "Paintwarden", locale);
    for (const file of await readdir(new URL(prefix, root))) {
      assert.doesNotMatch(await text(`${prefix}${file}`), /miniature\s+paintwarden/i, `${locale}/${file}`);
    }
  }
});
