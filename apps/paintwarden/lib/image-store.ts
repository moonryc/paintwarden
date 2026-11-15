import { copyFile, mkdir, open, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { eq, or } from "drizzle-orm";

import { getDb } from "../db";
import { catalogSourceAssets, colorSchemeImages, miniatureTemplates, miniatures } from "../db/schema";

import { serializeImageMutation } from "./image-mutations";
import {
  ensureThumbnail,
  prepareThumbnails,
  removeThumbnails,
  ThumbnailBusyError,
  thumbnailWidths,
  thumbnailPath,
  type ThumbnailWidth,
} from "./image-thumbnails";

const imageDirectory = path.join(process.env.DATA_DIR || path.resolve(process.cwd(), "../../data"), "images");

const extensions: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const contentTypes: Record<string, string> = Object.fromEntries(
  Object.entries(extensions).map(([type, extension]) => [extension, type]),
);

export const saveImageBytes = serializeImageMutation(async function saveImageBytes(
  bytes: Uint8Array,
  contentType: string,
) {
  await mkdir(imageDirectory, { recursive: true });
  const extension = extensions[contentType] || "img";
  const key = `${crypto.randomUUID()}.${extension}`;
  const filename = path.join(imageDirectory, key);
  await writeFile(filename, bytes);
  await prepareThumbnails(filename);
  return key;
});

export const saveImage = (file: File) =>
  file.arrayBuffer().then((bytes) => saveImageBytes(new Uint8Array(bytes), file.type));

// Filesystem copy avoids loading a source photo into JS, wrapping it in a File, and
// reading it again. A fresh key preserves independent ownership/deletion semantics.
export const copyImage = serializeImageMutation(async function copyImage(key: string) {
  if (!isImageKey(key)) return null;
  const source = path.join(imageDirectory, key);
  const copiedKey = `${crypto.randomUUID()}${path.extname(key)}`;
  const destination = path.join(imageDirectory, copiedKey);
  try {
    await copyFile(source, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  await Promise.all(
    thumbnailWidths.map((width) =>
      copyFile(thumbnailPath(source, width), thumbnailPath(destination, width)).catch(() => undefined),
    ),
  );
  await prepareThumbnails(destination);
  return copiedKey;
});

// Image keys are generated file names: a lowercase UUID plus an image extension. The database
// checks the same rule (isImageKey in db/schema-checks.ts).
export const isImageKey = (key: string) =>
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\.(?:avif|gif|jpg|jpeg|png|webp|img)$/.test(key);

export async function imageExists(key: string) {
  if (!isImageKey(key)) return false;
  return stat(path.join(imageDirectory, key)).then(
    (info) => info.isFile(),
    () => false,
  );
}

// Cache reuse must not silently accept an image rewritten by a restore while staging.
// Nanosecond metadata makes the final check cheap without reading/hash-decoding the photo.
export async function imageFileIdentity(key: string) {
  if (!isImageKey(key)) return null;
  try {
    const info = await stat(path.join(imageDirectory, key), { bigint: true });
    return info.isFile() ? `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}` : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

// Writes an image under a known key, as when restoring a backup. Returns false for an invalid key.
export const writeImage = serializeImageMutation(async function writeImage(key: string, bytes: Uint8Array) {
  if (!isImageKey(key)) return false;
  await mkdir(imageDirectory, { recursive: true });
  const filename = path.join(imageDirectory, key);
  await removeThumbnails(filename);
  await writeFile(filename, bytes);
  // Restored originals regenerate lazily. Backups never include derivatives.
  return true;
});

export async function loadImage(key: string) {
  const safeKey = path.basename(key);
  if (safeKey !== key) return null;
  try {
    return {
      bytes: await readFile(path.join(imageDirectory, key)),
      contentType: contentTypes[path.extname(key).slice(1)] || "application/octet-stream",
    };
  } catch {
    return null;
  }
}

// Routes stream the open file instead of buffering it then copying it into Response.
// Width is a closed enum: arbitrary query values must never allocate arbitrary variants.
export async function imageResponse(key: string, request?: Request, cacheControl?: string) {
  if (!isImageKey(key)) return new Response("Not found", { status: 404 });
  const requested = request ? new URL(request.url).searchParams.get("w") : null;
  if (requested !== null && !thumbnailWidths.some((width) => String(width) === requested))
    return new Response("Invalid image width", { status: 400 });
  const original = path.join(imageDirectory, key);
  let filename = original;
  if (requested !== null) {
    try {
      filename = await ensureThumbnail(original, Number(requested) as ThumbnailWidth);
    } catch (error) {
      if (error instanceof ThumbnailBusyError)
        return new Response("Thumbnail busy", { status: 503, headers: { "retry-after": "1" } });
      if (!(await imageExists(key))) return new Response("Not found", { status: 404 });
      return new Response("Unsupported image", { status: 415 });
    }
  }
  try {
    const handle = await open(filename, "r");
    try {
      const info = await handle.stat();
      const stream = handle.createReadStream({ signal: request?.signal });
      return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
        headers: {
          "content-type":
            requested === null
              ? contentTypes[path.extname(key).slice(1)] || "application/octet-stream"
              : "image/webp",
          "content-length": String(info.size),
          "cache-control": cacheControl ?? imageCacheControl(request, key),
          "x-content-type-options": "nosniff",
        },
      });
    } catch (error) {
      await handle.close();
      throw error;
    }
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

// Image URLs carry their image key as `v`, which changes whenever an image is replaced. Only a
// response for the current key may be cached indefinitely.
export function imageCacheControl(request: Request | undefined, imageKey: string) {
  return request && new URL(request.url).searchParams.get("v") === imageKey
    ? "private, max-age=31536000, immutable"
    : "private, no-cache";
}

// A backup export reads its images after taking its snapshot of the database, so it holds the
// images it will read. Deleting a held image is put off until every export holding it is done.
const holds = new Map<string, number>();
const putOff = new Set<string>();

export function holdImages(keys: Iterable<string>) {
  for (const key of keys) holds.set(key, (holds.get(key) ?? 0) + 1);
}

// Releases a hold and returns the put-off deletions it was the last to hold. The caller deletes
// those that nothing refers to any more, since a restore may have claimed one in the meantime.
export function releaseImages(keys: Iterable<string>) {
  const ready: string[] = [];
  for (const key of keys) {
    const count = (holds.get(key) ?? 1) - 1;
    if (count > 0) {
      holds.set(key, count);
      continue;
    }
    holds.delete(key);
    if (putOff.delete(key)) ready.push(key);
  }
  return ready;
}

// Cancels a put-off deletion, for an image a restore is about to refer to again.
export function keepImage(key: string) {
  putOff.delete(key);
}

// Batch cleanup scans the four referencing tables once, rather than once per orphaned file.
export const deleteImages = serializeImageMutation(async function deleteImages(keys: Iterable<string>) {
  const candidates = [...new Set(keys)].filter((key) => key && path.basename(key) === key);
  if (!candidates.length) return;
  const db = getDb();
  const used = new Set<string>();
  for (const table of [miniatures, miniatureTemplates, catalogSourceAssets])
    for (const row of db.select({ imageKey: table.imageKey }).from(table).all())
      if (row.imageKey) used.add(row.imageKey);
  const prefix = "/api/catalog-source-images/";
  for (const row of db
    .select({ imageUrl: colorSchemeImages.imageUrl, thumbnailUrl: colorSchemeImages.thumbnailUrl })
    .from(colorSchemeImages)
    .all())
    for (const url of [row.imageUrl, row.thumbnailUrl])
      if (url?.startsWith(prefix)) used.add(url.slice(prefix.length));
  await Promise.all(candidates.filter((key) => !used.has(key)).map(unlinkUnusedImage));
});

async function unlinkUnusedImage(key: string) {
  if (holds.has(key)) {
    putOff.add(key);
    return;
  }
  const original = path.join(imageDirectory, key);
  await unlink(original).catch(() => undefined);
  await removeThumbnails(original);
}

export const deleteImage = serializeImageMutation(async function deleteImage(key: string | null) {
  if (!key || path.basename(key) !== key) return;
  // Check inside the mutation lock, immediately before unlinking. A restore rollback, stale
  // source cleanup or another row sharing this key must never delete a committed row's image.
  const db = getDb();
  const sourceUrl = `/api/catalog-source-images/${key}`;
  if (
    db.select({ id: miniatures.id }).from(miniatures).where(eq(miniatures.imageKey, key)).get() ||
    db
      .select({ id: miniatureTemplates.id })
      .from(miniatureTemplates)
      .where(eq(miniatureTemplates.imageKey, key))
      .get() ||
    db
      .select({ key: catalogSourceAssets.imageKey })
      .from(catalogSourceAssets)
      .where(eq(catalogSourceAssets.imageKey, key))
      .get() ||
    db
      .select({ id: colorSchemeImages.id })
      .from(colorSchemeImages)
      .where(or(eq(colorSchemeImages.imageUrl, sourceUrl), eq(colorSchemeImages.thumbnailUrl, sourceUrl)))
      .get()
  )
    return;
  await unlinkUnusedImage(key);
});
