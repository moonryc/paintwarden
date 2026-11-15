import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const desktop = "apps/paintwarden-electron/build";
const web = "apps/paintwarden-web/public";

// Standard macOS iconset: every 1x and 2x representation from 16 to 512 points.
export const macRepresentations = [
  ["icp4", 16],
  ["ic11", 32],
  ["icp5", 32],
  ["ic12", 64],
  ["ic07", 128],
  ["ic13", 256],
  ["ic08", 256],
  ["ic14", 512],
  ["ic09", 512],
  ["ic10", 1024],
];
export const windowsSizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];

function icns(images) {
  const chunks = macRepresentations.map(([type, size]) => {
    const image = images.get(size);
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, "ascii");
    header.writeUInt32BE(image.length + 8, 4);
    return Buffer.concat([header, image]);
  });
  const header = Buffer.alloc(8);
  header.write("icns");
  header.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
  return Buffer.concat([header, ...chunks]);
}

function ico(images) {
  // PNG-compressed, 32-bit RGBA frames (Windows Vista and newer).
  const header = Buffer.alloc(6 + windowsSizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(windowsSizes.length, 4);
  let offset = header.length;
  const frames = windowsSizes.map((size, index) => {
    const image = images.get(size);
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size;
    header[entry + 1] = header[entry];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
    return image;
  });
  return Buffer.concat([header, ...frames]);
}

export async function generateIconAssets() {
  const svg = await readFile(path.join(root, web, "favicon.svg"), "utf8");
  const maskable = await readFile(path.join(root, web, "icon-maskable.svg"), "utf8");
  // iOS and maskable launchers apply their own corner mask: do not bake white corners in.
  const square = svg.replace(/<rect\b[^>]*\/>/, '<rect width="64" height="64" fill="#2c2c2c"/>');
  // Retain the existing bitmap encoding/density as well as the established pixels.
  const png = (source, size, density = (144 * size) / 64) =>
    sharp(Buffer.from(source), { density })
      .resize(size, size)
      .png({ compressionLevel: 9, adaptiveFiltering: false })
      .toBuffer();
  // Icon Composer takes a full 1024px foreground layer and owns the corner mask itself.
  // A solid root fill (not a pre-rounded raster layer) avoids the legacy OS white container.
  const composerArtwork = svg
    .replace(/<rect\b[^>]*\/>/, "")
    .replace('viewBox="0 0 64 64"', 'width="1024" height="1024" viewBox="0 0 64 64"');
  const composerDocument = {
    fill: { solid: "srgb:0.17255,0.17255,0.17255,1.00000" },
    groups: [{ layers: [{ "image-name": "PaintPot.svg", name: "Paint pot" }], name: "Paint pot" }],
    "supported-platforms": { squares: ["macOS"] },
  };
  const sizes = new Set([...macRepresentations.map(([, size]) => size), ...windowsSizes]);
  const images = new Map(
    await Promise.all(
      [...sizes].map(async (size) => [size, await png(svg, size, size === 20 ? 46 : undefined)]),
    ),
  );
  return new Map([
    [`${desktop}/icon.png`, images.get(1024)],
    [`${desktop}/icon.icns`, icns(images)],
    [`${desktop}/icon.ico`, ico(images)],
    [`${desktop}/icon.icon/icon.json`, Buffer.from(`${JSON.stringify(composerDocument, null, 2)}\n`)],
    [`${desktop}/icon.icon/Assets/PaintPot.svg`, Buffer.from(composerArtwork)],
    [`${web}/icon-192.png`, await png(square, 192)],
    [`${web}/icon-512.png`, await png(square, 512)],
    [`${web}/apple-touch-icon.png`, await png(square, 180, 406)],
    [`${web}/icon-maskable-512.png`, await png(maskable, 512, 576)],
  ]);
}

export async function writeIconPreview(assets, output) {
  const uri = (bytes) => `data:image/png;base64,${bytes.toString("base64")}`;
  const font = 'font-family="-apple-system,Helvetica,Arial,sans-serif"';
  const parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">',
    '<rect width="1200" height="900" fill="#e5e7eb"/>',
    `<g ${font} fill="#171717"><text x="28" y="36" font-size="23">Paintwarden — actual generated icon pixels</text>`,
    '<text x="28" y="65" font-size="15">Transparent rounded corners only. No white frame, inset canvas, or added macOS padding.</text>',
    '<rect x="24" y="84" width="564" height="320" rx="12" fill="white"/>',
    '<rect x="612" y="84" width="564" height="320" rx="12" fill="#171717"/>',
  ];
  const image = assets.get(`${desktop}/icon.png`);
  for (const [x, fill] of [
    [40, "#171717"],
    [628, "#eeeeee"],
  ]) {
    parts.push(`<image x="${x}" y="100" width="288" height="288" href="${uri(image)}"/>`);
    parts.push(`<text x="${x + 304}" y="140" fill="${fill}" font-size="16">macOS .icns</text>`);
    parts.push(`<text x="${x + 304}" y="165" fill="${fill}" font-size="14">1024px representation</text>`);
    parts.push(
      `<text x="${x + 304}" y="190" fill="${fill}" font-size="14">over ${x === 40 ? "white" : "dark"}</text>`,
    );
  }
  parts.push(
    '<text x="28" y="442" font-size="18">macOS representations at native pixel size (512/1024 shown above)</text>',
  );
  const bytes = assets.get(`${desktop}/icon.icns`);
  let offset = 8;
  let x = 28;
  while (offset < bytes.length) {
    const type = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32BE(offset + 4);
    const size = macRepresentations.find(([candidate]) => candidate === type)[1];
    if (size <= 256) {
      parts.push(
        `<image x="${x}" y="466" width="${size}" height="${size}" href="${uri(bytes.subarray(offset + 8, offset + length))}"/>`,
      );
      parts.push(`<text x="${x}" y="${480 + size}" font-size="12">${type}: ${size}px</text>`);
      x += Math.max(size, 66) + 16;
    }
    offset += length;
  }
  const windows = assets.get(`${desktop}/icon.ico`);
  const lastEntry = 6 + (windowsSizes.length - 1) * 16;
  const windowsFrame = windows.subarray(windows.readUInt32LE(lastEntry + 12));
  const examples = [
    ["Windows .ico (256px frame)", windowsFrame],
    ["PWA any (512px)", assets.get(`${web}/icon-512.png`)],
    ["PWA maskable (512px)", assets.get(`${web}/icon-maskable-512.png`)],
    ["Apple touch (180px)", assets.get(`${web}/apple-touch-icon.png`)],
  ];
  for (const [index, [label, bytes]] of examples.entries()) {
    const x = 28 + index * 294;
    parts.push(`<image x="${x}" y="770" width="96" height="96" href="${uri(bytes)}"/>`);
    parts.push(`<text x="${x + 106}" y="806" font-size="12">${label}</text>`);
    parts.push(`<text x="${x + 106}" y="829" font-size="12">No opaque white pixels</text>`);
  }
  parts.push("</g></svg>");
  await mkdir(path.dirname(output), { recursive: true });
  await sharp(Buffer.from(parts.join("\n")))
    .png()
    .toFile(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const assets = await generateIconAssets();
  const check = process.argv.includes("--check");
  for (const [relative, bytes] of assets) {
    const filename = path.join(root, relative);
    if (check) {
      if (!(await readFile(filename)).equals(bytes)) throw new Error(`Stale generated icon: ${relative}`);
    } else {
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, bytes);
    }
    console.log(`${check ? "Verified" : "Generated"} ${relative}`);
  }
  const preview = process.argv.indexOf("--preview");
  if (preview !== -1) {
    if (!process.argv[preview + 1]) throw new Error("--preview requires an output PNG path");
    await writeIconPreview(assets, path.resolve(process.argv[preview + 1]));
  }
}
