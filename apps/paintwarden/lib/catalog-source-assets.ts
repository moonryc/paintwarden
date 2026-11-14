import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { catalogSourceAssets, catalogSources } from "../db/schema";

import { deleteImage, imageExists, imageResponse, saveImageBytes } from "./image-store";
import type { Asset } from "./source-format";

// A catalog source's images: downloading them on install, and serving them and the source's
// logo afterwards.

// Reads one file of a source, from GitHub or from an uploaded .zip, refusing files over maxBytes.
export type SourceFileReader = (path: string, maxBytes: number) => Promise<Buffer>;

export async function readSourceJson(
  read: SourceFileReader,
  path: string,
  maxBytes: number,
): Promise<unknown> {
  const bytes = await read(path, maxBytes);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`${path} isn't valid JSON`);
  }
}

export async function downloadAssets(
  id: string,
  read: SourceFileReader,
  records: Record<string, Asset>,
  needed: Set<string>,
) {
  const db = getDb();
  const previous = db.select().from(catalogSourceAssets).where(eq(catalogSourceAssets.sourceId, id)).all();
  const old = new Map(previous.map((row) => [row.assetPath, row]));
  const result = new Map<string, { key: string; sha256: string }>();
  const created: string[] = [];
  const pending = [...needed];
  let next = 0;
  async function worker() {
    while (next < pending.length) {
      const filename = pending[next++];
      const sha256 = records[filename].sha256.toLowerCase();
      const cached = old.get(filename);
      if (cached?.sha256 === sha256 && (await imageExists(cached.imageKey))) {
        result.set(filename, { key: cached.imageKey, sha256 });
        continue;
      }
      const bytes = await read(filename, 30_000_000);
      if (createHash("sha256").update(bytes).digest("hex") !== sha256)
        throw new Error(`Image checksum does not match: ${filename}`);
      const extension = filename.split(".").at(-1)?.toLowerCase();
      const contentType =
        extension === "png"
          ? "image/png"
          : extension === "webp"
            ? "image/webp"
            : extension === "gif"
              ? "image/gif"
              : extension === "avif"
                ? "image/avif"
                : "image/jpeg";
      const key = await saveImageBytes(bytes, contentType);
      created.push(key);
      result.set(filename, { key, sha256 });
    }
  }
  const workers = await Promise.allSettled(Array.from({ length: 8 }, () => worker()));
  const failed = workers.find((worker) => worker.status === "rejected");
  if (failed?.status === "rejected") {
    await Promise.all(created.map((key) => deleteImage(key)));
    throw failed.reason;
  }
  return { result, created, previous };
}

export async function sourceImage(key: string, request?: Request) {
  if (!/^[a-f\d-]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(key))
    return new Response("Not found", { status: 404 });
  // Each downloaded asset gets a new key, so a key's bytes never change.
  return imageResponse(key, request, "private, max-age=31536000, immutable");
}

// The hash busts browser caches when a sync changes the logo.
export function sourceLogoUrl(id: string, logoSvg: string | null) {
  return logoSvg
    ? `/api/catalog-source-logos/${encodeURIComponent(id)}?v=${createHash("sha256").update(logoSvg).digest("hex").slice(0, 12)}`
    : null;
}

export function sourceLogo(id: string) {
  const logo = getDb()
    .select({ logoSvg: catalogSources.logoSvg })
    .from(catalogSources)
    .where(eq(catalogSources.id, id))
    .get()?.logoSvg;
  if (!logo) return new Response("Not found", { status: 404 });
  return new Response(logo, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Shown through <img>, which never runs SVG scripts; the CSP also blocks them if opened directly.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=86400",
    },
  });
}
