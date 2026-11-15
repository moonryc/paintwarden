// Fictitious generated catalog and procedural textured photographs only; no user/catalog inputs.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { zipSync } from "fflate";
import sharp from "sharp";

const id = (n) => `a1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export async function buildSyntheticPlugin({
  paints = 3000,
  schemes = 300,
  templates = 500,
  images = 800,
  version = "1.0.0",
} = {}) {
  const files = {};
  const assets = {};
  const catalog = { paints: [], schemes: [], templates: [] };
  const width = 1280,
    height = 960;
  for (let i = 0; i < images; i++) {
    const pixels = Buffer.alloc(width * height * 3);
    let seed = i + 1;
    for (let p = 0; p < pixels.length; p += 3) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const x = (p / 3) % width,
        y = Math.floor(p / 3 / width);
      const noise = (seed >>> 25) - 64;
      pixels[p] = Math.max(0, Math.min(255, 80 + x / 12 + noise / 4));
      pixels[p + 1] = Math.max(0, Math.min(255, 45 + y / 9 + noise / 4));
      pixels[p + 2] = Math.max(0, Math.min(255, 80 + (x + y) / 22 + noise / 4));
    }
    const bytes = await sharp(pixels, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 75 })
      .toBuffer();
    const name = `images/synthetic-${i}.jpg`;
    files[name] = bytes;
    assets[name] = { sha256: createHash("sha256").update(bytes).digest("hex") };
  }
  for (let i = 0; i < paints; i++)
    catalog.paints.push({
      id: id(i),
      name: `Synthetic pigment ${i}`,
      brand: "Fictitious Workshop",
      range: "Generated layers",
      type: "LAYER",
      colorHex: `#${((i * 7919) % 16777216).toString(16).padStart(6, "0")}`,
    });
  for (let i = 0; i < schemes; i++)
    catalog.schemes.push({
      id: id(10000 + i),
      name: `Synthetic scheme ${i}`,
      category: "BLUE",
      entries: [
        { id: id(20000 + i * 3), type: "STEP", label: "BASECOAT" },
        { id: id(20001 + i * 3), type: "PAINT", paintId: id(i % paints) },
        ...(images
          ? [{ id: id(20002 + i * 3), type: "IMAGE", imageUrl: `images/synthetic-${i % images}.jpg` }]
          : []),
      ],
    });
  for (let i = 0; i < templates; i++)
    catalog.templates.push({
      id: id(30000 + i),
      name: `Synthetic figure ${i}`,
      manufacturer: "Imaginary Miniatures",
      faction: "Generated Guard",
      categories: ["Synthetic"],
      imageUrl: images ? `images/synthetic-${(schemes + i) % images}.jpg` : null,
      schemeIds: schemes ? [id(10000 + (i % schemes))] : [],
      paints: [
        { paintId: id(i % paints), step: "BASECOAT", notes: "Generated fixture recipe", sortOrder: 0 },
      ],
    });
  files["source.json"] = Buffer.from(
    JSON.stringify({
      formatVersion: 1,
      name: "Synthetic large plugin",
      version,
      license: "CC0-1.0",
      attribution: "Procedural synthetic benchmark artwork",
      dependencies: [],
      catalog: "catalog.json",
      assets: "assets.json",
    }),
  );
  files["catalog.json"] = Buffer.from(JSON.stringify(catalog));
  files["assets.json"] = Buffer.from(JSON.stringify(assets));
  const zip = zipSync(files, { level: 0 });
  return {
    zip,
    counts: { paints, schemes, templates, images },
    imageBytes: Object.entries(files)
      .filter(([name]) => name.startsWith("images/"))
      .reduce((sum, [, bytes]) => sum + bytes.length, 0),
    dimensions: { width, height },
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = path.resolve(process.argv[2]);
  await mkdir(path.dirname(output), { recursive: true });
  const { zip, ...metadata } = await buildSyntheticPlugin();
  await writeFile(output, zip);
  await writeFile(`${output}.json`, JSON.stringify({ ...metadata, zipBytes: zip.length }, null, 2));
  console.log(output, metadata);
}
