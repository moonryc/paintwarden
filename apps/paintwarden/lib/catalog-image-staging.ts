import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getSqlite } from "../db";

import { withImageMutation } from "./image-mutations";
import { prepareStagedThumbnails, thumbnailPath, thumbnailWidths } from "./image-thumbnails";

const dataDirectory = path.resolve(process.env.DATA_DIR || path.resolve(process.cwd(), "../../data"));
const imageDirectory = path.join(dataDirectory, "images");
// Private uncommitted files are never reachable through images/, backups or image GC.
// Keeping this within DATA_DIR also preserves same-filesystem rename on mounted volumes.
const stagingDirectory = path.join(dataDirectory, ".plugin-staging");
const activeStages = new Set<string>();
const uuid = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/;
const imageKey =
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}\.(?:avif|gif|jpg|jpeg|png|webp|img)$/;
const extensionPattern = /^(?:avif|gif|jpg|jpeg|png|webp|img)$/;

interface OwnedFile {
  name: string;
  dev: number;
  ino: number;
}
interface Entry {
  key: string;
  files: OwnedFile[];
}
interface Owner {
  version: 1;
  id: string;
  vault: string;
  pid: number;
}

export interface CatalogImageStage {
  stage(bytes: Uint8Array, extension: string): Promise<string>;
  // Caller owns withImageMutation and runs this inside its synchronous DB transaction.
  promote(): void;
  // Call after the failed transaction has unwound. Only owned, unreferenced files go away.
  rollback(): void;
  // Call outside the DB transaction, whether it committed or failed.
  dispose(): Promise<void>;
}

function directoryOnly(directory: string) {
  const info = lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Unsafe catalog staging directory");
  return info;
}

function ownedFile(filename: string): OwnedFile {
  const info = lstatSync(filename);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Unsafe catalog staging file");
  return { name: path.basename(filename), dev: info.dev, ino: info.ino };
}

function isOwned(filename: string, file: OwnedFile) {
  try {
    const actual = lstatSync(filename);
    return actual.isFile() && !actual.isSymbolicLink() && actual.dev === file.dev && actual.ino === file.ino;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

// Scan once per cleanup, not once per asset. Check all consumers, not just catalog ownership.
function referencedKeys() {
  const database = getSqlite();
  if (database.inTransaction) throw new Error("Catalog staging cleanup requires a completed DB transaction");
  const rows = database
    .prepare(
      `
    SELECT image_key AS key FROM miniatures WHERE image_key IS NOT NULL
    UNION ALL SELECT image_key FROM miniature_templates WHERE image_key IS NOT NULL
    UNION ALL SELECT image_key FROM catalog_source_assets
    UNION ALL SELECT image_url FROM color_scheme_images
    UNION ALL SELECT thumbnail_url FROM color_scheme_images WHERE thumbnail_url IS NOT NULL
  `,
    )
    .all() as { key: string }[];
  const prefix = "/api/catalog-source-images/";
  return new Set(rows.map(({ key }) => (key.startsWith(prefix) ? key.slice(prefix.length) : key)));
}

function removePromoted(entries: Entry[]) {
  if (!entries.length || !existsSync(imageDirectory)) return;
  directoryOnly(imageDirectory);
  const referenced = referencedKeys();
  for (const entry of entries) {
    if (referenced.has(entry.key)) continue;
    for (const file of entry.files) {
      const filename = path.join(imageDirectory, file.name);
      // The journal predates rename. Inode identity also protects pre-existing files
      // if promotion failed because its fresh UUID happened to collide with one.
      if (isOwned(filename, file)) unlinkSync(filename);
    }
  }
}

async function writeJson(filename: string, value: unknown) {
  const temporary = `${filename}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { flag: "wx", mode: 0o600 });
  await rename(temporary, filename);
}

export async function createCatalogImageStage(): Promise<CatalogImageStage> {
  await mkdir(dataDirectory, { recursive: true });
  await mkdir(stagingDirectory, { recursive: true, mode: 0o700 });
  if (directoryOnly(stagingDirectory).dev !== directoryOnly(dataDirectory).dev)
    throw new Error("Catalog staging must share the vault filesystem");
  const id = randomUUID();
  const directory = path.join(stagingDirectory, id);
  // Register synchronously with creation so a concurrent in-process sweep cannot
  // mistake the not-yet-written owner journal for abandoned initialization.
  mkdirSync(directory, { mode: 0o700 });
  activeStages.add(directory);
  try {
    await writeJson(path.join(directory, "owner.json"), {
      version: 1,
      id,
      vault: dataDirectory,
      pid: process.pid,
    });
  } catch (error) {
    activeStages.delete(directory);
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  const entries: Entry[] = [];
  const pending = new Set<Promise<string>>();
  let state: "open" | "promoting" | "promoted" | "disposing" | "disposed" = "open";
  let disposal: Promise<void> | undefined;

  async function stageBytes(bytes: Uint8Array, extension: string) {
    const key = `${randomUUID()}.${extension}`;
    const original = path.join(directory, key);
    await writeFile(original, bytes, { flag: "wx", mode: 0o600 });
    await prepareStagedThumbnails(original, bytes);
    const files = [
      ownedFile(original),
      ...thumbnailWidths
        .map((width) => thumbnailPath(original, width))
        .filter((filename) => existsSync(filename))
        .map(ownedFile),
    ];
    const entry = { key, files };
    // One immutable journal per key avoids quadratic manifest rewrites on large plugins.
    // It is completely written BEFORE any original/derivative can be published.
    await writeJson(path.join(directory, `${key}.json`), entry);
    entries.push(entry);
    return key;
  }

  return {
    stage(bytes, extension) {
      if (state !== "open") return Promise.reject(new Error("Catalog image stage is closed"));
      if (!extensionPattern.test(extension))
        return Promise.reject(new Error("Unsafe catalog image extension"));
      const task = stageBytes(bytes, extension);
      pending.add(task);
      void task.then(
        () => pending.delete(task),
        () => pending.delete(task),
      );
      return task;
    },
    promote() {
      if (state !== "open" || pending.size) throw new Error("Catalog image stage is not ready to promote");
      state = "promoting";
      mkdirSync(imageDirectory, { recursive: true });
      directoryOnly(imageDirectory);
      for (const entry of entries) {
        for (const file of entry.files) {
          const source = path.join(directory, file.name);
          const destination = path.join(imageDirectory, file.name);
          if (!isOwned(source, file)) throw new Error("Catalog staged file changed before promotion");
          // Synchronous, under the caller's mutation lock: no vault mutation can race
          // this check/rename. Never replace an existing destination, even on collision.
          if (lstatSync(destination, { throwIfNoEntry: false }))
            throw new Error("Catalog image promotion destination already exists");
          renameSync(source, destination);
        }
      }
      state = "promoted";
    },
    rollback() {
      if (state === "disposing" || state === "disposed") return;
      removePromoted(entries);
    },
    dispose() {
      disposal ??= (async () => {
        state = "disposing";
        await Promise.allSettled(pending);
        await withImageMutation(async () => {
          removePromoted(entries);
          await rm(directory, { recursive: true, force: true });
          activeStages.delete(directory);
          state = "disposed";
        });
      })().catch((error: unknown) => {
        // Leave journals intact and permit a later cleanup retry (for example if
        // the caller first attempted disposal inside an unfinished transaction).
        disposal = undefined;
        throw error;
      });
      return disposal;
    },
  };
}

function readJson(filename: string): unknown {
  const info = lstatSync(filename);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 16_384)
    throw new Error("Unsafe catalog staging journal");
  return JSON.parse(readFileSync(filename, "utf8")) as unknown;
}

function readOwner(directory: string): Owner {
  const owner = readJson(path.join(directory, "owner.json")) as Partial<Owner> | null;
  if (
    !owner ||
    owner.version !== 1 ||
    owner.id !== path.basename(directory) ||
    owner.vault !== dataDirectory ||
    !Number.isSafeInteger(owner.pid) ||
    owner.pid! <= 0 ||
    owner.pid! > 2_147_483_647
  )
    throw new Error("Unsafe catalog staging owner journal");
  return owner as Owner;
}

function readEntry(filename: string): Entry {
  const entry = readJson(filename) as Partial<Entry> | null;
  if (
    !entry ||
    typeof entry.key !== "string" ||
    !imageKey.test(entry.key) ||
    path.basename(filename) !== `${entry.key}.json` ||
    !Array.isArray(entry.files) ||
    entry.files.length < 1 ||
    entry.files.length > 4
  )
    throw new Error("Unsafe catalog staging entry journal");
  const allowed = new Set([entry.key, ...thumbnailWidths.map((width) => thumbnailPath(entry.key!, width))]);
  const seen = new Set<string>();
  for (const file of entry.files) {
    if (
      !file ||
      !allowed.has(file.name) ||
      seen.has(file.name) ||
      !Number.isSafeInteger(file.dev) ||
      file.dev < 0 ||
      !Number.isSafeInteger(file.ino) ||
      file.ino <= 0
    )
      throw new Error("Unsafe catalog staging file journal");
    seen.add(file.name);
  }
  if (!seen.has(entry.key)) throw new Error("Catalog staging journal is missing its original");
  return entry as Entry;
}

function processAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

// Run at startup / before a new install. Active stages (including another live
// process's) are skipped. Invalid journals fail closed and are left for inspection.
// Crash before DB commit: remove owned orphan promotions. After commit: preserve
// referenced images, then discard only the now-unneeded staging files/journals.
export async function sweepCatalogImageStages() {
  await withImageMutation(async () => {
    if (!existsSync(stagingDirectory)) return;
    directoryOnly(stagingDirectory);
    for (const id of readdirSync(stagingDirectory)) {
      if (!uuid.test(id)) throw new Error("Unsafe catalog staging directory name");
      const directory = path.join(stagingDirectory, id);
      if (activeStages.has(directory)) continue;
      directoryOnly(directory);
      // A crash while creating the owner journal cannot have promoted anything.
      // Only the empty/temporary-owner case is safe to discard without a journal.
      if (!existsSync(path.join(directory, "owner.json"))) {
        const names = readdirSync(directory);
        if (names.some((name) => name !== "owner.json.tmp"))
          throw new Error("Catalog staging directory is missing its owner journal");
        await rm(directory, { recursive: true, force: true });
        continue;
      }
      const owner = readOwner(directory);
      if (owner.pid !== process.pid && processAlive(owner.pid)) continue;
      const entries = readdirSync(directory)
        .filter((name) => name.endsWith(".json") && name !== "owner.json")
        .map((name) => readEntry(path.join(directory, name)));
      removePromoted(entries);
      await rm(directory, { recursive: true, force: true });
    }
  });
}
