import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { catalogSourceItems, catalogSources, colorSchemeImages } from "../db/schema";

import {
  type SourceFileReader,
  downloadAssets,
  readSourceJson,
  sourceLogoUrl,
} from "./catalog-source-assets";
import { SOURCE_IMAGE_PATH, installCatalog } from "./catalog-source-install";
import { isUploadedSource, readSourceZip } from "./catalog-source-upload";
import {
  rawUrl,
  normalizeRepository,
  defaultBranch,
  sourceManifest,
  fetchSourceLogo,
  requestBytes,
} from "./github-source";
import { serializeImageMutation } from "./image-mutations";
import { deleteImage } from "./image-store";
import {
  imagePaths,
  parseAssets,
  parseCatalog,
  versionAtLeast,
  type Catalog,
  type Manifest,
} from "./source-format";

// Kept here so callers can import everything about catalog sources from one module.
export { LOGO_MAX_BYTES, normalizeRepository, validLogoSvg } from "./github-source";
export { previewSourceRemoval, removeCatalogSource } from "./catalog-source-removal";
export { sourceImage, sourceLogo, sourceLogoUrl } from "./catalog-source-assets";

// `id` is the plugin's repository key, which GitHub requests and dependencies use; `sourceId` is
// its UUID in this vault, kept from an earlier install or newly made.
type PreparedSource = {
  id: string;
  sourceId: string;
  url: string;
  branch: string;
  manifest: Manifest;
  catalog?: Catalog;
  downloaded?: Awaited<ReturnType<typeof downloadAssets>>;
  logo?: string | null;
};

// The vault's UUID for a plugin, found by its repository key, or a new one for a new plugin.
function installedSource(repository: string) {
  return getDb().select().from(catalogSources).where(eq(catalogSources.repository, repository)).get();
}

// Installs (or checks) every repository the manifest depends on before the source itself.
async function prepareDependencies(
  manifest: Manifest,
  prepared: Map<string, PreparedSource>,
  stack: Set<string>,
) {
  for (const dependency of manifest.dependencies) {
    const required = normalizeRepository(dependency.repository);
    await prepareRepository(required.url, prepared, stack);
    const requiredVersion = prepared.get(required.id)?.manifest.version;
    if (
      dependency.minimumVersion &&
      (!requiredVersion || !versionAtLeast(requiredVersion, dependency.minimumVersion))
    )
      throw new Error(`${manifest.name} needs a newer version of ${required.id}`);
  }
}

// Reads and validates the catalog and stores its images, from GitHub or an uploaded .zip.
async function prepareCatalog(sourceId: string, manifest: Manifest, read: SourceFileReader) {
  const [catalogData, assetData] = await Promise.all([
    readSourceJson(read, manifest.catalog, 50_000_000),
    readSourceJson(read, manifest.assets, 5_000_000),
  ]);
  const catalog = parseCatalog(catalogData);
  const needed = imagePaths(catalog);
  const records = parseAssets(assetData, needed);
  const downloaded = await downloadAssets(sourceId, read, records, needed);
  return { catalog, downloaded };
}

async function prepareRepository(input: string, prepared: Map<string, PreparedSource>, stack: Set<string>) {
  const { id, url } = normalizeRepository(input);
  if (stack.has(id)) throw new Error(`Circular source dependency: ${id}`);
  if (prepared.has(id)) return;
  stack.add(id);
  try {
    const installed = installedSource(id);
    const sourceId = installed?.id ?? crypto.randomUUID();
    const branch = installed?.branch ?? (await defaultBranch(id));
    const { manifest, revision } = await sourceManifest(id, branch);
    await prepareDependencies(manifest, prepared, stack);
    if (installed && !versionAtLeast(manifest.version, installed.version))
      throw new Error(
        `${id} now has version ${manifest.version}, older than the installed ${installed.version}. The installed version is kept`,
      );
    // The logo is checked on every sync so it can be added or changed without a version bump.
    if (installed?.version === manifest.version) {
      prepared.set(id, { id, sourceId, url, branch, manifest, logo: await fetchSourceLogo(id, revision) });
      return;
    }
    const read: SourceFileReader = (path, maxBytes) => requestBytes(rawUrl(id, revision, path), maxBytes);
    const [content, logo] = await Promise.all([
      prepareCatalog(sourceId, manifest, read),
      fetchSourceLogo(id, revision),
    ]);
    prepared.set(id, { id, sourceId, url, branch, manifest, ...content, logo });
  } finally {
    stack.delete(id);
  }
}

// Prepares the source and its dependencies, then writes them all in one transaction.
const installPrepared = serializeImageMutation(async function installPrepared(
  id: string,
  prepare: (prepared: Map<string, PreparedSource>) => Promise<void>,
) {
  const prepared = new Map<string, PreparedSource>();
  try {
    await prepare(prepared);
    getDb().transaction((tx) => {
      for (const source of prepared.values()) {
        if (source.catalog && source.downloaded)
          installCatalog(
            tx,
            source.sourceId,
            source.id,
            source.url,
            source.branch,
            source.manifest,
            source.catalog,
            source.downloaded.result,
          );
        else
          tx.update(catalogSources)
            .set({ lastError: null })
            .where(eq(catalogSources.id, source.sourceId))
            .run();
        if (source.logo !== undefined)
          tx.update(catalogSources)
            .set({ logoSvg: source.logo })
            .where(eq(catalogSources.id, source.sourceId))
            .run();
      }
    });
  } catch (error) {
    await Promise.all(
      [...prepared.values()]
        .flatMap((source) => source.downloaded?.created ?? [])
        .map((key) => deleteImage(key)),
    );
    throw error;
  }
  // A scheme the vault still uses keeps its images after a new version drops it.
  const stillShown = new Set(
    getDb()
      .select({ imageUrl: colorSchemeImages.imageUrl, thumbnailUrl: colorSchemeImages.thumbnailUrl })
      .from(colorSchemeImages)
      .all()
      .flatMap((row) => [row.imageUrl, row.thumbnailUrl])
      .filter((url): url is string => !!url?.startsWith(SOURCE_IMAGE_PATH))
      .map((url) => url.slice(SOURCE_IMAGE_PATH.length)),
  );
  await Promise.all(
    [...prepared.values()].flatMap((source) => {
      if (!source.downloaded) return [];
      const currentKeys = new Set([...source.downloaded.result.values()].map((asset) => asset.key));
      return source.downloaded.previous
        .filter((asset) => !currentKeys.has(asset.imageKey) && !stillShown.has(asset.imageKey))
        .map((asset) => deleteImage(asset.imageKey));
    }),
  );
  const root = prepared.get(id)!;
  return {
    id: root.sourceId,
    repository: id,
    name: root.manifest.name,
    version: root.manifest.version,
    updated: !!root.catalog,
  };
});

function installRepository(input: string) {
  const { id } = normalizeRepository(input);
  return installPrepared(id, (prepared) => prepareRepository(input, prepared, new Set()));
}

export async function addCatalogSource(url: string) {
  return installRepository(url);
}

// Installs a source from an uploaded .zip; its dependencies still come from GitHub. The plugin's
// name identifies it, so a .zip whose name matches an installed uploaded plugin replaces it only
// with a newer version: the same version changes nothing, and an older one is refused until the
// installed plugin is removed.
export async function addUploadedCatalogSource(bytes: Uint8Array) {
  const upload = await readSourceZip(bytes);
  return installPrepared(upload.id, async (prepared) => {
    const installed = installedSource(upload.id);
    const { version } = upload.manifest;
    if (installed && !versionAtLeast(version, installed.version))
      throw new Error(
        `${installed.name} ${installed.version} is installed, and this .zip has the older version ${version}. Remove the plugin first to install an older version`,
      );
    await prepareDependencies(upload.manifest, prepared, new Set([upload.id]));
    if (prepared.has(upload.id)) throw new Error(`Circular source dependency: ${upload.id}`);
    const sourceId = installed?.id ?? crypto.randomUUID();
    const base = { id: upload.id, sourceId, url: "", branch: "", manifest: upload.manifest };
    if (installed?.version === version) {
      prepared.set(upload.id, { ...base, logo: upload.logo });
      return;
    }
    const content = await prepareCatalog(sourceId, upload.manifest, upload.read);
    prepared.set(upload.id, { ...base, ...content, logo: upload.logo });
  });
}

export async function checkCatalogSources() {
  const sources = getDb().select().from(catalogSources).all();
  const results = [];
  for (const source of sources) results.push(await checkCatalogSource(source.id));
  return results;
}

// Share only work that is still running. A later explicit check always goes back to GitHub,
// including after a failed check. Version probes and installs remain separate operations.
const sourceChecks = new Map<string, ReturnType<typeof updateCatalogSource>>();

export function checkCatalogSource(id: string) {
  const pending = sourceChecks.get(id);
  if (pending) return pending;
  const check = updateCatalogSource(id).finally(() => sourceChecks.delete(id));
  sourceChecks.set(id, check);
  return check;
}

async function updateCatalogSource(id: string) {
  const source = getDb().select().from(catalogSources).where(eq(catalogSources.id, id)).get();
  if (!source) throw new Error("Catalog source not found");
  // An uploaded plugin has nowhere to check; it is updated by uploading a newer .zip.
  const result = { id: source.id, repository: source.repository, name: source.name, version: source.version };
  if (isUploadedSource(source.repository)) return { ...result, updated: false };
  try {
    return await installRepository(source.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Source update failed";
    getDb().update(catalogSources).set({ lastError: message }).where(eq(catalogSources.id, id)).run();
    return { ...result, updated: false, error: message };
  }
}

export function listCatalogSources() {
  const db = getDb();
  const counts = new Map<string, { paints: number; schemes: number; templates: number }>();
  const keys = { paint: "paints", scheme: "schemes", template: "templates" } as const;
  for (const item of db
    .select({ sourceId: catalogSourceItems.sourceId, kind: catalogSourceItems.kind })
    .from(catalogSourceItems)
    .all()) {
    const current = counts.get(item.sourceId) ?? { paints: 0, schemes: 0, templates: 0 };
    current[keys[item.kind]] += 1;
    counts.set(item.sourceId, current);
  }
  return db
    .select()
    .from(catalogSources)
    .all()
    .map(({ logoSvg, ...source }) => ({
      ...source,
      logoUrl: sourceLogoUrl(source.id, logoSvg),
      counts: counts.get(source.id) ?? { paints: 0, schemes: 0, templates: 0 },
    }));
}

const sourceVersionChecks = new Map<string, ReturnType<typeof checkSourceVersion>>();

export async function checkCatalogSourceVersions() {
  return Promise.all(
    listCatalogSources().map((source) => {
      const pending = sourceVersionChecks.get(source.id);
      if (pending) return pending;
      const check = checkSourceVersion(source).finally(() => sourceVersionChecks.delete(source.id));
      sourceVersionChecks.set(source.id, check);
      return check;
    }),
  );
}

async function checkSourceVersion(source: ReturnType<typeof listCatalogSources>[number]) {
  if (isUploadedSource(source.repository)) return { id: source.id };
  try {
    const { manifest } = await sourceManifest(source.repository, source.branch);
    return {
      id: source.id,
      availableVersion: manifest.version,
      updateAvailable: !versionAtLeast(source.version, manifest.version),
    };
  } catch (error) {
    return {
      id: source.id,
      error: error instanceof Error ? error.message : "Could not check for updates",
    };
  }
}
