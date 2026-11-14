import { createHash } from "node:crypto";

import { stepFromDivider } from "@paintwarden/core/recipe-steps";
import { isUserId, USER_ID_PREFIX } from "@paintwarden/core/vault-ids";
import { eq } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";

import { getDb } from "../../../db";
import {
  catalogSourceItems,
  catalogSources,
  colorSchemeDividers,
  colorSchemeImages,
  colorSchemePaints,
  colorSchemes,
  miniatureTemplates,
  paintCatalog,
} from "../../../db/schema";
import { isUploadedSource } from "../../../lib/catalog-source-upload";
import { loadImage } from "../../../lib/image-store";
import { BlockedUrlError, ResponseTooLargeError, downloadPublic } from "../../../lib/public-fetch";
import {
  imagePaths,
  parseAssets,
  parseCatalog,
  parseManifest,
  SOURCE_FORMAT_VERSION,
} from "../../../lib/source-format";
import { templateRecipes } from "../../../lib/template-recipes";

type Selection = {
  name?: string;
  version?: string;
  paintIds?: string[];
  schemeIds?: string[];
  templateIds?: string[];
};

export function GET() {
  const db = getDb();
  return Response.json({
    paints: db
      .select()
      .from(paintCatalog)
      .all()
      .filter((row) => isUserId(row.id))
      .map((row) => ({ id: row.id, name: `${row.brand} · ${row.name}` })),
    schemes: db
      .select()
      .from(colorSchemes)
      .all()
      .filter((row) => isUserId(row.id))
      .map((row) => ({ id: row.id, name: row.name })),
    templates: db
      .select()
      .from(miniatureTemplates)
      .all()
      .filter((row) => isUserId(row.id))
      .map((row) => ({ id: row.id, name: row.name })),
  });
}

function selectedIds(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error(`Invalid ${label} selection`);
  return [...new Set(value as string[])];
}

function imageExtension(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("avif")) return "avif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  throw new Error("Source image format is not supported");
}

async function imageBytes(url: string | null, imageKey?: string | null) {
  if (imageKey) {
    const image = await loadImage(imageKey);
    if (!image) throw new Error("A selected image is missing from this vault");
    return { bytes: new Uint8Array(image.bytes), contentType: image.contentType, originalUrl: "" };
  }
  if (!url) return null;
  if (url.startsWith("/api/catalog-source-images/")) {
    const image = await loadImage(url.split("/").at(-1)!);
    if (!image) throw new Error("A selected source image is missing from this vault");
    return { bytes: new Uint8Array(image.bytes), contentType: image.contentType, originalUrl: "" };
  }
  try {
    const image = await downloadPublic(new URL(url), { maxBytes: 30_000_000, httpsOnly: true });
    if (image.status < 200 || image.status >= 300) throw new Error("Image request failed");
    return { bytes: image.bytes, contentType: image.contentType, originalUrl: url };
  } catch (error) {
    if (error instanceof BlockedUrlError) throw new Error("A selected image must use a public HTTPS URL");
    if (error instanceof ResponseTooLargeError) throw new Error("A selected image is too large");
    throw new Error("A selected image could not be downloaded");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Selection;
    const name = body.name?.trim();
    const version = body.version?.trim();
    if (!name || name.length > 120) throw new Error("Give the source a name (up to 120 characters)");
    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Use a version like 1.0.0");
    const paintIds = selectedIds(body.paintIds, "paint");
    const schemeIds = selectedIds(body.schemeIds, "scheme");
    const templateIds = selectedIds(body.templateIds, "template");
    if (!paintIds.length && !schemeIds.length && !templateIds.length)
      throw new Error("Select at least one paint, scheme, or template");

    const db = getDb();
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "paintwarden-source";
    // Sources may not use the vault's `user:` prefix, so a shared item keeps the UUID after it;
    // exporting again gives the same IDs. Items from other sources keep their IDs.
    const exportId = (id: string) => (isUserId(id) ? id.slice(USER_ID_PREFIX.length) : id);
    const recipes = templateRecipes(db);
    const paintsById = new Map(
      db
        .select()
        .from(paintCatalog)
        .all()
        .map((row) => [row.id, row]),
    );
    const schemesById = new Map(
      db
        .select()
        .from(colorSchemes)
        .all()
        .map((row) => [row.id, row]),
    );
    const templatesById = new Map(
      db
        .select()
        .from(miniatureTemplates)
        .all()
        .map((row) => [row.id, row]),
    );
    const sourceById = new Map(
      db
        .select()
        .from(catalogSources)
        .all()
        .map((row) => [row.id, row]),
    );
    const ownerByItem = new Map(
      db
        .select()
        .from(catalogSourceItems)
        .all()
        .map((row) => [`${row.kind}:${row.itemId}`, row.sourceId]),
    );
    const dependencies = new Set<string>();
    const addDependency = (kind: "paint" | "scheme", id: string) => {
      const owner = ownerByItem.get(`${kind}:${id}`);
      const source = owner ? sourceById.get(owner) : undefined;
      if (!source) throw new Error(`Missing source for ${kind} ${id}`);
      // A dependency is a GitHub repository the recipient can install; an uploaded plugin has none.
      if (isUploadedSource(source.repository)) {
        const item = kind === "paint" ? paintsById.get(id)?.name : schemesById.get(id)?.name;
        throw new Error(
          `${item ?? `A ${kind}`} comes from ${source.name}, which was installed from a .zip. A plugin can only depend on plugins installed from GitHub`,
        );
      }
      dependencies.add(source.id);
    };
    const includedPaints = new Set<string>(),
      includedSchemes = new Set<string>(),
      includedTemplates = new Set<string>();
    const addPaint = (id: string, selected = false) => {
      const row = paintsById.get(id);
      if (!row) throw new Error(`Paint ${id} is missing`);
      if (!isUserId(row.id)) {
        if (selected) throw new Error("Only personal paints can be selected for sharing");
        addDependency("paint", id);
      } else includedPaints.add(id);
    };
    const addScheme = (id: string, selected = false) => {
      const row = schemesById.get(id);
      if (!row) throw new Error(`Scheme ${id} is missing`);
      if (!isUserId(row.id)) {
        if (selected) throw new Error("Only personal schemes can be selected for sharing");
        addDependency("scheme", id);
        return;
      }
      if (includedSchemes.has(id)) return;
      includedSchemes.add(id);
      for (const paint of db.select().from(colorSchemePaints).where(eq(colorSchemePaints.schemeId, id)).all())
        addPaint(paint.paintId);
    };
    for (const id of paintIds) addPaint(id, true);
    for (const id of schemeIds) addScheme(id, true);
    for (const id of templateIds) {
      const row = templatesById.get(id);
      if (!row || !isUserId(row.id)) throw new Error("Only personal templates can be selected for sharing");
      includedTemplates.add(id);
      const recipe = recipes.get(id)!;
      for (const schemeId of recipe.schemeIds) addScheme(schemeId);
      for (const paint of recipe.paints) addPaint(paint.paintId);
    }

    const files: Record<string, Uint8Array> = {};
    const assetRecords: Record<string, { originalUrl: string; sha256: string }> = {};
    const imageCache = new Map<string, string>();
    const packageImage = async (url: string | null, imageKey?: string | null) => {
      if (!url && !imageKey) return null;
      const cacheKey = imageKey || url!;
      if (imageCache.has(cacheKey)) return imageCache.get(cacheKey)!;
      const image = await imageBytes(url, imageKey);
      if (!image) return null;
      const sha256 = createHash("sha256").update(image.bytes).digest("hex");
      const filename = `images/${sha256}.${imageExtension(image.contentType)}`;
      files[filename] = image.bytes;
      assetRecords[filename] = { originalUrl: image.originalUrl, sha256 };
      imageCache.set(cacheKey, filename);
      return filename;
    };

    const exportedPaints = [];
    for (const id of includedPaints) {
      const paint = paintsById.get(id)!;
      exportedPaints.push({
        id: exportId(paint.id),
        brand: paint.brand,
        range: paint.range,
        name: paint.name,
        ...(paint.type ? { type: paint.type } : {}),
        ...(paint.discontinued ? { discontinued: true } : {}),
        // The source format only accepts #rrggbb colors and https links.
        colorHex: /^#[\da-f]{6}$/i.test(paint.colorHex ?? "") ? paint.colorHex : null,
        sourceUrl: paint.sourceUrl?.startsWith("https://") ? paint.sourceUrl : null,
        sourceLabel: name,
      });
    }
    const exportedSchemes = [];
    for (const id of includedSchemes) {
      const scheme = schemesById.get(id)!;
      if (!scheme.category) throw new Error(`Scheme ${scheme.name} needs a color category`);
      const entries = [
        ...db
          .select()
          .from(colorSchemePaints)
          .where(eq(colorSchemePaints.schemeId, id))
          .all()
          .map((row) => ({
            // Scheme paint rows have no ID of their own, so one is derived from their position.
            id: derivedUuid(`${id}:paint:${row.sortOrder}`),
            type: "PAINT" as const,
            paintId: row.paintId,
            sortOrder: row.sortOrder,
          })),
        ...db
          .select()
          .from(colorSchemeDividers)
          .where(eq(colorSchemeDividers.schemeId, id))
          .all()
          .map((row) => ({
            id: row.id,
            type: "DIVIDER" as const,
            label: row.label,
            tone: row.tone,
            sortOrder: row.sortOrder,
          })),
        ...db
          .select()
          .from(colorSchemeImages)
          .where(eq(colorSchemeImages.schemeId, id))
          .all()
          .map((row) => ({ ...row, type: "IMAGE" as const })),
      ].sort((a, b) => a.sortOrder - b.sortOrder);
      const exportedEntries = [];
      let insideStep = false;
      for (const entry of entries) {
        if (entry.type === "PAINT") {
          if (!insideStep) throw new Error(`Scheme ${scheme.name} has a paint outside a step`);
          exportedEntries.push({ id: entry.id, type: entry.type, paintId: exportId(entry.paintId) });
        } else if (entry.type === "DIVIDER") {
          insideStep = entry.tone === "SECTION";
          exportedEntries.push({
            id: entry.id,
            type: entry.tone === "SECTION" ? "STEP" : "MILESTONE",
            label:
              entry.tone === "SECTION"
                ? (stepFromDivider(entry.label) ?? entry.label.toUpperCase())
                : entry.label.toUpperCase(),
          });
        } else
          exportedEntries.push({
            id: entry.id,
            type: entry.type,
            imageUrl: await packageImage(entry.imageUrl),
            thumbnailUrl: await packageImage(entry.thumbnailUrl),
            imageType: entry.imageType,
            method: entry.method,
          });
      }
      exportedSchemes.push({
        id: exportId(id),
        name: scheme.name,
        category: scheme.category,
        entries: exportedEntries,
      });
    }
    const exportedTemplates = [];
    for (const id of includedTemplates) {
      const row = templatesById.get(id)!;
      const recipe = recipes.get(id)!;
      exportedTemplates.push({
        id: exportId(id),
        name: row.name,
        manufacturer: row.manufacturer,
        faction: row.faction,
        categories: row.categories.filter((category) => category !== "My templates").length
          ? row.categories.filter((category) => category !== "My templates")
          : ["Shared templates"],
        imageUrl: await packageImage(row.imageUrl, row.imageKey),
        schemeIds: recipe.schemeIds.map(exportId),
        paints: recipe.paints.map((paint) => ({ ...paint, paintId: exportId(paint.paintId) })),
      });
    }
    const dependencyRows = [...dependencies].sort().map((id) => {
      const source = sourceById.get(id)!;
      return { repository: source.url, minimumVersion: source.version };
    });
    const manifest = {
      formatVersion: SOURCE_FORMAT_VERSION,
      name,
      version,
      dependencies: dependencyRows,
      catalog: "catalog.json",
      assets: "assets.json",
    };
    const catalog = { paints: exportedPaints, schemes: exportedSchemes, templates: exportedTemplates };
    // The export is checked with the installer's own rules, so a shared source always installs.
    const checked = JSON.parse(JSON.stringify(catalog)) as unknown;
    parseManifest(manifest);
    parseAssets(assetRecords, imagePaths(parseCatalog(checked)));
    files["source.json"] = strToU8(`${JSON.stringify(manifest, null, 2)}\n`);
    files["catalog.json"] = strToU8(`${JSON.stringify(catalog)}\n`);
    files["assets.json"] = strToU8(`${JSON.stringify(assetRecords, null, 2)}\n`);
    const zip = zipSync(files, { level: 4 });
    const filename = `${slug}-${version}.zip`;
    return new Response(new Uint8Array(zip), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not export source" },
      { status: 400 },
    );
  }
}

// A UUID (version 5 layout) derived from a name, so the same row gets the same ID on every export.
function derivedUuid(name: string) {
  const bytes = createHash("sha1").update(`paintwarden:${name}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
