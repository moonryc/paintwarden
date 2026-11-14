import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, open, rm, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import { Logger } from "@nestjs/common";
import {
  ZipFormatError,
  ZipLimitError,
  readZipDirectory,
  type ZipEntry,
  type ZipSource,
} from "@paintwarden/core/zip-reader";
import { eq } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import { getDb, shrinkDatabase } from "../db";
import { catalogSources, folders, paintSubstitutions } from "../db/schema";

import { APP_VERSION } from "./app-version.ts";
import {
  BACKUP_FORMAT,
  BACKUP_IMAGE_FOLDER,
  BACKUP_MANIFEST,
  BACKUP_SECTIONS,
  BACKUP_VERSION,
  BACKUP_V1_SECTIONS,
  SECTION_KEYS,
  pickFields,
  type BackupManifest,
  type BackupRow,
  type BackupSectionKey,
  type BackupTables,
} from "./backup-format.ts";
import { serializeImageMutation } from "./image-mutations";
import {
  deleteImages,
  holdImages,
  imageExists,
  isImageKey,
  keepImage,
  loadImage,
  releaseImages,
  writeImage,
} from "./image-store.ts";
import { readZipEntry } from "./zip-entry.ts";
import { writeZip, type ZipFile } from "./zip-writer.ts";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type RestoreMode = "replace" | "merge";

// A problem with the backup file itself, reported to the user as is.
export class BackupError extends Error {}

const SOURCE_IMAGE_PATH = "/api/catalog-source-images/";
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
// Just under the longest string JSON.parse can be given.
const MAX_MANIFEST_BYTES = 500 * 1024 * 1024;
const GIB = 1024 * 1024 * 1024;
// The largest backup file a restore accepts. Images are stored uncompressed, so a real backup
// expands very little; the expanded limit stops a small file claiming to hold far more.
export const MAX_BACKUP_BYTES = 16 * GIB;
const MAX_EXPANDED_BYTES = 32 * GIB;
const ZIP_LIMITS = { maxEntries: 200_000, maxDirectoryBytes: 64 * 1024 * 1024 };
const uploadDirectory = path.join(
  process.env.DATA_DIR || path.resolve(process.cwd(), "../../data"),
  "restore-uploads",
);

// The fields that refer to image files: photos, template images, catalog source images, and scheme
// images, which point at catalog source images by URL. A required field can't be cleared, so a row
// whose required image is missing is left out of a backup.
type ImageField = { field: string; url?: true; required?: true };
const IMAGE_FIELDS: Partial<Record<BackupSectionKey, ImageField[]>> = {
  pluginImages: [{ field: "imageKey", required: true }],
  schemeImages: [
    { field: "imageUrl", url: true, required: true },
    { field: "thumbnailUrl", url: true },
  ],
  templates: [{ field: "imageKey" }],
  miniatures: [{ field: "imageKey" }],
};
const IMAGE_SECTIONS = Object.keys(IMAGE_FIELDS) as BackupSectionKey[];

// The image key a field's value refers to, or null when it refers to none.
function imageRef(value: unknown, { url }: ImageField) {
  if (typeof value !== "string" || !value) return null;
  if (!url) return value;
  return value.startsWith(SOURCE_IMAGE_PATH) ? value.slice(SOURCE_IMAGE_PATH.length) : null;
}

function* imageRefs(tables: BackupTables) {
  for (const key of IMAGE_SECTIONS)
    for (const row of tables[key] ?? [])
      for (const field of IMAGE_FIELDS[key]!) {
        const ref = imageRef(row[field.field], field);
        if (ref !== null) yield ref;
      }
}

const referencedImageKeys = (tables: BackupTables) => new Set([...imageRefs(tables)].filter(isImageKey));

// The vault's rows that can refer to images.
const imageTables = (db: Db | Tx): BackupTables =>
  Object.fromEntries(
    IMAGE_SECTIONS.map((key) => [key, db.select().from(BACKUP_SECTIONS[key].table).all() as BackupRow[]]),
  );

// Clears the references to images the backup couldn't include, so it refers only to images it
// holds. A row whose required image is missing is left out.
function withoutMissingImages(tables: BackupTables, missing: Set<string>): BackupTables {
  if (!missing.size) return tables;
  const result = { ...tables };
  for (const key of IMAGE_SECTIONS) {
    const fields = IMAGE_FIELDS[key]!;
    result[key] = (tables[key] ?? []).flatMap((row) => {
      const lost = fields.filter((field) => {
        const ref = imageRef(row[field.field], field);
        return ref !== null && missing.has(ref);
      });
      if (!lost.length) return [row];
      if (lost.some((field) => field.required)) return [];
      return [{ ...row, ...Object.fromEntries(lost.map((field) => [field.field, null])) }];
    });
  }
  return result;
}

// Takes one consistent snapshot of the vault and holds the images it refers to, so a photo
// replaced or deleted during the export is still there to be read.
function snapshot() {
  return getDb().transaction((tx) => {
    const tables: BackupTables = {};
    for (const key of SECTION_KEYS)
      tables[key] = tx
        .select()
        .from(BACKUP_SECTIONS[key].table)
        .all()
        .map((row) => pickFields(key, row as BackupRow));
    const keys = referencedImageKeys(tables);
    holdImages(keys);
    return { tables, keys };
  });
}

// The snapshot is taken when the download starts. Images are read one at a time, and the manifest
// comes last so it lists, and refers to, only the images that were actually written.
async function* backupFiles(): AsyncGenerator<ZipFile> {
  const { tables, keys } = snapshot();
  try {
    const images: string[] = [];
    for (const key of [...keys].sort()) {
      const image = await loadImage(key);
      if (!image) continue;
      images.push(key);
      // Images are already compressed, so they are stored as they are.
      yield { name: `${BACKUP_IMAGE_FOLDER}${key}`, data: image.bytes };
    }
    const written = new Set(images);
    const missing = new Set([...imageRefs(tables)].filter((key) => !written.has(key)));
    if (missing.size)
      Logger.warn(`Backup left out ${missing.size} image(s) missing from the vault's image folder`);
    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      tables: withoutMissingImages(tables, missing),
      images,
    };
    yield { name: BACKUP_MANIFEST, data: Buffer.from(JSON.stringify(manifest)), compress: true };
  } finally {
    await deleteImages(releaseImages(keys));
  }
}

export function createBackup() {
  const zip = Readable.from(writeZip(backupFiles()), { objectMode: false });
  return Readable.toWeb(zip) as ReadableStream<Uint8Array>;
}

function readManifest(value: unknown, mode: RestoreMode): BackupTables {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BackupError("This isn't a Paintwarden backup");
  const manifest = value as Record<string, unknown>;
  if (manifest.format !== BACKUP_FORMAT) throw new BackupError("This isn't a Paintwarden backup");
  if (manifest.version !== 1 && manifest.version !== BACKUP_VERSION)
    throw new BackupError("This backup was made by a different version of Paintwarden");
  const tables = manifest.tables;
  if (!tables || typeof tables !== "object" || Array.isArray(tables))
    throw new BackupError("This backup is damaged");
  const sections = manifest.version === 1 ? BACKUP_V1_SECTIONS : BACKUP_SECTIONS;
  const result: BackupTables = {};
  for (const [key, rows] of Object.entries(tables)) {
    if (!Object.hasOwn(sections, key) || !Array.isArray(rows))
      throw new BackupError("This backup was made by a different version of Paintwarden");
    if (rows.some((row) => !row || typeof row !== "object" || Array.isArray(row)))
      throw new BackupError("This backup is damaged");
    const fields = sections[key as keyof typeof sections].fields;
    result[key as BackupSectionKey] = (rows as BackupRow[]).map((row) =>
      Object.fromEntries(
        fields.filter((field) => Object.hasOwn(row, field)).map((field) => [field, row[field]]),
      ),
    );
  }
  if (mode === "replace" && Object.keys(sections).some((key) => !Object.hasOwn(result, key)))
    throw new BackupError("This backup is incomplete: Replace requires every vault section");
  if (manifest.version === 1) {
    result.folders = [];
    for (const key of ["miniatures", "templates"] as const)
      if (result[key]) result[key] = result[key].map((row) => ({ ...row, folderId: null }));
  }
  if (result.folders) result.folders = orderFolders(result.folders);
  return result;
}

// Manifest order is not meaningful. Sort only the imported graph; merge may refer to existing
// parents, which SQLite validates in the transaction. Reject duplicate IDs and cycles up front.
function orderFolders(rows: BackupRow[]): BackupRow[] {
  const pending = new Map(rows.map((row) => [row.id, row]));
  if (pending.size !== rows.length) throw new BackupError("This backup is damaged");
  const children = new Map<unknown, BackupRow[]>();
  const queue: BackupRow[] = [];
  for (const row of rows) {
    if (row.parentId == null || !pending.has(row.parentId)) queue.push(row);
    else {
      const siblings = children.get(row.parentId) ?? [];
      siblings.push(row);
      children.set(row.parentId, siblings);
    }
  }
  for (let index = 0; index < queue.length; index++)
    for (const child of children.get(queue[index].id) ?? []) queue.push(child);
  if (queue.length !== rows.length) throw new BackupError("This backup is damaged");
  return queue;
}

const damagedEntry = () => new BackupError("This backup file is damaged");

async function readEntry(source: ZipSource, entry: ZipEntry, limit: number) {
  try {
    return await readZipEntry(source, entry, limit);
  } catch (error) {
    if (error instanceof ZipFormatError) throw damagedEntry();
    throw error;
  }
}

// Reads the manifest and checks every image's name and size. Image contents are read later, one
// at a time.
async function readZip(source: ZipSource, mode: RestoreMode) {
  let entries: ZipEntry[];
  try {
    entries = await readZipDirectory(source, ZIP_LIMITS);
  } catch (error) {
    if (error instanceof ZipLimitError) throw new BackupError("This backup holds too many files to restore");
    if (error instanceof ZipFormatError) throw damagedEntry();
    throw error;
  }
  if (entries.reduce((total, entry) => total + entry.size, 0) > MAX_EXPANDED_BYTES)
    throw new BackupError("This backup is too large to restore");
  const manifest = entries.find((entry) => entry.name === BACKUP_MANIFEST);
  if (!manifest) throw new BackupError("This isn't a Paintwarden backup");
  const manifestBytes = await readEntry(source, manifest, MAX_MANIFEST_BYTES);
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(manifestBytes).toString("utf8"));
  } catch {
    throw new BackupError("This backup is damaged");
  }
  const images = new Map<string, ZipEntry>();
  for (const entry of entries) {
    if (!entry.name.startsWith(BACKUP_IMAGE_FOLDER) || entry.name === BACKUP_IMAGE_FOLDER) continue;
    const key = entry.name.slice(BACKUP_IMAGE_FOLDER.length);
    if (!isImageKey(key) || entry.size > MAX_IMAGE_BYTES) throw new BackupError("This backup is damaged");
    images.set(key, entry);
  }
  return { tables: readManifest(parsed, mode), images };
}

const insertRows = (tx: Tx, table: SQLiteTable, rows: BackupRow[], skipExisting: boolean) => {
  // Small batches stay below SQLite's bound-parameter limit for wide tables.
  for (let index = 0; index < rows.length; index += 200) {
    const insert = tx.insert(table).values(rows.slice(index, index + 200));
    (skipExisting ? insert.onConflictDoNothing() : insert).run();
  }
};

// A paint has at most one default substitution. A merged-in default gives way to the vault's own.
function keepOneDefault(tx: Tx, rows: BackupRow[]) {
  const taken = new Set(
    tx
      .select({ targetPaintId: paintSubstitutions.targetPaintId, isDefault: paintSubstitutions.isDefault })
      .from(paintSubstitutions)
      .all()
      .filter((row) => row.isDefault)
      .map((row) => row.targetPaintId),
  );
  return rows.map((row) => {
    if (!row.isDefault) return row;
    if (taken.has(row.targetPaintId as string)) return { ...row, isDefault: false };
    taken.add(row.targetPaintId as string);
    return row;
  });
}

// A plugin installed in both vaults has a different UUID in each. A merge keeps this vault's plugin
// and points the backup's plugin items and images at it.
function alignPlugins(tx: Tx, tables: BackupTables): BackupTables {
  const installed = new Map(
    tx
      .select({ id: catalogSources.id, repository: catalogSources.repository })
      .from(catalogSources)
      .all()
      .map((row) => [row.repository, row.id]),
  );
  const ids = new Map<unknown, string>();
  for (const plugin of tables.plugins ?? []) {
    const id = installed.get(plugin.repository as string);
    if (id && id !== plugin.id) ids.set(plugin.id, id);
  }
  if (!ids.size) return tables;
  const repoint = (rows: BackupRow[] = []) =>
    rows.map((row) => (ids.has(row.sourceId) ? { ...row, sourceId: ids.get(row.sourceId) } : row));
  return {
    ...tables,
    plugins: (tables.plugins ?? []).filter((plugin) => !ids.has(plugin.id)),
    pluginItems: repoint(tables.pluginItems),
    pluginImages: repoint(tables.pluginImages),
  };
}

// Writes every section. Replace empties the vault's data first (the owner account and sign-in
// sessions are kept); merge adds only records the vault doesn't already have.
function writeTables(tx: Tx, tables: BackupTables, mode: RestoreMode) {
  const counts: Partial<Record<BackupSectionKey, number>> = {};
  if (mode === "replace") {
    for (const key of [...SECTION_KEYS].reverse()) {
      if (key === "folders") {
        // Avoid SQLite's recursive cascade limit for deeply nested authored folders.
        const existing = tx.select({ id: folders.id, parentId: folders.parentId }).from(folders).all();
        for (const row of orderFolders(existing).reverse())
          tx.delete(folders)
            .where(eq(folders.id, row.id as string))
            .run();
      } else tx.delete(BACKUP_SECTIONS[key].table).run();
    }
    for (const key of SECTION_KEYS) {
      const rows = (tables[key] ?? []).map((row) => pickFields(key, row));
      if (key === "folders") {
        for (const row of rows) insertRows(tx, BACKUP_SECTIONS[key].table, [row], false);
      } else insertRows(tx, BACKUP_SECTIONS[key].table, rows, false);
      counts[key] = rows.length;
    }
    return counts;
  }
  tables = alignPlugins(tx, tables);
  const added = new Map<string, Set<unknown>>();
  for (const key of SECTION_KEYS) {
    const section: (typeof BACKUP_SECTIONS)[BackupSectionKey] = BACKUP_SECTIONS[key];
    let rows = (tables[key] ?? []).map((row) => pickFields(key, row));
    if (key === "substitutions") rows = keepOneDefault(tx, rows);
    if ("parent" in section.merge) {
      const existing = new Set(
        tx
          .select()
          .from(section.table)
          .all()
          .map((row) => (row as BackupRow).id),
      );
      rows = rows.filter((row) => !existing.has(row.id));
      added.set(key, new Set(rows.map((row) => row.id)));
    } else if ("childOf" in section.merge) {
      const { childOf, field } = section.merge;
      const parents = added.get(childOf) ?? new Set();
      rows = rows.filter((row) => parents.has(row[field]));
    }
    if (key === "folders") {
      for (const row of rows) insertRows(tx, section.table, [row], true);
    } else insertRows(tx, section.table, rows, true);
    counts[key] = rows.length;
  }
  return counts;
}

function describeFailure(error: unknown, mode: RestoreMode) {
  const message = error instanceof Error ? error.message : "";
  if (/FOREIGN KEY constraint failed/.test(message))
    return mode === "merge"
      ? "This backup refers to paints, schemes or plugins that aren't in this vault. Install the plugins it uses, then try again"
      : "This backup is damaged: some records refer to items it doesn't contain";
  if (/Folder (parent|kind|cycle)|(?:Miniature|Template) folder/.test(message))
    return "This backup is damaged: some records refer to items it doesn't contain";
  if (/constraint failed/.test(message)) return "This backup contains records this version can't store";
  return null;
}

// Saves an uploaded backup to a temporary file beside the vault, so a restore never holds the
// whole file in memory. The caller removes it with removeBackupUpload.
export async function saveBackupUpload(body: ReadableStream<Uint8Array>) {
  await mkdir(uploadDirectory, { recursive: true });
  const file = path.join(uploadDirectory, `${randomUUID()}.upload`);
  try {
    await pipeline(Readable.fromWeb(body as NodeReadableStream<Uint8Array>), createWriteStream(file));
  } catch (error) {
    await removeBackupUpload(file);
    throw error;
  }
  return file;
}

export const removeBackupUpload = (file: string) => rm(file, { force: true });

// Removes uploads left behind by a server that stopped during a restore.
export const clearBackupUploads = () => rm(uploadDirectory, { recursive: true, force: true });

function fileSource(handle: FileHandle, size: number): ZipSource {
  return {
    size,
    read: async (offset, length) => {
      const bytes = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(bytes, 0, length, offset);
      return bytes.subarray(0, bytesRead);
    },
  };
}

// Files are written before the transaction because better-sqlite3 transactions are synchronous.
// Keys are unique names, so an image that already exists is the same image; it is claimed so an
// export that held it can't delete it before the restore refers to it again.
async function readBackupFile(handle: FileHandle, mode: RestoreMode, written: string[], claimed: string[]) {
  const { size } = await handle.stat();
  if (!size) throw new BackupError("Choose a backup file");
  const source = fileSource(handle, size);
  const signature = await source.read(0, 2);
  if (signature[0] !== 0x50 || signature[1] !== 0x4b)
    throw new BackupError("Choose a Paintwarden backup (.zip) file");
  const { tables, images } = await readZip(source, mode);
  for (const key of imageRefs(tables))
    if (!images.has(key))
      throw new BackupError("This backup is damaged: some images its records refer to are missing");
  for (const [key, entry] of images) {
    keepImage(key);
    if (await imageExists(key)) claimed.push(key);
    else {
      await writeImage(key, await readEntry(source, entry, MAX_IMAGE_BYTES));
      written.push(key);
    }
  }
  return tables;
}

export const restoreBackup = serializeImageMutation(async function restoreBackup(
  file: string,
  mode: RestoreMode,
) {
  const written: string[] = [];
  const claimed: string[] = [];
  const db = getDb();
  let previousKeys = new Set<string>();
  let counts: Partial<Record<BackupSectionKey, number>>;
  const handle = await open(file, "r");
  try {
    const tables = await readBackupFile(handle, mode, written, claimed);
    counts = db.transaction((tx) => {
      previousKeys = referencedImageKeys(imageTables(tx));
      return writeTables(tx, tables, mode);
    });
  } catch (error) {
    await deleteImages([...written, ...claimed]);
    const message = describeFailure(error, mode);
    if (message) throw new BackupError(message, { cause: error });
    throw error;
  } finally {
    await handle.close();
  }
  // Merge never orphans an image; replace can, and those files are removed afterwards. Files the
  // backup carried but nothing refers to are removed too.
  await deleteImages([...previousKeys, ...written, ...claimed]);
  if (mode === "replace") shrinkDatabase();
  return {
    mode,
    restored: {
      miniatures: counts.miniatures ?? 0,
      paints: counts.paints ?? 0,
      schemes: counts.schemes ?? 0,
      templates: counts.templates ?? 0,
      plugins: counts.plugins ?? 0,
    },
  };
});
