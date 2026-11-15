import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { zipSync } from "fflate";

const root = fileURLToPath(new URL("../examples/demo-plugin/", import.meta.url));
export const demoPluginAsset = "paintwarden-demo-plugin.zip";

// Fixed timestamps and sorted entries make the developer fixture ZIP reproducible.
export function buildDemoPlugin() {
  const entries = {};
  for (const filename of ["source.json", "catalog.json", "assets.json", "logo.svg", "LICENSE", "README.md"]) {
    entries[filename] = [
      new Uint8Array(readFileSync(path.join(root, filename))),
      { mtime: new Date(2020, 0, 1, 0, 0, 0) },
    ];
  }
  for (const filename of readdirSync(path.join(root, "images")).sort()) {
    const relative = `images/${filename}`;
    entries[relative] = [
      new Uint8Array(readFileSync(path.join(root, relative))),
      { mtime: new Date(2020, 0, 1, 0, 0, 0) },
    ];
  }
  return zipSync(entries, { level: 9 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = path.resolve(process.argv[2] ?? `outputs/${demoPluginAsset}`);
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, buildDemoPlugin());
  console.log(output);
}
