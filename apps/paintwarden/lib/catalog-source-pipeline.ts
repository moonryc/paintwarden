import { setImmediate } from "node:timers/promises";

import type { ZipSource } from "@paintwarden/core/zip-reader";
import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { catalogSources } from "../db/schema";

import { createCatalogImageStage, sweepCatalogImageStages } from "./catalog-image-staging";
import { checkInstallCancelled, installProgress, type InstallContext } from "./catalog-install-context";
import { downloadAssets, readSourceJson, type SourceFileReader } from "./catalog-source-assets";
import {
  prepareCatalogInstall,
  executeCatalogInstall,
  type PreparedCatalogInstall,
} from "./catalog-source-install";
import { readSourceZip } from "./catalog-source-upload";
import {
  defaultBranch,
  fetchSourceLogo,
  normalizeRepository,
  rawUrl,
  requestBytes,
  sourceManifest,
} from "./github-source";
import { withImageMutation } from "./image-mutations";
import { deleteImages, imageFileIdentity } from "./image-store";
import {
  imagePaths,
  parseAssets,
  parseCatalog,
  versionAtLeast,
  type Asset,
  type Catalog,
  type Manifest,
} from "./source-format";

// The complete dependency graph is read/checked before any image or database write.
type PreparedSource = {
  id: string;
  sourceId: string;
  url: string;
  branch: string;
  manifest: Manifest;
  expected: ReturnType<typeof installedSource>;
  read?: SourceFileReader;
  catalogData?: unknown;
  assetData?: unknown;
  catalog?: Catalog;
  records?: Record<string, Asset>;
  needed?: Set<string>;
  downloaded?: Awaited<ReturnType<typeof downloadAssets>>;
  logo?: string | null;
};

function installedSource(repository: string) {
  return getDb().select().from(catalogSources).where(eq(catalogSources.repository, repository)).get();
}

// Automatic refresh can hand its pinned manifest probes to the install without fetching twice.
export type RepositoryManifests = ReadonlyMap<string, Awaited<ReturnType<typeof sourceManifest>>>;
type Preparation = {
  sources: Map<string, PreparedSource>;
  context: InstallContext;
  readingDone: number;
  manifests?: RepositoryManifests;
};

async function readCatalog(source: PreparedSource) {
  [source.catalogData, source.assetData] = await Promise.all([
    readSourceJson(source.read!, source.manifest.catalog, 50_000_000),
    readSourceJson(source.read!, source.manifest.assets, 5_000_000),
  ]);
}

async function dependencies(manifest: Manifest, state: Preparation, stack: Set<string>) {
  for (const dependency of manifest.dependencies) {
    checkInstallCancelled(state.context);
    const required = normalizeRepository(dependency.repository);
    await prepareRepository(required.url, state, stack);
    const version = state.sources.get(required.id)?.manifest.version;
    if (dependency.minimumVersion && (!version || !versionAtLeast(version, dependency.minimumVersion)))
      throw new Error(`${manifest.name} needs a newer version of ${required.id}`);
  }
}

async function prepareRepository(input: string, state: Preparation, stack: Set<string>) {
  checkInstallCancelled(state.context);
  const { id, url } = normalizeRepository(input);
  if (stack.has(id)) throw new Error(`Circular source dependency: ${id}`);
  if (state.sources.has(id)) return;
  stack.add(id);
  try {
    const expected = installedSource(id);
    const branch = expected?.branch ?? (await defaultBranch(id, state.context.signal));
    const { manifest, revision } =
      state.manifests?.get(id) ?? (await sourceManifest(id, branch, state.context.signal));
    await dependencies(manifest, state, stack);
    if (expected && !versionAtLeast(manifest.version, expected.version))
      throw new Error(
        `${id} now has version ${manifest.version}, older than the installed ${expected.version}. The installed version is kept`,
      );
    const source: PreparedSource = {
      id,
      sourceId: expected?.id ?? crypto.randomUUID(),
      url,
      branch,
      manifest,
      expected,
    };
    if (expected?.version !== manifest.version) {
      source.read = (filename, maxBytes) =>
        requestBytes(rawUrl(id, revision, filename), maxBytes, state.context.signal);
      await readCatalog(source);
    }
    source.logo = await fetchSourceLogo(id, revision, state.context.signal);
    state.sources.set(id, source);
    installProgress(state.context, "reading", ++state.readingDone, state.readingDone + stack.size - 1);
  } finally {
    stack.delete(id);
  }
}

// Direct callers, REST and background auto-updates all share this fail-fast guard. It covers
// ZIP directory/manifest reading too, not merely the eventual transaction.
let installing = false;

async function installPrepared(
  prepare: (state: Preparation) => Promise<string[]>,
  context: InstallContext,
  manifests?: RepositoryManifests,
) {
  if (installing) throw new Error("A plugin install is already running");
  installing = true;
  let stage: Awaited<ReturnType<typeof createCatalogImageStage>> | undefined;
  let committed = false;
  try {
    installProgress(context, "reading", 0, 0);
    await sweepCatalogImageStages();
    const state: Preparation = { sources: new Map(), context, readingDone: 0, manifests };
    const rootIds = await prepare(state);
    const sources = [...state.sources.values()];
    installProgress(context, "checking", 0, sources.length);
    for (const [index, source] of sources.entries()) {
      if (source.read) {
        source.catalog = parseCatalog(source.catalogData);
        source.needed = imagePaths(source.catalog);
        source.records = parseAssets(source.assetData, source.needed);
        source.catalogData = source.assetData = undefined;
      }
      installProgress(context, "checking", index + 1, sources.length);
      await setImmediate();
    }
    stage = await createCatalogImageStage();
    const imagesTotal = sources.reduce((total, source) => total + (source.needed?.size ?? 0), 0);
    let imagesDone = 0;
    installProgress(context, "images", 0, imagesTotal);
    for (const source of sources) {
      if (!source.read) continue;
      source.downloaded = await downloadAssets(
        source.sourceId,
        source.read,
        source.records!,
        source.needed!,
        stage,
        context,
        () => installProgress(context, "images", ++imagesDone, imagesTotal),
      );
    }
    const writes: PreparedCatalogInstall[] = [];
    const dataTotal = sources.reduce(
      (total, source) =>
        total +
        (source.catalog
          ? source.catalog.paints.length + source.catalog.schemes.length + source.catalog.templates.length
          : 0),
      0,
    );
    let dataDone = 0;
    installProgress(context, "preparing", 0, dataTotal);
    for (const source of sources) {
      if (source.catalog && source.downloaded) {
        writes.push(
          prepareCatalogInstall(
            source.sourceId,
            source.id,
            source.url,
            source.branch,
            source.manifest,
            source.catalog,
            source.downloaded.result,
            writes,
          ),
        );
        dataDone +=
          source.catalog.paints.length + source.catalog.schemes.length + source.catalog.templates.length;
      }
      installProgress(context, "preparing", dataDone, dataTotal);
      await setImmediate();
    }
    const finalWrites = sources.map((source) => {
      const values = { lastError: null, ...(source.logo !== undefined ? { logoSvg: source.logo } : {}) };
      return getDb()
        .update(catalogSources)
        .set(values)
        .where(eq(catalogSources.id, source.sourceId))
        .prepare();
    });
    await withImageMutation(async () => {
      // Async preparation must never resurrect a source removed/changed by another operation.
      for (const source of sources) {
        if (JSON.stringify(installedSource(source.id)) !== JSON.stringify(source.expected))
          throw new Error("The vault changed during plugin installation. Please try again.");
        for (const [key, identity] of source.downloaded?.reused ?? [])
          if ((await imageFileIdentity(key)) !== identity)
            throw new Error("The vault changed during plugin installation. Please try again.");
      }
      installProgress(context, "committing", 0, 1);
      // No awaits or callbacks inside: no HTTP reader or edit interleaves promotion/commit.
      try {
        getDb().transaction((tx) => {
          for (const write of writes) executeCatalogInstall(tx, write);
          for (const write of finalWrites) write.run();
          stage!.promote();
        });
        committed = true;
      } catch (error) {
        stage!.rollback();
        throw error;
      }
      // Cleanup checks current references, including dropped-but-kept scheme photos and edits.
      // Post-commit housekeeping must not report an already committed install as failed.
      await deleteImages(
        sources.flatMap((source) => source.downloaded?.previous.map((asset) => asset.imageKey) ?? []),
      ).catch(() => undefined);
    });
    return rootIds.map((rootId) => {
      const root = state.sources.get(rootId)!;
      return {
        id: root.sourceId,
        repository: rootId,
        name: root.manifest.name,
        version: root.manifest.version,
        updated: !!root.catalog,
      };
    });
  } finally {
    if (stage) await stage.dispose().catch(() => undefined);
    installing = false;
    if (committed) {
      // A late cancel or observer failure cannot undo a successful commit.
      try {
        context.progress?.("committing", 1, 1);
      } catch {
        /* committed */
      }
    }
  }
}

export function installRepositories(
  inputs: string[],
  context: InstallContext = {},
  manifests?: RepositoryManifests,
) {
  return installPrepared(
    async (state) => {
      const ids: string[] = [];
      for (const input of inputs) {
        const { id } = normalizeRepository(input);
        await prepareRepository(input, state, new Set());
        ids.push(id);
      }
      return ids;
    },
    context,
    manifests,
  );
}

export function installRepository(input: string, context: InstallContext = {}) {
  return installRepositories([input], context).then(([result]) => result);
}

export function installUploadedSource(bytes: Uint8Array | ZipSource, context: InstallContext = {}) {
  return installPrepared(async (state) => {
    const upload = await readSourceZip(bytes, undefined, context.signal);
    const expected = installedSource(upload.id);
    const { version } = upload.manifest;
    if (expected && !versionAtLeast(version, expected.version))
      throw new Error(
        `${expected.name} ${expected.version} is installed, and this .zip has the older version ${version}. Remove the plugin first to install an older version`,
      );
    await dependencies(upload.manifest, state, new Set([upload.id]));
    if (state.sources.has(upload.id)) throw new Error(`Circular source dependency: ${upload.id}`);
    const source: PreparedSource = {
      id: upload.id,
      sourceId: expected?.id ?? crypto.randomUUID(),
      url: "",
      branch: "",
      manifest: upload.manifest,
      expected,
      logo: upload.logo,
    };
    if (expected?.version !== version) {
      source.read = upload.read;
      await readCatalog(source);
    }
    state.sources.set(upload.id, source);
    installProgress(context, "reading", ++state.readingDone, state.readingDone);
    return [upload.id];
  }, context).then(([result]) => result);
}
