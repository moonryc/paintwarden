// Only accepts the known synthetic capture filenames, never a personal vault or image directory.
// node scripts/optimize-site-screenshots.mjs /absolute/site-capture-artifacts
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

assert.ok(process.argv[2], "Pass the output directory from e2e/site-capture.mjs");
const source = path.resolve(process.argv[2]);
const output = path.resolve("apps/paintwarden-site/public/images/app");
await mkdir(output, { recursive: true });
const manifest = [];
for (const name of [
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
]) {
  for (const phone of [false, true]) {
    const stem = `${phone ? "phone-" : ""}${name}`;
    const input = path.join(source, `${stem}.png`);
    const metadata = await sharp(input).metadata();
    assert.equal(metadata.width, phone ? 780 : 1440, `${stem}: capture width`);
    assert.equal(metadata.height, phone ? 1688 : 1000, `${stem}: capture height`);
    for (const width of phone ? [390, 780] : [720, 1080, 1440]) {
      const file = `${stem}${width === metadata.width ? "" : `-${width}`}.webp`;
      const info = await sharp(input)
        .resize({ width })
        .webp({ quality: 88, effort: 6 })
        .toFile(path.join(output, file));
      manifest.push({ file, width: info.width, height: info.height, bytes: info.size });
    }
  }
}
await writeFile(path.join(source, "optimized-images.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`${manifest.length} WebP files; ${manifest.reduce((n, i) => n + i.bytes, 0)} bytes total`);
