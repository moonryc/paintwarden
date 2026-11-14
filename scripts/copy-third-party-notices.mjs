import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

// Keep all source offers and verbatim texts available without a network connection.
export async function copyThirdPartyNotices(destination, source = root) {
  if (path.resolve(destination) === path.resolve(source))
    throw new Error("Notice output must not overwrite the source root");
  await mkdir(destination, { recursive: true });
  for (const file of ["LICENSE", "THIRD_PARTY_NOTICES.txt", "third-party"]) {
    await rm(path.join(destination, file), { recursive: true, force: true });
    await cp(path.join(source, file), path.join(destination, file), { recursive: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 3)
    throw new Error("Usage: node scripts/copy-third-party-notices.mjs <output-dir> [...output-dir]");
  for (const destination of process.argv.slice(2)) {
    if (destination.startsWith("-")) throw new Error(`Unexpected notice-copy option: ${destination}`);
    await copyThirdPartyNotices(path.resolve(destination));
  }
}
