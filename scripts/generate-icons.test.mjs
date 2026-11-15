import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import plist from "plist";

import { checkPackagedIcons } from "./check-packaged-icons.mjs";
import { generateIconAssets, macRepresentations, windowsSizes } from "./generate-icons.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const desktop = "apps/paintwarden-electron/build";
const web = "apps/paintwarden-web/public";
const assetsPromise = generateIconAssets();

async function checkPixels(bytes, size, rounded) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, size);
  assert.equal(info.height, size);
  const pixel = (x, y) => [...data.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)];
  const middle = Math.floor(size / 2);
  for (const [x, y] of [
    [middle, 0],
    [0, middle],
    [middle, size - 1],
    [size - 1, middle],
  ]) {
    // The stroked vector boundary is antialiased; a whole transparent inset row is forbidden.
    assert.ok(pixel(x, y)[3] >= 200, `Canvas edge must be filled at ${size}px (${x},${y})`);
  }
  assert.equal(pixel(0, 0)[3], rounded ? 0 : 255, "Only rounded variants have transparent corners");
  for (let i = 0; i < data.length; i += 4) {
    assert.ok(!(data[i + 3] > 0 && Math.min(data[i], data[i + 1], data[i + 2]) > 240), "No white padding");
    if (!rounded) assert.equal(data[i + 3], 255, "OS-masked icons must have an opaque full canvas");
  }
  const pot = pixel(middle, Math.floor(size * 0.65));
  assert.ok(pot[0] > 150 && pot[1] > 120 && pot[2] < 100, "Brand's yellow paint pot is retained");
}

test("committed icon assets exactly match vector-source generation", async () => {
  for (const [relative, bytes] of await assetsPromise) {
    assert.deepEqual(await readFile(path.join(root, relative)), bytes, relative);
  }
});

test("ICNS includes every standard 1x/2x representation without padding", async () => {
  const assets = await assetsPromise;
  const bytes = assets.get(`${desktop}/icon.icns`);
  assert.equal(bytes.toString("ascii", 0, 4), "icns");
  assert.equal(bytes.readUInt32BE(4), bytes.length);
  let offset = 8;
  for (const [type, size] of macRepresentations) {
    assert.equal(bytes.toString("ascii", offset, offset + 4), type);
    const length = bytes.readUInt32BE(offset + 4);
    assert.ok(length > 8 && offset + length <= bytes.length);
    await checkPixels(bytes.subarray(offset + 8, offset + length), size, true);
    offset += length;
  }
  assert.equal(offset, bytes.length);
  await checkPixels(assets.get(`${desktop}/icon.png`), 1024, true);
});

test("Windows ICO has ten valid RGBA frames, no white frame or canvas inset", async () => {
  const bytes = (await assetsPromise).get(`${desktop}/icon.ico`);
  assert.equal(bytes.readUInt16LE(0), 0);
  assert.equal(bytes.readUInt16LE(2), 1);
  assert.equal(bytes.readUInt16LE(4), windowsSizes.length);
  let offset = 6 + windowsSizes.length * 16;
  for (const [index, size] of windowsSizes.entries()) {
    const entry = 6 + index * 16;
    assert.equal(bytes[entry] || 256, size);
    assert.equal(bytes[entry + 1] || 256, size);
    assert.equal(bytes.readUInt16LE(entry + 4), 1);
    assert.equal(bytes.readUInt16LE(entry + 6), 32);
    assert.equal(bytes.readUInt32LE(entry + 12), offset);
    const length = bytes.readUInt32LE(entry + 8);
    await checkPixels(bytes.subarray(offset, offset + length), size, true);
    offset += length;
  }
  assert.equal(offset, bytes.length);
});

test("PWA and Apple icons are opaque edge-to-edge; maskable foreground stays inside safe circle", async () => {
  const assets = await assetsPromise;
  for (const [name, size] of [
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["apple-touch-icon.png", 180],
    ["icon-maskable-512.png", 512],
  ]) {
    await checkPixels(assets.get(`${web}/${name}`), size, false);
  }
  const { data, info } = await sharp(assets.get(`${web}/icon-maskable-512.png`))
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const index = (y * info.width + x) * info.channels;
      const foreground = data[index] !== 44 || data[index + 1] !== 44 || data[index + 2] !== 44;
      if (foreground)
        assert.ok(
          Math.hypot(x + 0.5 - 256, y + 0.5 - 256) <= 512 * 0.4,
          "Foreground must survive the PWA maskable safe circle",
        );
    }
  }
  const manifest = JSON.parse(await readFile(path.join(root, web, "manifest.webmanifest"), "utf8"));
  assert.ok(
    manifest.icons.some((icon) => icon.src === "/icon-maskable-512.png" && icon.purpose === "maskable"),
  );
});

test("modern icon uses a full charcoal fill and a 1024px foreground, not a pre-rounded inset", async () => {
  const assets = await assetsPromise;
  const document = JSON.parse(assets.get(`${desktop}/icon.icon/icon.json`));
  assert.deepEqual(document.fill, { solid: "srgb:0.17255,0.17255,0.17255,1.00000" });
  assert.deepEqual(document["supported-platforms"], { squares: ["macOS"] });
  const svg = assets.get(`${desktop}/icon.icon/Assets/PaintPot.svg`).toString();
  assert.match(svg, /width="1024" height="1024"/);
  assert.ok(!svg.includes("<rect"), "The root fill, not a pre-rounded raster layer, provides the background");
});

test("afterPack keeps modern catalog and restores the complete legacy fallback", async () => {
  const afterPackIcons = createRequire(import.meta.url)(`../${desktop}/afterpack-icons.cjs`);
  const directory = await mkdtemp(path.join(tmpdir(), "paintwarden-icons-"));
  try {
    const resources = path.join(directory, "Paintwarden.app", "Contents", "Resources");
    await mkdir(resources, { recursive: true });
    await writeFile(path.join(resources, "Assets.car"), "modern-catalog-fixture");
    await writeFile(path.join(resources, "icon.icns"), "incomplete-actool-fixture");
    const info = { CFBundleIconFile: "icon.icns", CFBundleIconName: "Icon" };
    const infoPath = path.join(directory, "Paintwarden.app", "Contents", "Info.plist");
    const originalInfo = plist.build(info);
    await writeFile(infoPath, originalInfo);
    await afterPackIcons({
      electronPlatformName: "darwin",
      appOutDir: directory,
      packager: { appInfo: { productFilename: "Paintwarden" } },
    });
    assert.deepEqual(
      await readFile(path.join(resources, "icon.icns")),
      (await assetsPromise).get(`${desktop}/icon.icns`),
    );
    assert.equal(await readFile(path.join(resources, "Assets.car"), "utf8"), "modern-catalog-fixture");
    await afterPackIcons({ electronPlatformName: "win32" });
    const catalog = Buffer.alloc(1024);
    catalog.write("BOMStore");
    await writeFile(path.join(resources, "Assets.car"), catalog);
    assert.equal(await readFile(infoPath, "utf8"), originalInfo, "Modern plist references must not change");
    assert.equal(
      (await checkPackagedIcons(path.join(directory, "Paintwarden.app"))).legacyRepresentations,
      10,
    );
    await writeFile(infoPath, plist.build({ ...info, CFBundleIconName: "Wrong" }));
    await assert.rejects(checkPackagedIcons(path.join(directory, "Paintwarden.app")), /Modern icon name/);
    await writeFile(infoPath, plist.build(info));
    await writeFile(path.join(resources, "Assets.car"), "Not a catalog");
    await assert.rejects(
      checkPackagedIcons(path.join(directory, "Paintwarden.app")),
      /compiled asset catalog/,
    );
    await writeFile(path.join(resources, "Assets.car"), catalog);
    await writeFile(path.join(resources, "icon.icns"), "incomplete-actool-fixture");
    await assert.rejects(checkPackagedIcons(path.join(directory, "Paintwarden.app")));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
