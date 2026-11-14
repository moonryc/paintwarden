import { lstat, readdir, readFile, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const wasmPackages = new Set([
  "@img/sharp-wasm32",
  "@img/sharp-freebsd-wasm32",
  "@img/sharp-webcontainers-wasm32",
]);
const helperPackages = new Set([
  "@emnapi/runtime",
  "@emnapi/core",
  "@emnapi/wasi-threads",
  "@tybys/wasm-util",
]);

// Remove only the unused sharp fallback, never other libraries' WASM. Do this in
// production staging, not in the source lockfile/all-platform license inventory.
export async function pruneSharpWasm(directory) {
  const packages = [];
  async function visit(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue; // Do not follow workspace links.
      const location = path.join(folder, entry.name);
      if (entry.name === "node_modules") await visitModules(location);
      else await visit(location);
    }
  }
  async function visitModules(modules) {
    for (const entry of await readdir(modules, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === ".bin") continue;
      const location = path.join(modules, entry.name);
      if (entry.name.startsWith("@")) {
        await visitModules(location);
        continue;
      }
      const manifest = await readFile(path.join(location, "package.json"), "utf8").then(JSON.parse);
      packages.push({ location, manifest });
      if (await lstat(path.join(location, "node_modules")).catch(() => null))
        await visitModules(path.join(location, "node_modules"));
    }
  }
  // The argument is a staging root containing one or more node_modules trees.
  await visit(directory);
  const removed = [];
  for (const item of packages) {
    if (wasmPackages.has(item.manifest.name)) {
      await rm(item.location, { recursive: true, force: true });
      removed.push(item);
    }
  }
  // Some tools also use emnapi. Retain helpers if any surviving package declares
  // them, including optional consumers; repeat to collect orphan helper chains.
  let changed;
  do {
    changed = false;
    for (const item of packages) {
      if (removed.includes(item) || !helperPackages.has(item.manifest.name)) continue;
      const needed = packages.some(
        (other) =>
          other !== item &&
          !removed.includes(other) &&
          [
            other.manifest.dependencies,
            other.manifest.optionalDependencies,
            other.manifest.peerDependencies,
          ].some((deps) => deps && Object.hasOwn(deps, item.manifest.name)),
      );
      if (!needed) {
        await rm(item.location, { recursive: true, force: true });
        removed.push(item);
        changed = true;
      }
    }
  } while (changed);
  for (const item of removed) {
    const scope = path.dirname(item.location);
    if (path.basename(scope).startsWith("@")) {
      await rmdir(scope).catch((error) => {
        if (!["ENOENT", "ENOTEMPTY"].includes(error.code)) throw error;
      });
    }
  }
  return removed.map((item) => path.relative(directory, item.location)).sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error("Usage: node scripts/prune-sharp-wasm.mjs <staging-root>");
  console.log("Removed unused sharp WASM packages:", await pruneSharpWasm(path.resolve(process.argv[2])));
}
