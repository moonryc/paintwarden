import type Sqlite from "better-sqlite3";

import { getDb, getSqlite } from "../db";
import { catalogSourceItems, colorSchemes, miniatureTemplates, paintCatalog } from "../db/schema";

import type { SourceItem, SourceItemKind } from "./catalog-source-dropped";
import {
  executeCatalogRows,
  prepareCatalogRows,
  prepareConflictChecks,
  type CatalogSqlRow,
  type CatalogWrite,
} from "./catalog-source-rows";
import type { Catalog, Manifest } from "./source-format";

export const SOURCE_IMAGE_PATH = "/api/catalog-source-images/";
type InstallTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type PaintIdentity = Pick<typeof paintCatalog.$inferSelect, "id" | "brand" | "range" | "name" | "colorHex">;
type Assets = Map<string, { key: string; sha256: string }>;

export type PreparedCatalogInstall = {
  id: string;
  sqlite: Sqlite.Database;
  // Only the small identity projection is needed to validate subsequent dependency installs.
  paints: PaintIdentity[];
  items: SourceItem[];
  current: Set<string>;
  conflictChecks: { write: CatalogWrite; message: string }[];
  beforeItems: CatalogWrite[];
  afterItems: CatalogWrite[];
  deletes: { statement: Sqlite.Statement; ids: string[] }[];
  previousItems: Sqlite.Statement;
  deleteItems: Sqlite.Statement;
  insertItem: Sqlite.Statement;
  ownedElsewhere: Sqlite.Statement;
  usage: Record<"paint" | "scheme", Sqlite.Statement>;
  deleteDropped: Record<SourceItemKind, Sqlite.Statement>;
  discontinue: Sqlite.Statement;
};

const itemKey = (kind: SourceItemKind, id: string) => `${kind}:${id}`;
const upsert = (columns: string[]) =>
  `ON CONFLICT(id) DO UPDATE SET ${columns.map((column) => column + "=excluded." + column).join(",")}`;

// Compile SQL, serialize JSON and construct all bindings outside the synchronous commit. Prior
// preparations must be passed in dependency/map order, just as they will be executed.
export function prepareCatalogInstall(
  id: string,
  repository: string,
  url: string,
  branch: string,
  manifest: Manifest,
  catalog: Catalog,
  assets: Assets,
  priorPrepared: readonly PreparedCatalogInstall[] = [],
): PreparedCatalogInstall {
  const db = getDb();
  const sqlite = getSqlite();
  const now = Date.now();
  const existingPaints = new Map<string, PaintIdentity>(
    db
      .select()
      .from(paintCatalog)
      .all()
      .map((row) => [row.id, row]),
  );
  const existingSchemes = new Set(
    db
      .select({ id: colorSchemes.id })
      .from(colorSchemes)
      .all()
      .map((row) => row.id),
  );
  const existingTemplates = new Set(
    db
      .select({ id: miniatureTemplates.id })
      .from(miniatureTemplates)
      .all()
      .map((row) => row.id),
  );
  const owners = new Map<string, Set<string>>();
  const addOwner = (sourceId: string, kind: SourceItemKind, itemId: string) => {
    const key = itemKey(kind, itemId);
    const sources = owners.get(key) ?? new Set<string>();
    sources.add(sourceId);
    owners.set(key, sources);
  };
  for (const row of db.select().from(catalogSourceItems).all()) addOwner(row.sourceId, row.kind, row.itemId);
  for (const prior of priorPrepared) {
    if (prior.sqlite !== sqlite) throw new Error("Catalog preparations belong to different vaults");
    for (const paint of prior.paints) existingPaints.set(paint.id, paint);
    for (const item of prior.items) {
      addOwner(prior.id, item.kind, item.itemId);
      if (item.kind === "scheme") existingSchemes.add(item.itemId);
      if (item.kind === "template") existingTemplates.add(item.itemId);
    }
  }
  const ownedElsewhere = (kind: SourceItemKind, itemId: string) =>
    [...(owners.get(itemKey(kind, itemId)) ?? [])].some((owner) => owner !== id);
  const availablePaints = new Set([...existingPaints.keys(), ...catalog.paints.map((paint) => paint.id)]);
  const availableSchemes = new Set([...existingSchemes, ...catalog.schemes.map((scheme) => scheme.id)]);
  for (const scheme of catalog.schemes)
    for (const entry of scheme.entries)
      if (entry.type === "PAINT" && !availablePaints.has(entry.paintId))
        throw new Error(`Scheme ${scheme.name} needs missing paint ${entry.paintId}`);
  for (const template of catalog.templates) {
    if (template.schemeIds.some((schemeId) => !availableSchemes.has(schemeId)))
      throw new Error(`Template ${template.name} needs a missing scheme`);
    if (template.paints.some((paint) => !availablePaints.has(paint.paintId)))
      throw new Error(`Template ${template.name} needs a missing paint`);
  }
  const paintRows: CatalogSqlRow[] = [];
  const paints: PaintIdentity[] = [];
  for (const paint of catalog.paints) {
    const identity = {
      id: paint.id,
      brand: paint.brand,
      range: paint.range,
      name: paint.name,
      colorHex: paint.colorHex ?? null,
    };
    const existing = existingPaints.get(paint.id);
    if (existing && ownedElsewhere("paint", paint.id)) {
      if (
        existing.brand !== paint.brand ||
        existing.range !== paint.range ||
        existing.name !== paint.name ||
        existing.colorHex !== identity.colorHex
      )
        throw new Error(`Paint ID conflicts with another source: ${paint.id}`);
      paints.push(existing);
      continue;
    }
    paints.push(identity);
    paintRows.push([
      paint.id,
      paint.brand,
      paint.range,
      paint.name,
      paint.type ?? null,
      paint.discontinued ? 1 : 0,
      paint.colorHex ?? null,
      paint.sourceUrl ?? null,
      paint.sourceLabel ?? manifest.name,
      now,
    ]);
  }
  const localImage = (filename?: string | null) =>
    filename ? `${SOURCE_IMAGE_PATH}${assets.get(filename)!.key}` : null;
  const schemeRows: CatalogSqlRow[] = [];
  const schemePaints: CatalogSqlRow[] = [];
  const dividers: CatalogSqlRow[] = [];
  const images: CatalogSqlRow[] = [];
  for (const scheme of catalog.schemes) {
    if (existingSchemes.has(scheme.id) && ownedElsewhere("scheme", scheme.id))
      throw new Error(`Scheme ID conflicts with another source: ${scheme.id}`);
    schemeRows.push([scheme.id, scheme.name, scheme.category ?? null, now, now]);
    for (const [sortOrder, entry] of scheme.entries.entries()) {
      if (entry.type === "PAINT") schemePaints.push([scheme.id, entry.paintId, sortOrder, now]);
      else if (entry.type === "STEP" || entry.type === "MILESTONE")
        dividers.push([
          entry.id,
          scheme.id,
          entry.label,
          entry.type === "STEP" ? "SECTION" : "MILESTONE",
          sortOrder,
          now,
        ]);
      else
        images.push([
          entry.id,
          scheme.id,
          localImage(entry.imageUrl),
          localImage(entry.thumbnailUrl),
          entry.imageType ?? null,
          entry.method ?? null,
          sortOrder,
          now,
        ]);
    }
  }
  const templates: CatalogSqlRow[] = [];
  const templateSchemes: CatalogSqlRow[] = [];
  const templatePaints: CatalogSqlRow[] = [];
  for (const template of catalog.templates) {
    if (existingTemplates.has(template.id) && ownedElsewhere("template", template.id))
      throw new Error(`Template ID conflicts with another source: ${template.id}`);
    templates.push([
      template.id,
      template.name,
      template.manufacturer,
      template.faction,
      JSON.stringify(template.categories),
      template.imageUrl ? assets.get(template.imageUrl)!.key : null,
      null,
      now,
      now,
    ]);
    for (const [sortOrder, schemeId] of template.schemeIds.entries())
      templateSchemes.push([template.id, schemeId, sortOrder, now]);
    for (const [sortOrder, paint] of [...template.paints].sort((a, b) => a.sortOrder - b.sortOrder).entries())
      templatePaints.push([template.id, sortOrder, paint.paintId, paint.step, paint.notes, now]);
  }
  const items: SourceItem[] = [
    ...catalog.paints.map((item) => ({ kind: "paint" as const, itemId: item.id })),
    ...catalog.schemes.map((item) => ({ kind: "scheme" as const, itemId: item.id })),
    ...catalog.templates.map((item) => ({ kind: "template" as const, itemId: item.id })),
  ];
  const rows = (
    table: string,
    columns: string[],
    values: CatalogSqlRow[],
    conflict = "",
    conflictValues: CatalogSqlRow = [],
  ) => prepareCatalogRows(sqlite, table, columns, values, conflict, conflictValues);
  const conflictChecks = [
    ...prepareConflictChecks(
      sqlite,
      id,
      "paint",
      ["id", "brand", "range", "name", "color_hex"],
      paints.map((paint) => [paint.id, paint.brand, paint.range, paint.name, paint.colorHex]),
    ),
    ...prepareConflictChecks(
      sqlite,
      id,
      "scheme",
      ["id"],
      catalog.schemes.map((scheme) => [scheme.id]),
    ),
    ...prepareConflictChecks(
      sqlite,
      id,
      "template",
      ["id"],
      catalog.templates.map((template) => [template.id]),
    ),
  ];
  const beforeItems = [
    ...rows(
      "catalog_sources",
      [
        "id",
        "repository",
        "url",
        "branch",
        "name",
        "version",
        "license",
        "attribution",
        "dependencies",
        "updated_at",
        "last_error",
      ],
      [
        [
          id,
          repository,
          url,
          branch,
          manifest.name,
          manifest.version,
          manifest.license ?? null,
          manifest.attribution ?? null,
          JSON.stringify(manifest.dependencies),
          now,
          null,
        ],
      ],
      upsert([
        "branch",
        "name",
        "version",
        "license",
        "attribution",
        "dependencies",
        "updated_at",
        "last_error",
      ]),
    ),
    ...rows(
      "paint_catalog",
      [
        "id",
        "brand",
        "range",
        "name",
        "type",
        "discontinued",
        "color_hex",
        "source_url",
        "source_label",
        "updated_at",
      ],
      paintRows,
      upsert([
        "brand",
        "range",
        "name",
        "type",
        "discontinued",
        "color_hex",
        "source_url",
        "source_label",
        "updated_at",
      ]) +
        " WHERE NOT EXISTS (SELECT 1 FROM catalog_source_items WHERE kind = 'paint' AND item_id = excluded.id AND source_id != ?)",
      [id],
    ),
    ...rows(
      "color_schemes",
      ["id", "name", "category", "created_at", "updated_at"],
      schemeRows,
      upsert(["name", "category", "updated_at"]),
    ),
    // Neither folder_id nor created_at is updated: the owner can move templates during staging.
    ...rows(
      "miniature_templates",
      [
        "id",
        "name",
        "manufacturer",
        "faction",
        "categories",
        "image_key",
        "image_url",
        "created_at",
        "updated_at",
      ],
      templates,
      upsert(["name", "manufacturer", "faction", "categories", "image_key", "image_url", "updated_at"]),
    ),
  ];
  const schemeIds = catalog.schemes.map((scheme) => scheme.id);
  const templateIds = catalog.templates.map((template) => template.id);
  const deletes = [
    ...["color_scheme_paints", "color_scheme_dividers", "color_scheme_images"].map((table) => ({
      statement: sqlite.prepare(`DELETE FROM ${table} WHERE scheme_id = ?`),
      ids: schemeIds,
    })),
    ...["miniature_template_schemes", "miniature_template_paints"].map((table) => ({
      statement: sqlite.prepare(`DELETE FROM ${table} WHERE template_id = ?`),
      ids: templateIds,
    })),
  ];
  const afterItems = [
    ...rows("color_scheme_paints", ["scheme_id", "paint_id", "sort_order", "updated_at"], schemePaints),
    ...rows(
      "color_scheme_dividers",
      ["id", "scheme_id", "label", "tone", "sort_order", "updated_at"],
      dividers,
    ),
    ...rows(
      "color_scheme_images",
      ["id", "scheme_id", "image_url", "thumbnail_url", "image_type", "method", "sort_order", "updated_at"],
      images,
    ),
    ...rows(
      "miniature_template_schemes",
      ["template_id", "scheme_id", "sort_order", "updated_at"],
      templateSchemes,
    ),
    ...rows(
      "miniature_template_paints",
      ["template_id", "sort_order", "paint_id", "step", "notes", "updated_at"],
      templatePaints,
    ),
    ...rows(
      "catalog_source_items",
      ["source_id", "kind", "item_id"],
      items.map((item) => [id, item.kind, item.itemId]),
    ),
  ];
  const deleteAssets = sqlite.prepare("DELETE FROM catalog_source_assets WHERE source_id = ?");
  afterItems.push({ statement: deleteAssets, values: [id] });
  afterItems.push(
    ...rows(
      "catalog_source_assets",
      ["source_id", "asset_path", "image_key", "sha256"],
      [...assets].map(([assetPath, asset]) => [id, assetPath, asset.key, asset.sha256]),
    ),
  );
  return {
    id,
    sqlite,
    paints,
    items,
    current: new Set(items.map((item) => itemKey(item.kind, item.itemId))),
    conflictChecks,
    beforeItems,
    afterItems,
    deletes,
    previousItems: sqlite.prepare(
      "SELECT kind, item_id AS itemId FROM catalog_source_items WHERE source_id = ?",
    ),
    deleteItems: sqlite.prepare("DELETE FROM catalog_source_items WHERE source_id = ?"),
    insertItem: sqlite.prepare(
      "INSERT INTO catalog_source_items (source_id, kind, item_id) VALUES (?, ?, ?)",
    ),
    ownedElsewhere: sqlite.prepare(
      "SELECT 1 FROM catalog_source_items WHERE kind = ? AND item_id = ? AND source_id != ? LIMIT 1",
    ),
    usage: {
      scheme: sqlite.prepare(
        "SELECT 1 WHERE EXISTS (SELECT 1 FROM miniature_color_schemes WHERE scheme_id = ?) OR EXISTS (SELECT 1 FROM miniature_template_schemes WHERE scheme_id = ?)",
      ),
      paint: sqlite.prepare(`SELECT 1 WHERE
        EXISTS (SELECT 1 FROM paint_inventory WHERE paint_id = ?) OR
        EXISTS (SELECT 1 FROM miniature_required_paints WHERE paint_id = ?) OR
        EXISTS (SELECT 1 FROM miniature_template_paints WHERE paint_id = ?) OR
        EXISTS (SELECT 1 FROM color_scheme_paints WHERE paint_id = ?) OR
        EXISTS (SELECT 1 FROM paint_substitutions WHERE target_paint_id = ?) OR
        EXISTS (SELECT 1 FROM paint_substitution_ingredients WHERE paint_id = ?) OR
        EXISTS (SELECT 1 FROM miniature_paint_substitutions WHERE target_paint_id = ?)`),
    },
    deleteDropped: {
      template: sqlite.prepare("DELETE FROM miniature_templates WHERE id = ?"),
      scheme: sqlite.prepare("DELETE FROM color_schemes WHERE id = ?"),
      paint: sqlite.prepare("DELETE FROM paint_catalog WHERE id = ?"),
    },
    discontinue: sqlite.prepare(
      "UPDATE paint_catalog SET discontinued = 1, updated_at = cast(unixepoch('subsec') * 1000 as integer) WHERE id = ?",
    ),
  };
}

// No parsing, JSON serialization or SQL preparation belongs in this synchronous section. Usage
// and ownership are deliberately read here, not while staging, so current user edits win.
export function executeCatalogInstall(_tx: InstallTransaction, prepared: PreparedCatalogInstall) {
  if (!prepared.sqlite.inTransaction) throw new Error("Catalog installation requires a transaction");
  for (const { write, message } of prepared.conflictChecks) {
    const conflict = write.statement.get(...write.values) as { id: string } | undefined;
    if (conflict) throw new Error(`${message}: ${conflict.id}`);
  }
  const previous = prepared.previousItems.all(prepared.id) as SourceItem[];
  executeCatalogRows(prepared.beforeItems);
  for (const { statement, ids } of prepared.deletes) for (const id of ids) statement.run(id);
  prepared.deleteItems.run(prepared.id);
  executeCatalogRows(prepared.afterItems);
  for (const kind of ["template", "scheme", "paint"] as const)
    for (const item of previous) {
      if (
        item.kind !== kind ||
        prepared.current.has(itemKey(kind, item.itemId)) ||
        prepared.ownedElsewhere.get(kind, item.itemId, prepared.id)
      )
        continue;
      const used =
        kind === "scheme"
          ? prepared.usage.scheme.get(item.itemId, item.itemId)
          : kind === "paint"
            ? prepared.usage.paint.get(...Array<string>(7).fill(item.itemId))
            : false;
      if (used) {
        prepared.insertItem.run(prepared.id, kind, item.itemId);
        if (kind === "paint") prepared.discontinue.run(item.itemId);
      } else prepared.deleteDropped[kind].run(item.itemId);
    }
}
