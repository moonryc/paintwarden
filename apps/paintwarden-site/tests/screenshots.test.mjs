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
