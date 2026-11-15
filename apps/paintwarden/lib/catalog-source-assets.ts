import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { catalogSourceAssets, catalogSources } from "../db/schema";

import type { CatalogImageStage } from "./catalog-image-staging";
import { checkInstallCancelled, type InstallContext } from "./catalog-install-context";
import { imageFileIdentity, imageResponse } from "./image-store";
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
  stage: CatalogImageStage,
  context: InstallContext = {},
  completed: () => void = () => undefined,
) {
  const previous = getDb()
    .select()
    .from(catalogSourceAssets)
    .where(eq(catalogSourceAssets.sourceId, id))
    .all();
  const old = new Map(previous.map((row) => [row.assetPath, row]));
  const result = new Map<string, { key: string; sha256: string }>();
  const reused = new Map<string, string>();
  const pending = [...needed];
  let next = 0;
  let failed = false;
  async function worker() {
    try {
      while (!failed && next < pending.length) {
        checkInstallCancelled(context);
        const filename = pending[next++];
        const sha256 = records[filename].sha256.toLowerCase();
        const cached = old.get(filename);
        const identity = cached?.sha256 === sha256 ? await imageFileIdentity(cached.imageKey) : null;
        if (cached && identity) {
          result.set(filename, { key: cached.imageKey, sha256 });
          reused.set(cached.imageKey, identity);
        } else {
          const bytes = await read(filename, 30_000_000);
          checkInstallCancelled(context);
          if (createHash("sha256").update(bytes).digest("hex") !== sha256)
            throw new Error(`Image checksum does not match: ${filename}`);
          const extension = filename.split(".").at(-1)!.toLowerCase();
          const key = await stage.stage(bytes, extension);
          result.set(filename, { key, sha256 });
        }
        completed();
      }
    } catch (error) {
      failed = true;
      throw error;
    }
  }
  // Join every worker before deleting staging: no decoder may publish after cleanup.
  const workers = await Promise.allSettled(
    Array.from({ length: Math.min(4, pending.length) }, () => worker()),
  );
  const failure = workers.find((worker) => worker.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  return { result, previous, reused };
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
