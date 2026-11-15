import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import plist from "plist";
import sharp from "sharp";

import { macRepresentations } from "./generate-icons.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

export async function checkPackagedIcons(appPath) {
  const contents = path.join(appPath, "Contents");
  const info = plist.parse(await readFile(path.join(contents, "Info.plist"), "utf8"));
  assert.equal(info.CFBundleIconName, "Icon", "Modern icon name must reference Assets.car");
  assert.equal(info.CFBundleIconFile, "icon.icns", "Legacy icon must reference the complete fallback");
  const resources = path.join(contents, "Resources");
  const catalog = await readFile(path.join(resources, "Assets.car"));
  assert.equal(catalog.toString("ascii", 0, 8), "BOMStore", "Assets.car must be a compiled asset catalog");
  assert.ok(catalog.length > 1000, "Asset catalog must not be empty/truncated");
  const icon = await readFile(path.join(resources, info.CFBundleIconFile));
  assert.equal(icon.toString("ascii", 0, 4), "icns");
  assert.equal(icon.readUInt32BE(4), icon.length);
  let offset = 8;
  for (const [type, size] of macRepresentations) {
    assert.equal(icon.toString("ascii", offset, offset + 4), type, `Missing ICNS representation ${type}`);
    const length = icon.readUInt32BE(offset + 4);
    assert.ok(length > 8 && offset + length <= icon.length);
    const metadata = await sharp(icon.subarray(offset + 8, offset + length)).metadata();
    assert.equal(metadata.width, size);
    assert.equal(metadata.height, size);
    offset += length;
  }
  assert.equal(offset, icon.length);
  assert.ok(
    icon.equals(await readFile(path.join(root, "apps/paintwarden-electron/build/icon.icns"))),
    "Packaged fallback must match the tested, complete no-padding source asset",
  );
  return {
    modernIconName: info.CFBundleIconName,
    assetCatalogBytes: catalog.length,
    legacyRepresentations: macRepresentations.length,
    maximumPixels: 1024,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (!process.argv[2])
    throw new Error("Usage: node scripts/check-packaged-icons.mjs /path/to/Paintwarden.app");
  console.log(JSON.stringify(await checkPackagedIcons(path.resolve(process.argv[2])), null, 2));
}
