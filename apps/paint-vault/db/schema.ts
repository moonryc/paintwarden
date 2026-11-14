import { COLOR_CATEGORIES } from "@paint-vault/core/color-categories";
import { PAINT_TYPE_VALUES } from "@paint-vault/core/paint-types";
import { RECIPE_STEP_VALUES } from "@paint-vault/core/recipe-steps";
import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import {
  isBoolean,
  isColorHex,
  isImageKey,
  isItemId,
  isJsonArray,
  isUuid,
  maxLengths,
  oneOf,
  updatedAt,
  vaultTable,
} from "./schema-checks.ts";

const OWNERSHIP = ["OWNED", "WISHLIST"] as const;
const PAINTING_STATUSES = ["NOT_STARTED", "ASSEMBLED", "PRIMED", "IN_PROGRESS", "COMPLETE"] as const;
const STOCK_LEVELS = ["FULL", "LOW", "EMPTY"] as const;
const DIVIDER_TONES = ["SECTION", "MILESTONE"] as const;
// The two milestones every owner scheme starts and ends with.
export const DIVIDER_ROLES = ["START", "COMPLETE"] as const;
const SOURCE_ITEM_KINDS = ["paint", "scheme", "template"] as const;

// A plugin's id is a random UUID that the vault's rows refer to. `repository` is what identifies the
// plugin outside the vault: `owner/name` for a GitHub repository, or `upload:<name>` for one
// installed from a .zip. Dependencies and updates find a plugin by it.
export const catalogSources = vaultTable(
  "catalog_sources",
  {
    id: text("id").primaryKey(),
    repository: text("repository").notNull(),
    url: text("url").notNull(),
    branch: text("branch").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    // License and attribution text from the source's source.json, shown on the Plugins page.
    license: text("license"),
    attribution: text("attribution"),
    dependencies: text("dependencies", { mode: "json" })
      .$type<{ repository: string; minimumVersion?: string }[]>()
      .notNull(),
    updatedAt: integer("updated_at").notNull(),
    lastError: text("last_error"),
    // Optional logo.svg from the repository root, stored as validated SVG text.
    logoSvg: text("logo_svg"),
  },
  (t) => [
    uniqueIndex("catalog_sources_repository_idx").on(t.repository),
    isUuid("catalog_sources_id_check", t.id),
    isJsonArray("catalog_sources_dependencies_check", t.dependencies),
  ],
);

export const catalogSourceItems = vaultTable(
  "catalog_source_items",
  {
    sourceId: text("source_id")
      .notNull()
      .references(() => catalogSources.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: SOURCE_ITEM_KINDS }).notNull(),
    itemId: text("item_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sourceId, t.kind, t.itemId] }),
    index("catalog_source_items_item_idx").on(t.kind, t.itemId),
    oneOf("catalog_source_items_kind_check", t.kind, SOURCE_ITEM_KINDS),
    isUuid("catalog_source_items_item_id_check", t.itemId),
  ],
);

export const catalogSourceAssets = vaultTable(
  "catalog_source_assets",
  {
    sourceId: text("source_id")
      .notNull()
      .references(() => catalogSources.id, { onDelete: "cascade" }),
    assetPath: text("asset_path").notNull(),
    imageKey: text("image_key").notNull(),
    sha256: text("sha256").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sourceId, t.assetPath] }),
    isImageKey("catalog_source_assets_image_key_check", t.imageKey),
  ],
);

// A server holds one owner's vault by design, so the account table has at most one row.
export const vaultAccount = vaultTable(
  "vault_account",
  {
    id: integer("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    // Password changes advance this; a hash-only upgrade preserves the credential.
    credentialGeneration: integer("credential_generation").notNull().default(0),
    requireSignIn: integer("require_sign_in", { mode: "boolean" }).notNull().default(true),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("vault_account_single_owner_check", sql`${t.id} = 1`),
    isBoolean("vault_account_require_sign_in_check", t.requireSignIn),
  ],
);

export const vaultSessions = vaultTable(
  "vault_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("vault_sessions_expires_at_idx").on(t.expiresAt)],
);

export const miniatures = vaultTable(
  "miniatures",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    status: text("status", { enum: OWNERSHIP }).notNull(),
    notes: text("notes").notNull().default(""),
    manufacturer: text("manufacturer").notNull().default(""),
    faction: text("faction").notNull().default(""),
    scale: text("scale").notNull().default(""),
    paintingStatus: text("painting_status", { enum: PAINTING_STATUSES }).notNull().default("NOT_STARTED"),
    imageKey: text("image_key"),
    sourceImageUrl: text("source_image_url"),
    createdAt: integer("created_at").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    isUuid("miniatures_id_check", t.id),
    isImageKey("miniatures_image_key_check", t.imageKey),
    maxLengths("miniatures_lengths_check", [
      [t.title, "name"],
      [t.notes, "miniatureNotes"],
      [t.manufacturer, "detail"],
      [t.faction, "detail"],
      [t.scale, "detail"],
      [t.sourceImageUrl, "url"],
    ]),
    oneOf("miniatures_status_check", t.status, OWNERSHIP),
    oneOf("miniatures_painting_status_check", t.paintingStatus, PAINTING_STATUSES),
  ],
);

export const miniatureTemplates = vaultTable(
  "miniature_templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    manufacturer: text("manufacturer").notNull().default(""),
    faction: text("faction").notNull().default(""),
    categories: text("categories", { mode: "json" }).$type<string[]>().notNull().default([]),
    imageKey: text("image_key"),
    imageUrl: text("image_url"),
    createdAt: integer("created_at").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    isItemId("miniature_templates_id_check", t.id),
    isImageKey("miniature_templates_image_key_check", t.imageKey),
    maxLengths("miniature_templates_lengths_check", [
      [t.name, "name"],
      [t.manufacturer, "detail"],
      [t.faction, "detail"],
      [t.imageUrl, "url"],
    ]),
    isJsonArray("miniature_templates_categories_check", t.categories),
  ],
);

export const miniatureTemplateSchemes = vaultTable(
  "miniature_template_schemes",
  {
    templateId: text("template_id")
      .notNull()
      .references(() => miniatureTemplates.id, { onDelete: "cascade" }),
    schemeId: text("scheme_id")
      .notNull()
      .references(() => colorSchemes.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.templateId, t.schemeId] }),
    index("miniature_template_schemes_scheme_idx").on(t.schemeId),
  ],
);

export const miniatureTemplatePaints = vaultTable(
  "miniature_template_paints",
  {
    templateId: text("template_id")
      .notNull()
      .references(() => miniatureTemplates.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    paintId: text("paint_id")
      .notNull()
      .references(() => paintCatalog.id, { onDelete: "cascade" }),
    step: text("step", { enum: RECIPE_STEP_VALUES }).notNull().default("OTHER"),
    notes: text("notes").notNull().default(""),
    updatedAt: updatedAt(),
  },
  // Like a miniature's recipe, a template may repeat a paint across steps but not within one.
  (t) => [
    primaryKey({ columns: [t.templateId, t.sortOrder] }),
    uniqueIndex("miniature_template_paints_step_paint_idx").on(t.templateId, t.step, t.paintId),
    maxLengths("miniature_template_paints_lengths_check", [[t.notes, "stepNotes"]]),
    index("miniature_template_paints_paint_idx").on(t.paintId),
    oneOf("miniature_template_paints_step_check", t.step, RECIPE_STEP_VALUES),
  ],
);

// Paints with a `user:` ID are the owner's own; every other paint comes from a catalog source.
export const paintCatalog = vaultTable(
  "paint_catalog",
  {
    id: text("id").primaryKey(),
    brand: text("brand").notNull(),
    range: text("range").notNull(),
    name: text("name").notNull(),
    type: text("type", { enum: PAINT_TYPE_VALUES }),
    discontinued: integer("discontinued", { mode: "boolean" }).notNull().default(false),
    colorHex: text("color_hex"),
    sourceUrl: text("source_url"),
    sourceLabel: text("source_label"),
    updatedAt: updatedAt(),
  },
  (t) => [
    isItemId("paint_catalog_id_check", t.id),
    maxLengths("paint_catalog_lengths_check", [
      [t.brand, "paintBrand"],
      [t.range, "paintRange"],
      [t.name, "name"],
      [t.sourceUrl, "url"],
      [t.sourceLabel, "paintSourceLabel"],
    ]),
    oneOf("paint_catalog_type_check", t.type, PAINT_TYPE_VALUES, true),
    isBoolean("paint_catalog_discontinued_check", t.discontinued),
    isColorHex("paint_catalog_color_hex_check", t.colorHex),
  ],
);

export const paintInventory = vaultTable(
  "paint_inventory",
  {
    paintId: text("paint_id")
      .primaryKey()
      .references(() => paintCatalog.id, { onDelete: "cascade" }),
    state: text("state", { enum: OWNERSHIP }).notNull(),
    stockLevel: text("stock_level", { enum: STOCK_LEVELS }).notNull().default("FULL"),
    quantity: integer("quantity").notNull().default(1),
    updatedAt: updatedAt(),
  },
  (t) => [
    oneOf("paint_inventory_state_check", t.state, OWNERSHIP),
    oneOf("paint_inventory_stock_level_check", t.stockLevel, STOCK_LEVELS),
    check("paint_inventory_quantity_check", sql`${t.quantity} >= 0`),
  ],
);

export const paintSubstitutions = vaultTable(
  "paint_substitutions",
  {
    id: text("id").primaryKey(),
    targetPaintId: text("target_paint_id")
      .notNull()
      .references(() => paintCatalog.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    isUuid("paint_substitutions_id_check", t.id),
    maxLengths("paint_substitutions_lengths_check", [[t.name, "substitutionName"]]),
    index("paint_substitutions_target_paint_idx").on(t.targetPaintId),
    // A paint has at most one default substitution.
    uniqueIndex("paint_substitutions_default_idx")
      .on(t.targetPaintId)
      .where(sql`${t.isDefault} = 1`),
    isBoolean("paint_substitutions_is_default_check", t.isDefault),
  ],
);

export const paintSubstitutionIngredients = vaultTable(
  "paint_substitution_ingredients",
  {
    substitutionId: text("substitution_id")
      .notNull()
      .references(() => paintSubstitutions.id, { onDelete: "cascade" }),
    paintId: text("paint_id")
      .notNull()
      .references(() => paintCatalog.id, { onDelete: "cascade" }),
    parts: integer("parts").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.substitutionId, t.paintId] }),
    index("paint_substitution_ingredients_paint_idx").on(t.paintId),
    check("paint_substitution_ingredients_parts_check", sql`${t.parts} >= 1`),
  ],
);

export const miniaturePaintSubstitutions = vaultTable(
  "miniature_paint_substitutions",
  {
    miniatureId: text("miniature_id")
      .notNull()
      .references(() => miniatures.id, { onDelete: "cascade" }),
    targetPaintId: text("target_paint_id")
      .notNull()
      .references(() => paintCatalog.id, { onDelete: "cascade" }),
    substitutionId: text("substitution_id").references(() => paintSubstitutions.id, { onDelete: "cascade" }),
    useOriginal: integer("use_original", { mode: "boolean" }).notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.miniatureId, t.targetPaintId] }),
    index("miniature_paint_substitutions_target_paint_idx").on(t.targetPaintId),
    index("miniature_paint_substitutions_substitution_idx").on(t.substitutionId),
    // A choice is either the original paint or one substitution, never both or neither.
    check(
      "miniature_paint_substitutions_choice_check",
      sql`(${t.useOriginal} = 1 AND ${t.substitutionId} IS NULL) OR (${t.useOriginal} = 0 AND ${t.substitutionId} IS NOT NULL)`,
    ),
  ],
);

// A miniature's paint recipe. Each row has its own ID, so a paint may appear in more than one
// step (for example as a basecoat and again as a highlight), but only once within a step.
export const miniatureRequiredPaints = vaultTable(
  "miniature_required_paints",
  {
    id: text("id").primaryKey(),
    miniatureId: text("miniature_id")
      .notNull()
      .references(() => miniatures.id, { onDelete: "cascade" }),
    paintId: text("paint_id")
      .notNull()
      .references(() => paintCatalog.id, { onDelete: "cascade" }),
    step: text("step", { enum: RECIPE_STEP_VALUES }).notNull().default("OTHER"),
    notes: text("notes").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    isUuid("miniature_required_paints_id_check", t.id),
    maxLengths("miniature_required_paints_lengths_check", [[t.notes, "stepNotes"]]),
    uniqueIndex("miniature_required_paints_step_paint_idx").on(t.miniatureId, t.step, t.paintId),
    index("miniature_required_paints_paint_idx").on(t.paintId),
    oneOf("miniature_required_paints_step_check", t.step, RECIPE_STEP_VALUES),
  ],
);

export const miniatureRecipeSteps = vaultTable(
  "miniature_recipe_steps",
  {
    miniatureId: text("miniature_id")
      .notNull()
      .references(() => miniatures.id, { onDelete: "cascade" }),
    step: text("step", { enum: RECIPE_STEP_VALUES }).notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.miniatureId, t.step] }),
    oneOf("miniature_recipe_steps_step_check", t.step, RECIPE_STEP_VALUES),
  ],
);

// Schemes with a `user:` ID are the owner's own; every other scheme comes from a catalog source.
export const colorSchemes = vaultTable(
  "color_schemes",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category", { enum: COLOR_CATEGORIES }),
    createdAt: integer("created_at").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    isItemId("color_schemes_id_check", t.id),
    maxLengths("color_schemes_lengths_check", [[t.name, "name"]]),
    oneOf("color_schemes_category_check", t.category, COLOR_CATEGORIES, true),
  ],
);

// A scheme's paints, dividers and images share one sequence of sort orders.
export const colorSchemePaints = vaultTable(
  "color_scheme_paints",
  {
    schemeId: text("scheme_id")
      .notNull()
      .references(() => colorSchemes.id, { onDelete: "cascade" }),
    paintId: text("paint_id")
      .notNull()
      .references(() => paintCatalog.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.schemeId, t.sortOrder] }),
    index("color_scheme_paints_paint_idx").on(t.paintId),
  ],
);

// Divider and image IDs are UUIDs. They are keyed by scheme as well, so a scheme copied from
// another vault or source can keep its entry IDs.
export const colorSchemeDividers = vaultTable(
  "color_scheme_dividers",
  {
    id: text("id").notNull(),
    schemeId: text("scheme_id")
      .notNull()
      .references(() => colorSchemes.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    tone: text("tone", { enum: DIVIDER_TONES }).notNull().default("SECTION"),
    // START and COMPLETE mark the milestones an owner scheme must keep; other dividers have none.
    role: text("role", { enum: DIVIDER_ROLES }),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.schemeId, t.id] }),
    index("color_scheme_dividers_scheme_idx").on(t.schemeId, t.sortOrder),
    uniqueIndex("color_scheme_dividers_role_idx")
      .on(t.schemeId, t.role)
      .where(sql`${t.role} IS NOT NULL`),
    isUuid("color_scheme_dividers_id_check", t.id),
    maxLengths("color_scheme_dividers_lengths_check", [[t.label, "dividerLabel"]]),
    oneOf("color_scheme_dividers_tone_check", t.tone, DIVIDER_TONES),
    oneOf("color_scheme_dividers_role_check", t.role, DIVIDER_ROLES, true),
    check("color_scheme_dividers_role_tone_check", sql`${t.role} IS NULL OR ${t.tone} = 'MILESTONE'`),
  ],
);

export const colorSchemeImages = vaultTable(
  "color_scheme_images",
  {
    id: text("id").notNull(),
    schemeId: text("scheme_id")
      .notNull()
      .references(() => colorSchemes.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    imageType: text("image_type"),
    method: text("method"),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.schemeId, t.id] }),
    index("color_scheme_images_scheme_idx").on(t.schemeId, t.sortOrder),
    isUuid("color_scheme_images_id_check", t.id),
    maxLengths("color_scheme_images_lengths_check", [
      [t.imageUrl, "url"],
      [t.thumbnailUrl, "url"],
      [t.imageType, "imageLabel"],
      [t.method, "imageLabel"],
    ]),
  ],
);

export const miniatureColorSchemes = vaultTable(
  "miniature_color_schemes",
  {
    miniatureId: text("miniature_id")
      .notNull()
      .references(() => miniatures.id, { onDelete: "cascade" }),
    schemeId: text("scheme_id")
      .notNull()
      .references(() => colorSchemes.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.miniatureId, t.schemeId] }),
    index("miniature_color_schemes_scheme_idx").on(t.schemeId),
  ],
);
