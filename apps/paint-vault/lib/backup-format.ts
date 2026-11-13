import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import {
  catalogSourceAssets,
  catalogSourceItems,
  catalogSources,
  colorSchemeDividers,
  colorSchemeImages,
  colorSchemePaints,
  colorSchemes,
  miniatureColorSchemes,
  miniaturePaintSubstitutions,
  miniatureRecipeSteps,
  miniatureRequiredPaints,
  miniatureTemplatePaints,
  miniatureTemplateSchemes,
  miniatureTemplates,
  miniatures,
  paintCatalog,
  paintInventory,
  paintSubstitutionIngredients,
  paintSubstitutions,
} from "../db/schema.ts";

// A backup is a .zip holding `backup.json` and an `images/` folder. This file is the contract for
// backup.json: each section lists exactly which fields it stores, so renaming or adding a database
// column never changes the file format by accident. A change to these lists needs a new version.
export const BACKUP_FORMAT = "paint-vault-backup";
export const BACKUP_VERSION = 1;
export const BACKUP_MANIFEST = "backup.json";
export const BACKUP_IMAGE_FOLDER = "images/";

export type BackupSection = {
  table: SQLiteTable;
  fields: readonly string[];
  // How a merge treats the section. A parent row is added only when its ID is new; a child row is
  // added only with a parent the same merge added; any other row is added when its key is new.
  merge: { parent: true } | { childOf: string; field: string } | { skipExisting: true };
};

const timestamps = ["updatedAt"] as const;

// Sections are listed in an order that satisfies foreign keys when inserted top to bottom.
export const BACKUP_SECTIONS = {
  plugins: {
    table: catalogSources,
    fields: [
      "id",
      "repository",
      "url",
      "branch",
      "name",
      "version",
      "license",
      "attribution",
      "dependencies",
      "lastError",
      "logoSvg",
      ...timestamps,
    ],
    merge: { parent: true },
  },
  paints: {
    table: paintCatalog,
    fields: [
      "id",
      "brand",
      "range",
      "name",
      "type",
      "discontinued",
      "colorHex",
      "sourceUrl",
      "sourceLabel",
      ...timestamps,
    ],
    merge: { parent: true },
  },
  pluginItems: {
    table: catalogSourceItems,
    fields: ["sourceId", "kind", "itemId"],
    merge: { skipExisting: true },
  },
  pluginImages: {
    table: catalogSourceAssets,
    fields: ["sourceId", "assetPath", "imageKey", "sha256"],
    merge: { skipExisting: true },
  },
  paintInventory: {
    table: paintInventory,
    fields: ["paintId", "state", "stockLevel", "quantity", ...timestamps],
    merge: { skipExisting: true },
  },
  schemes: {
    table: colorSchemes,
    fields: ["id", "name", "category", "createdAt", ...timestamps],
    merge: { parent: true },
  },
  schemePaints: {
    table: colorSchemePaints,
    fields: ["schemeId", "paintId", "sortOrder", ...timestamps],
    merge: { childOf: "schemes", field: "schemeId" },
  },
  schemeDividers: {
    table: colorSchemeDividers,
    fields: ["id", "schemeId", "label", "tone", "role", "sortOrder", ...timestamps],
    merge: { childOf: "schemes", field: "schemeId" },
  },
  schemeImages: {
    table: colorSchemeImages,
    fields: ["id", "schemeId", "imageUrl", "thumbnailUrl", "imageType", "method", "sortOrder", ...timestamps],
    merge: { childOf: "schemes", field: "schemeId" },
  },
  templates: {
    table: miniatureTemplates,
    fields: [
      "id",
      "name",
      "manufacturer",
      "faction",
      "categories",
      "imageKey",
      "imageUrl",
      "createdAt",
      ...timestamps,
    ],
    merge: { parent: true },
  },
  templateSchemes: {
    table: miniatureTemplateSchemes,
    fields: ["templateId", "schemeId", "sortOrder", ...timestamps],
    merge: { childOf: "templates", field: "templateId" },
  },
  templatePaints: {
    table: miniatureTemplatePaints,
    fields: ["templateId", "sortOrder", "paintId", "step", "notes", ...timestamps],
    merge: { childOf: "templates", field: "templateId" },
  },
  miniatures: {
    table: miniatures,
    fields: [
      "id",
      "title",
      "status",
      "notes",
      "manufacturer",
      "faction",
      "scale",
      "paintingStatus",
      "imageKey",
      "sourceImageUrl",
      "createdAt",
      ...timestamps,
    ],
    merge: { parent: true },
  },
  miniatureRecipe: {
    table: miniatureRequiredPaints,
    fields: ["id", "miniatureId", "paintId", "step", "notes", "sortOrder", ...timestamps],
    merge: { childOf: "miniatures", field: "miniatureId" },
  },
  miniatureSteps: {
    table: miniatureRecipeSteps,
    fields: ["miniatureId", "step", ...timestamps],
    merge: { childOf: "miniatures", field: "miniatureId" },
  },
  miniatureSchemes: {
    table: miniatureColorSchemes,
    fields: ["miniatureId", "schemeId", "sortOrder", ...timestamps],
    merge: { childOf: "miniatures", field: "miniatureId" },
  },
  substitutions: {
    table: paintSubstitutions,
    fields: ["id", "targetPaintId", "name", "isDefault", "createdAt", ...timestamps],
    merge: { parent: true },
  },
  substitutionIngredients: {
    table: paintSubstitutionIngredients,
    fields: ["substitutionId", "paintId", "parts", "sortOrder", ...timestamps],
    merge: { childOf: "substitutions", field: "substitutionId" },
  },
  miniatureSubstitutions: {
    table: miniaturePaintSubstitutions,
    fields: ["miniatureId", "targetPaintId", "substitutionId", "useOriginal", ...timestamps],
    merge: { childOf: "miniatures", field: "miniatureId" },
  },
} satisfies Record<string, BackupSection>;

export type BackupSectionKey = keyof typeof BACKUP_SECTIONS;
export type BackupRow = Record<string, unknown>;
export type BackupTables = Partial<Record<BackupSectionKey, BackupRow[]>>;

export type BackupManifest = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  // The Paint Vault release that wrote the backup, for diagnosing and migrating older files.
  appVersion: string;
  exportedAt: string;
  tables: BackupTables;
  // Keys of the files stored under images/.
  images: string[];
};

export const SECTION_KEYS = Object.keys(BACKUP_SECTIONS) as BackupSectionKey[];

// Keeps only the section's listed fields, so a row read from a file can't write other columns.
export function pickFields(section: BackupSectionKey, row: BackupRow) {
  const picked: BackupRow = {};
  for (const field of BACKUP_SECTIONS[section].fields) if (field in row) picked[field] = row[field];
  return picked;
}
