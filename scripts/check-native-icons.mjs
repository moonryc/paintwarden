import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import sharp from "sharp";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const outputIndex = process.argv.indexOf("--output");
if (outputIndex === -1 || !process.argv[outputIndex + 1]) {
  throw new Error(
    "Usage: node scripts/check-native-icons.mjs --output /absolute/evidence-directory (macOS + Xcode >=26)",
  );
}
const output = path.resolve(process.argv[outputIndex + 1]);
await mkdir(output, { recursive: true });
const { generateAssetCatalogForIcon } = createRequire(import.meta.url)(
  "app-builder-lib/out/util/macosIconComposer.js",
);
const compiled = await generateAssetCatalogForIcon(
  path.join(root, "apps/paintwarden-electron/build/icon.icon"),
);
await writeFile(path.join(output, "Assets.car"), compiled.assetCatalog);
await writeFile(path.join(output, "actool-fallback.icns"), compiled.icnsFile);
assert.ok(compiled.assetCatalog.length > 1000);
const { stdout: catalogInfo } = await run("xcrun", ["assetutil", "--info", path.join(output, "Assets.car")]);
await writeFile(path.join(output, "assetutil-info.json"), catalogInfo);
const catalogEntries = JSON.parse(catalogInfo);
const modernSizes = catalogEntries
  .filter((entry) => entry.Name === "Icon" && entry.AssetType === "Icon Image")
  .map((entry) => entry.PixelWidth);
for (const size of [32, 64, 128, 256, 512, 1024])
  assert.ok(modernSizes.includes(size), `Missing modern ${size}px image`);

// Xcode's developer/usr/bin/ictool is an asset compiler, not the Composer renderer.
const { stdout: selectedDeveloper } = await run("xcode-select", ["-p"]);
const renderer = path.resolve(
  selectedDeveloper.trim(),
  "../Applications/Icon Composer.app/Contents/Executables/ictool",
);
const renders = [];
for (const [rendition, size] of [
  ["Default", 1024],
  ["Dark", 1024],
  ["Default", 128],
  ["Default", 64],
  ["Default", 32],
  ["Default", 16],
]) {
  const filename = path.join(output, `composer-${rendition.toLowerCase()}-${size}.png`);
  await run(renderer, [
    path.join(root, "apps/paintwarden-electron/build/icon.icon"),
    "--export-image",
    "--output-file",
    filename,
    "--platform",
    "macOS",
    "--rendition",
    rendition,
    "--width",
    String(size),
    "--height",
    String(size),
    "--scale",
    "1",
  ]);
  const bytes = await readFile(filename);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, size);
  assert.equal(info.height, size);
  const pixel = (x, y) => [...data.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)];
  const middle = Math.floor(size / 2);
  for (const [x, y] of [
    [middle, 1],
    [1, middle],
    [middle, size - 2],
    [size - 2, middle],
  ]) {
    const edge = pixel(x, y);
    assert.ok(edge[3] > 150, `${rendition} ${size}px: no transparent inset canvas`);
    assert.ok(Math.min(...edge.slice(0, 3)) < 220, `${rendition} ${size}px: no white edge/container`);
  }
  const pot = pixel(middle, Math.floor(size * 0.65));
  assert.ok(pot[0] > 100 && pot[1] > 80 && pot[2] < 120, "Paint pot remains visible and yellow");
  renders.push({ rendition, size, bytes });
}
const uri = (bytes) => `data:image/png;base64,${bytes.toString("base64")}`;
const svg = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850">',
  '<rect width="1200" height="850" fill="#e5e7eb"/>',
  '<g font-family="Helvetica,Arial,sans-serif" fill="#171717">',
  '<text x="24" y="36" font-size="24">Paintwarden — native Icon Composer rendering</text>',
  '<text x="24" y="65" font-size="16">Real .icon asset compiled by electron-builder / actool. No legacy white container.</text>',
  '<rect x="16" y="84" width="576" height="576" fill="white"/>',
  '<rect x="608" y="84" width="576" height="576" fill="#171717"/>',
  `<image x="48" y="116" width="512" height="512" href="${uri(renders[0].bytes)}"/>`,
  `<image x="640" y="116" width="512" height="512" href="${uri(renders[1].bytes)}"/>`,
  '<text x="24" y="690" font-size="17">Default over white</text>',
  '<text x="616" y="690" font-size="17">Dark over charcoal</text>',
];
let x = 24;
for (const render of renders.slice(2)) {
  svg.push(
    `<image x="${x}" y="712" width="${render.size}" height="${render.size}" href="${uri(render.bytes)}"/>`,
  );
  svg.push(`<text x="${x + render.size + 12}" y="735" font-size="15">${render.size}px native</text>`);
  x += 294;
}
svg.push("</g></svg>");
await sharp(Buffer.from(svg.join("\n")))
  .png()
  .toFile(path.join(output, "native-icon-contact-sheet.png"));
const { stdout: version } = await run("xcodebuild", ["-version"]);
await writeFile(
  path.join(output, "native-icon-report.json"),
  `${JSON.stringify({ xcode: version.trim(), assetCatalogBytes: compiled.assetCatalog.length, actoolFallbackBytes: compiled.icnsFile.length, renderChecks: renders.map(({ rendition, size }) => ({ rendition, size, edgeToEdgeNoWhiteContainer: true })), note: "This is rendered-asset evidence, not a Finder/Dock UI screenshot. afterpack-icons.cjs replaces actool's incomplete legacy fallback with the complete generated ICNS." }, null, 2)}\n`,
);
console.log(`PASS: compiled Assets.car, rendered six native representations; evidence: ${output}`);
