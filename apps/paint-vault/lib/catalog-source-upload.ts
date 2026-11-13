import {
  ZipFormatError,
  ZipLimitError,
  readZipDirectory,
  type ZipEntry,
  type ZipSource,
} from "@paint-vault/core/zip-reader";

import type { SourceFileReader } from "./catalog-source-assets";
import { LOGO_MAX_BYTES, validLogoSvg } from "./github-source";
import { parseManifest, type Manifest } from "./source-format";
import { readZipEntry } from "./zip-entry";

// Reads a catalog source from an uploaded .zip instead of GitHub. The zip holds the same files as
// a source repository (source.json, catalog.json, assets.json, images/ and an optional logo.svg),
// either at its root, as Create plugin exports it, or inside one folder, as GitHub's
// "Download ZIP" packs a repository.

// Uploaded sources have IDs no GitHub repository can have, so they never collide with one.
export const UPLOAD_ID_PREFIX = "upload:";

const MIB = 1024 * 1024;
export const UPLOAD_MAX_BYTES = 250 * MIB;
// Checked against the zip's directory before anything is decompressed.
const UPLOAD_LIMITS = { maxEntries: 50_000, maxExpandedBytes: 1024 * MIB };
const MAX_DIRECTORY_BYTES = 32 * MIB;
const MANIFEST_MAX_BYTES = 300_000;

export const isUploadedSource = (id: string) => id.startsWith(UPLOAD_ID_PREFIX);

export type UploadedSource = {
  id: string;
  manifest: Manifest;
  read: SourceFileReader;
  logo: string | null;
};

async function zipEntries(source: ZipSource, limits: typeof UPLOAD_LIMITS) {
  let entries: ZipEntry[];
  try {
    entries = await readZipDirectory(source, {
      maxEntries: limits.maxEntries,
      maxDirectoryBytes: MAX_DIRECTORY_BYTES,
    });
  } catch (error) {
    if (error instanceof ZipLimitError) throw new Error("This plugin .zip holds too many files");
    if (error instanceof ZipFormatError) throw new Error("Choose a plugin .zip file");
    throw error;
  }
  // Only the files a source can use are kept; folders and macOS metadata are skipped.
  const kept = entries.filter(
    (entry) => !entry.name.endsWith("/") && !entry.name.split("/").includes("__MACOSX"),
  );
  if (kept.reduce((total, entry) => total + entry.size, 0) > limits.maxExpandedBytes)
    throw new Error("This plugin .zip is too large once unpacked");
  return kept;
}

// Files are unpacked one at a time, only when read.
export async function readSourceZip(bytes: Uint8Array, limits = UPLOAD_LIMITS): Promise<UploadedSource> {
  const source: ZipSource = {
    size: bytes.byteLength,
    read: async (offset, length) => bytes.subarray(offset, offset + length),
  };
  const entries = await zipEntries(source, limits);
  const names = entries.map((entry) => entry.name);
  const prefix = names.includes("source.json") ? "" : singleFolder(names);
  const files = new Map<string, ZipEntry>();
  for (const entry of entries)
    if (entry.name.startsWith(prefix)) files.set(entry.name.slice(prefix.length), entry);
  const read: SourceFileReader = async (path, maxBytes) => {
    const entry = files.get(path);
    if (!entry) throw new Error(`The plugin is missing ${path}`);
    if (entry.size > maxBytes) throw new Error(`${path} is too large`);
    try {
      return Buffer.from(await readZipEntry(source, entry, maxBytes));
    } catch (error) {
      if (error instanceof ZipFormatError) throw new Error(`${path} is damaged`);
      throw error;
    }
  };
  if (!files.has("source.json")) throw new Error("This .zip has no source.json. Choose a Paint Vault plugin");
  const manifestBytes = await read("source.json", MANIFEST_MAX_BYTES);
  let manifestData: unknown;
  try {
    manifestData = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    throw new Error("source.json isn't valid JSON");
  }
  const manifest = parseManifest(manifestData);
  const logoEntry = files.get("logo.svg");
  const logo =
    logoEntry && logoEntry.size <= LOGO_MAX_BYTES
      ? validLogoSvg(await read("logo.svg", LOGO_MAX_BYTES))
      : null;
  return { id: uploadedSourceId(manifest.name), manifest, read, logo };
}

// The plugin's name identifies it, ignoring case, accents and punctuation ("My Schemes" and
// "my-schemes" are the same plugin), so uploading a newer version of the same plugin updates it.
export function uploadedSourceId(name: string) {
  const slug = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z\d]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("Give the plugin a name in source.json");
  return `${UPLOAD_ID_PREFIX}${slug}`;
}

function singleFolder(names: string[]) {
  const folders = new Set(names.map((name) => (name.includes("/") ? name.split("/")[0] : "")));
  const [folder] = folders;
  return folders.size === 1 && folder ? `${folder}/` : "";
}
