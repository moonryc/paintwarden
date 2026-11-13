import { isColorCategory } from "@paint-vault/core/color-categories";
import { PAINT_TYPE_IDS, type PaintType } from "@paint-vault/core/paint-types";
import { RECIPE_STEP_IDS, SCHEME_MILESTONE_LABELS, type RecipeStep } from "@paint-vault/core/recipe-steps";
import { TEXT_LIMITS as LIMIT } from "@paint-vault/core/text-limits";
import { UUID_PATTERN } from "@paint-vault/core/vault-ids";

import { APP_VERSION } from "./app-version.ts";

// The catalog source format, version 1. A source is a GitHub repository with source.json,
// catalog.json, assets.json and an images/ folder; docs/source-format.md is the public spec.
// Validation is strict: a field this version doesn't know is an error, so a source never loses
// data silently on an older app. Sources that need a newer app set `minimumAppVersion`.
export const SOURCE_FORMAT_VERSION = 1;

// Item IDs and scheme entry IDs are lowercase random UUIDs, so items from different sources and
// vaults never collide by accident. Two sources share an item only by shipping the same UUID on
// purpose. A UUID has no `:`, so it can't take the vault's `user:` form either.
export const SOURCE_ID_PATTERN = UUID_PATTERN;
const ASSET_PATH_PATTERN = /^images\/[a-z\d][a-z\d._-]*\.(?:avif|gif|jpe?g|png|webp)$/i;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const COLOR_PATTERN = /^#[\da-f]{6}$/i;

export type Dependency = { repository: string; minimumVersion?: string };
export type Manifest = {
  formatVersion: typeof SOURCE_FORMAT_VERSION;
  name: string;
  version: string;
  license?: string;
  attribution?: string;
  minimumAppVersion?: string;
  dependencies: Dependency[];
  catalog: "catalog.json";
  assets: "assets.json";
};
export type Asset = { originalUrl?: string; sha256: string };
export type Paint = {
  id: string;
  brand: string;
  range: string;
  name: string;
  type?: PaintType | null;
  discontinued?: boolean;
  colorHex?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
};
export type Entry =
  | { id: string; type: "PAINT"; paintId: string }
  | { id: string; type: "STEP"; label: RecipeStep }
  | { id: string; type: "MILESTONE"; label: string }
  | {
      id: string;
      type: "IMAGE";
      imageUrl: string;
      thumbnailUrl?: string | null;
      imageType?: string | null;
      method?: string | null;
    };
export type Scheme = { id: string; name: string; category: string; entries: Entry[] };
export type TemplatePaint = { paintId: string; step: RecipeStep; notes: string; sortOrder: number };
export type Template = {
  id: string;
  name: string;
  manufacturer: string;
  faction: string;
  categories: string[];
  imageUrl?: string | null;
  schemeIds: string[];
  paints: TemplatePaint[];
};
export type Catalog = { paints: Paint[]; schemes: Scheme[]; templates: Template[] };

export class SourceFormatError extends Error {}

type Obj = Record<string, unknown>;
type Check = (value: unknown) => boolean;

const text =
  (max: number, { empty = false } = {}): Check =>
  (value) =>
    typeof value === "string" && value.length <= max && (empty || !!value.trim());
const nullable =
  (check: Check): Check =>
  (value) =>
    value === null || check(value);
const matches =
  (pattern: RegExp, max = 200): Check =>
  (value) =>
    typeof value === "string" && value.length <= max && pattern.test(value);
const oneOf =
  (values: Set<string>): Check =>
  (value) =>
    typeof value === "string" && values.has(value);
const listOf =
  (check: Check): Check =>
  (value) =>
    Array.isArray(value) && value.every(check);
const isId = matches(SOURCE_ID_PATTERN);
const isAsset = matches(ASSET_PATH_PATTERN);
const isVersion = matches(VERSION_PATTERN, 40);
const isHttps: Check = (value) => {
  if (typeof value !== "string" || value.length > LIMIT.url) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

// Checks one object against its required and optional fields, naming the first problem.
function checkObject(
  value: unknown,
  where: string,
  required: Record<string, Check>,
  optional: Record<string, Check> = {},
): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SourceFormatError(`${where} must be an object`);
  const row = value as Obj;
  for (const key of Object.keys(row))
    if (!(key in required) && !(key in optional))
      throw new SourceFormatError(`${where} has an unknown field "${key}"`);
  for (const [key, check] of Object.entries(required)) {
    if (!(key in row)) throw new SourceFormatError(`${where} is missing "${key}"`);
    if (!check(row[key])) throw new SourceFormatError(`${where} has an invalid "${key}"`);
  }
  for (const [key, check] of Object.entries(optional))
    if (key in row && !check(row[key])) throw new SourceFormatError(`${where} has an invalid "${key}"`);
  return row;
}

// Names a row in error messages by its name, since IDs are UUIDs, and by its position.
const label = (kind: string, index: number, row: unknown) => {
  const name = row && typeof row === "object" ? (row as Obj).name : undefined;
  return typeof name === "string" && name.trim()
    ? `${kind} ${index + 1} ("${name.trim().slice(0, 80)}")`
    : `${kind} ${index + 1}`;
};

export function versionAtLeast(actual: string, minimum: string) {
  const a = actual.split(".").map(Number),
    b = minimum.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

export function parseManifest(value: unknown): Manifest {
  const formatVersion = value && typeof value === "object" ? (value as Obj).formatVersion : undefined;
  if (formatVersion !== SOURCE_FORMAT_VERSION)
    throw new SourceFormatError(
      typeof formatVersion === "number" && formatVersion > SOURCE_FORMAT_VERSION
        ? "This source needs a newer version of Paint Vault"
        : `This source uses an unsupported format. Paint Vault reads formatVersion ${SOURCE_FORMAT_VERSION}`,
    );
  const manifest = checkObject(
    value,
    "source.json",
    {
      formatVersion: () => true,
      name: text(120),
      version: isVersion,
      dependencies: Array.isArray,
      catalog: (file) => file === "catalog.json",
      assets: (file) => file === "assets.json",
    },
    { license: text(100), attribution: text(1000), minimumAppVersion: isVersion },
  ) as Manifest;
  manifest.dependencies.forEach((dependency, index) =>
    checkObject(
      dependency,
      `source.json dependency ${index + 1}`,
      { repository: text(300) },
      { minimumVersion: isVersion },
    ),
  );
  if (manifest.minimumAppVersion && !versionAtLeast(APP_VERSION, manifest.minimumAppVersion))
    throw new SourceFormatError(
      `${manifest.name} needs Paint Vault ${manifest.minimumAppVersion} or newer (this is ${APP_VERSION})`,
    );
  return manifest;
}

function checkEntries(scheme: Obj, where: string) {
  const entries = scheme.entries as unknown[];
  const ids = new Set<unknown>();
  let inStep = false;
  entries.forEach((entry, index) => {
    const at = `${where} entry ${index + 1}`;
    const type = entry && typeof entry === "object" ? (entry as Obj).type : undefined;
    const base = { id: isId, type: () => true };
    if (type === "PAINT") {
      checkObject(entry, at, { ...base, paintId: isId });
      if (!inStep) throw new SourceFormatError(`${at} is a paint outside a STEP`);
    } else if (type === "STEP") {
      checkObject(entry, at, { ...base, label: oneOf(RECIPE_STEP_IDS) });
      inStep = true;
    } else if (type === "MILESTONE") {
      checkObject(entry, at, { ...base, label: oneOf(SCHEME_MILESTONE_LABELS) });
      inStep = false;
    } else if (type === "IMAGE")
      checkObject(
        entry,
        at,
        { ...base, imageUrl: isAsset },
        {
          thumbnailUrl: nullable(isAsset),
          imageType: nullable(text(LIMIT.imageLabel)),
          method: nullable(text(LIMIT.imageLabel)),
        },
      );
    else throw new SourceFormatError(`${at} has an invalid "type"`);
    const id = (entry as Obj).id;
    if (ids.has(id)) throw new SourceFormatError(`${where} has a duplicate entry ID "${String(id)}"`);
    ids.add(id);
  });
}

function checkUnique(rows: Obj[], kind: string) {
  const seen = new Set<unknown>();
  for (const row of rows) {
    if (seen.has(row.id)) throw new SourceFormatError(`Duplicate ${kind} ID "${String(row.id)}"`);
    seen.add(row.id);
  }
}

export function parseCatalog(value: unknown): Catalog {
  const catalog = checkObject(value, "catalog.json", {
    paints: Array.isArray,
    schemes: Array.isArray,
    templates: Array.isArray,
  }) as Record<keyof Catalog, unknown[]>;
  const paints = catalog.paints.map((paint, index) =>
    checkObject(
      paint,
      label("Paint", index, paint),
      { id: isId, brand: text(LIMIT.paintBrand), range: text(LIMIT.paintRange), name: text(LIMIT.name) },
      {
        type: nullable(oneOf(PAINT_TYPE_IDS)),
        discontinued: (flag) => typeof flag === "boolean",
        colorHex: nullable(matches(COLOR_PATTERN)),
        sourceUrl: nullable(isHttps),
        sourceLabel: nullable(text(LIMIT.paintSourceLabel)),
      },
    ),
  );
  const schemes = catalog.schemes.map((scheme, index) => {
    const where = label("Scheme", index, scheme);
    const row = checkObject(scheme, where, {
      id: isId,
      name: text(LIMIT.name),
      category: isColorCategory,
      entries: Array.isArray,
    });
    checkEntries(row, where);
    return row;
  });
  const templates = catalog.templates.map((template, index) => {
    const where = label("Template", index, template);
    const row = checkObject(
      template,
      where,
      {
        id: isId,
        name: text(LIMIT.name),
        manufacturer: text(LIMIT.detail, { empty: true }),
        faction: text(LIMIT.detail, { empty: true }),
        categories: listOf(text(LIMIT.templateCategory)),
        schemeIds: listOf(isId),
        paints: Array.isArray,
      },
      { imageUrl: nullable(isAsset) },
    );
    const schemeIds = row.schemeIds as string[];
    if (new Set(schemeIds).size !== schemeIds.length)
      throw new SourceFormatError(`${where} lists a scheme more than once`);
    const steps = new Set<string>();
    (row.paints as unknown[]).forEach((paint, paintIndex) => {
      const at = `${where} paint ${paintIndex + 1}`;
      const entry = checkObject(paint, at, {
        paintId: isId,
        step: oneOf(RECIPE_STEP_IDS),
        notes: text(LIMIT.stepNotes, { empty: true }),
        sortOrder: Number.isInteger,
      });
      const key = `${String(entry.step)}:${String(entry.paintId)}`;
      if (steps.has(key)) throw new SourceFormatError(`${at} repeats a paint within the same step`);
      steps.add(key);
    });
    return row;
  });
  checkUnique(paints, "paint");
  checkUnique(schemes, "scheme");
  checkUnique(templates, "template");
  return catalog as unknown as Catalog;
}

export function imagePaths(catalog: Catalog) {
  const paths = new Set<string>();
  for (const scheme of catalog.schemes)
    for (const entry of scheme.entries)
      if (entry.type === "IMAGE") {
        paths.add(entry.imageUrl);
        if (entry.thumbnailUrl) paths.add(entry.thumbnailUrl);
      }
  for (const template of catalog.templates) if (template.imageUrl) paths.add(template.imageUrl);
  return paths;
}

export function parseAssets(value: unknown, needed: Set<string>): Record<string, Asset> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SourceFormatError("assets.json must be an object");
  const records = value as Record<string, unknown>;
  for (const [filename, asset] of Object.entries(records)) {
    if (!isAsset(filename))
      throw new SourceFormatError(`assets.json has an invalid image path "${filename}"`);
    checkObject(
      asset,
      `assets.json "${filename}"`,
      { sha256: matches(/^[a-f\d]{64}$/i, 64) },
      { originalUrl: text(2000, { empty: true }) },
    );
  }
  for (const filename of needed)
    if (!records[filename]) throw new SourceFormatError(`assets.json is missing ${filename}`);
  return records as Record<string, Asset>;
}
