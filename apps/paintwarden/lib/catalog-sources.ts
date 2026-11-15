import type { ZipSource } from "@paintwarden/core/zip-reader";
import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { catalogSourceItems, catalogSources } from "../db/schema";

import type { InstallContext } from "./catalog-install-context";
import { checkInstallCancelled } from "./catalog-install-context";
import { sourceLogoUrl } from "./catalog-source-assets";
import { installRepositories, installRepository, installUploadedSource } from "./catalog-source-pipeline";
import { isUploadedSource } from "./catalog-source-upload";
import { sourceManifest } from "./github-source";
import { versionAtLeast } from "./source-format";

export type { InstallContext, InstallStage } from "./catalog-install-context";
export { LOGO_MAX_BYTES, normalizeRepository, validLogoSvg } from "./github-source";
export { previewSourceRemoval, removeCatalogSource } from "./catalog-source-removal";
export { sourceImage, sourceLogo, sourceLogoUrl } from "./catalog-source-assets";

function installedSource(repository: string) {
  return getDb().select().from(catalogSources).where(eq(catalogSources.repository, repository)).get();
}

export function addCatalogSource(url: string, context: InstallContext = {}) {
  return installRepository(url, context);
}

export function addUploadedCatalogSource(bytes: Uint8Array | ZipSource, context: InstallContext = {}) {
  return installUploadedSource(bytes, context);
}

export async function checkCatalogSources(context: InstallContext = {}) {
  const sources = getDb().select().from(catalogSources).all();
  if (context.signal || context.progress) {
    const remote = sources.filter((source) => !isUploadedSource(source.repository));
    const updated = await installRepositories(
      remote.map((source) => source.url),
      context,
    );
    return sources.map(
      (source) =>
        updated.find((result) => result.id === source.id) ?? {
          id: source.id,
          repository: source.repository,
          name: source.name,
          version: source.version,
          updated: false,
        },
    );
  }
  const results = [];
  for (const source of sources) {
    checkInstallCancelled(context);
    results.push(await checkCatalogSource(source.id, context));
  }
  return results;
}

// Share only work that is still running. A later explicit check always goes back to GitHub,
// including after a failed check. Version probes and installs remain separate operations.
const sourceChecks = new Map<string, ReturnType<typeof updateCatalogSource>>();

export function checkCatalogSource(id: string, context: InstallContext = {}) {
  if (context.signal || context.progress) return updateCatalogSource(id, context);
  const pending = sourceChecks.get(id);
  if (pending) return pending;
  const check = updateCatalogSource(id, context).finally(() => sourceChecks.delete(id));
  sourceChecks.set(id, check);
  return check;
}

async function updateCatalogSource(id: string, context: InstallContext) {
  const source = getDb().select().from(catalogSources).where(eq(catalogSources.id, id)).get();
  if (!source) throw new Error("Catalog source not found");
  // An uploaded plugin has nowhere to check; it is updated by uploading a newer .zip.
  const result = { id: source.id, repository: source.repository, name: source.name, version: source.version };
  if (isUploadedSource(source.repository)) return { ...result, updated: false };
  try {
    return await installRepository(source.url, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Source update failed";
    checkInstallCancelled(context);
    if (context.progress || context.signal) throw error;
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

type SourceVersionResult = {
  id: string;
  availableVersion?: string;
  updateAvailable?: boolean;
  error?: string;
};
type CheckedSourceVersion = {
  result: SourceVersionResult;
  pinned?: Awaited<ReturnType<typeof sourceManifest>>;
};
const sourceVersionChecks = new Map<string, { identity: string; promise: Promise<CheckedSourceVersion> }>();
const sourceVersionResults = new Map<string, { identity: string; result: SourceVersionResult }>();
const versionIdentity = (source: { repository: string; branch: string; version: string }) =>
  JSON.stringify([source.repository, source.branch, source.version]);

// GraphQL reads only locally cached check results. GitHub work remains an explicit
// REST source operation, not a field resolver. Cache membership is bounded by the
// installed sources, and a reinstall/version/branch change cannot reuse old data.
export function cachedCatalogSourceVersions() {
  const installed = getDb()
    .select({
      id: catalogSources.id,
      repository: catalogSources.repository,
      branch: catalogSources.branch,
      version: catalogSources.version,
    })
    .from(catalogSources)
    .all();
  const ids = new Set(installed.map((source) => source.id));
  for (const id of sourceVersionResults.keys()) if (!ids.has(id)) sourceVersionResults.delete(id);
  return installed.map((source): SourceVersionResult => {
    const cached = sourceVersionResults.get(source.id);
    if (cached?.identity === versionIdentity(source)) return cached.result;
    sourceVersionResults.delete(source.id);
    return { id: source.id };
  });
}

async function checkSourceVersions() {
  // Drop removed or changed identities before accepting another set of checks.
  cachedCatalogSourceVersions();
  return Promise.all(
    listCatalogSources().map((source) => {
      const identity = versionIdentity(source);
      const pending = sourceVersionChecks.get(source.id);
      if (pending?.identity === identity) return pending.promise.then((checked) => ({ source, ...checked }));
      const check = checkSourceVersion(source)
        .then((checked) => {
          const current = installedSource(source.repository);
          if (current?.id === source.id && versionIdentity(current) === identity)
            sourceVersionResults.set(source.id, { identity, result: checked.result });
          return checked;
        })
        .finally(() => {
          if (sourceVersionChecks.get(source.id)?.promise === check) sourceVersionChecks.delete(source.id);
        });
      sourceVersionChecks.set(source.id, { identity, promise: check });
      return check.then((checked) => ({ source, ...checked }));
    }),
  );
}

export async function checkCatalogSourceVersions() {
  return (await checkSourceVersions()).map(({ result }) => result);
}

// Probing versions is read-only: an automatic no-op never creates an install job or
// staging directory. Reuse these exact revisions when an update really is needed.
export async function prepareCatalogSourceUpdates(id?: string) {
  const checked = await checkSourceVersions();
  const updates = checked.filter(({ source, result }) => (!id || source.id === id) && result.updateAvailable);
  return {
    versions: checked.map(({ result }) => result),
    install: updates.length
      ? (context: InstallContext) => {
          for (const { source } of checked) {
            const current = installedSource(source.repository);
            if (!current || current.id !== source.id || versionIdentity(current) !== versionIdentity(source))
              throw new Error("The vault changed during plugin installation. Please try again.");
          }
          return installRepositories(
            updates.map(({ source }) => source.url),
            context,
            new Map(
              checked.flatMap(({ source, pinned }) => (pinned ? [[source.repository, pinned] as const] : [])),
            ),
          );
        }
      : null,
  };
}

async function checkSourceVersion(
  source: ReturnType<typeof listCatalogSources>[number],
): Promise<CheckedSourceVersion> {
  if (isUploadedSource(source.repository)) return { result: { id: source.id } };
  try {
    const pinned = await sourceManifest(source.repository, source.branch);
    return {
      pinned,
      result: {
        id: source.id,
        availableVersion: pinned.manifest.version,
        updateAvailable: !versionAtLeast(source.version, pinned.manifest.version),
      },
    };
  } catch (error) {
    return {
      result: {
        id: source.id,
        error: error instanceof Error ? error.message : "Could not check for updates",
      },
    };
  }
}
