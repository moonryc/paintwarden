import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

const directory = new URL("../public/images/app/", import.meta.url);
const names = [
  "workbench",
  "miniature",
  "recipe",
  "scan",
  "complement",
  "paints",
  "wishlist",
  "plugins",
  "settings",
  "schemes",
  "converter",
];

test("real app captures have every responsive WebP variant, fixed aspect ratio and bounded size", async () => {
  const expected = [];
  for (const name of names) {
    for (const phone of [false, true]) {
      const original = phone ? 780 : 1440;
      for (const width of phone ? [390, 780] : [720, 1080, 1440]) {
        const file = `${phone ? "phone-" : ""}${name}${width === original ? "" : `-${width}`}.webp`;
        expected.push(file);
        const url = new URL(file, directory);
        const metadata = await sharp(await readFile(url)).metadata();
        assert.equal(metadata.format, "webp", file);
        assert.equal(metadata.width, width, file);
        assert.equal(metadata.height, Math.round(((phone ? 1688 : 1000) * width) / original), file);
        assert.ok((await stat(url)).size < 150_000, `${file}: image budget`);
      }
    }
  }
  assert.deepEqual(
    (await readdir(directory)).filter((file) => path.extname(file) === ".webp").sort(),
    expected.sort(),
  );
});

test("phone Settings illustration reserves its intrinsic size and the guide image stays in sync", async () => {
  const images = new URL("../public/images/", import.meta.url);
  const png = await readFile(new URL("phone-access-settings.png", images));
  const documented = await readFile(
    new URL("../../../docs/images/phone-access-settings.png", import.meta.url),
  );
  assert.deepEqual(png, documented, "The downloadable guide's relative image URL is published unchanged");
  for (const format of ["png", "webp"]) {
    const url = new URL(`phone-access-settings.${format}`, images);
    const metadata = await sharp(await readFile(url)).metadata();
    assert.equal(metadata.width, 1440);
    assert.equal(metadata.height, 1050);
    assert.ok((await stat(url)).size < 150_000);
  }
  const source = await readFile(new URL("../src/site/pages/PhonePage.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("width={1440}") && source.includes("height={1050}"));
  assert.ok(source.includes('t("phone.settingsCaption")'));
});
