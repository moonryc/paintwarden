import { randomUUID } from "node:crypto";
import { rename, stat, unlink, writeFile } from "node:fs/promises";

import sharp from "sharp";

import { withImageMutation } from "./image-mutations";

// These are derived files, never backup payloads. Bump the version when encoding changes.
export const thumbnailWidths = [160, 320, 640] as const;
export type ThumbnailWidth = (typeof thumbnailWidths)[number];
export const thumbnailPath = (original: string, width: ThumbnailWidth) =>
  `${original}.thumb-v1-${width}.webp`;

// Two decoders across uploads, source imports and lazy requests, not two per request.
// libvips also bounds its worker threads/cache; a photo must not fan out across every CPU.
sharp.concurrency(1);
sharp.cache({ memory: 16, files: 0, items: 32 });
const pending = new Map<string, Promise<string>>();
const waiters: (() => void)[] = [];
let active = 0;
const concurrency = 2;

export class ThumbnailBusyError extends Error {}

async function slot<T>(operation: () => Promise<T>): Promise<T> {
  if (active >= concurrency) {
    // Bound queued work too. A client can retry; never fall back to a huge original.
    if (waiters.length >= 32) throw new ThumbnailBusyError("Thumbnail queue is full");
    await new Promise<void>((resolve) => waiters.push(resolve));
  } else active++;
  try {
    return await operation();
  } finally {
    const next = waiters.shift();
    if (next) next();
    else active--;
  }
}

export async function ensureThumbnail(original: string, width: ThumbnailWidth) {
  const output = thumbnailPath(original, width);
  if (
    await stat(output).then(
      (info) => info.isFile(),
      () => false,
    )
  )
    return output;
  const existing = pending.get(output);
  if (existing) return existing;
  const task = (async () => {
    const temporary = `${output}.${randomUUID()}.tmp`;
    try {
      await slot(async () => {
        // First frame for animated inputs. Keep aspect ratio, without upscaling, with a
        // defensive height bound for unusually tall source assets. EXIF is auto-oriented
        // and metadata is stripped. Unsupported/corrupt inputs cannot become thumbnails.
        await sharp(original, { limitInputPixels: 40_000_000, sequentialRead: true })
          .rotate()
          .resize({ width, height: width * 4, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 78, effort: 4 })
          .toFile(temporary);
      });
      await withImageMutation(async () => {
        // Cleanup/restore owns this same lock. Never publish a derivative after its
        // original was deleted, including while the expensive decoder was running.
        await stat(original);
        await rename(temporary, output);
      });
      return output;
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  })();
  pending.set(output, task);
  try {
    return await task;
  } finally {
    pending.delete(output);
  }
}

// Isolated catalog stages are not reachable by readers or cleanup. Decode using the
// same global bounds, but never acquire the vault publication lock. Keep historical
// malformed originals exportable; filesystem write failures must still abort staging.
export async function prepareStagedThumbnails(original: string, bytes: Uint8Array) {
  for (const width of thumbnailWidths) {
    let output: Buffer;
    try {
      output = await slot(() =>
        sharp(bytes, { limitInputPixels: 40_000_000, sequentialRead: true })
          .rotate()
          .resize({ width, height: width * 4, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 78, effort: 4 })
          .toBuffer(),
      );
    } catch {
      // Same unsupported-input / queue-saturation tolerance as prepareThumbnails.
      return;
    }
    await writeFile(thumbnailPath(original, width), output, { flag: "wx" });
  }
}

export async function removeThumbnails(original: string) {
  await Promise.all(
    thumbnailWidths.map((width) => unlink(thumbnailPath(original, width)).catch(() => undefined)),
  );
}

export async function prepareThumbnails(original: string) {
  // Malformed historical/source assets remain exportable as originals, but must not
  // break an otherwise valid upload/restore. Requests for an invalid variant get 415.
  // Queue saturation is likewise safe: the next request regenerates lazily.
  await Promise.all(thumbnailWidths.map((width) => ensureThumbnail(original, width).catch(() => undefined)));
}
