import { normalizeColorHex } from "@paintwarden/core/color-hex";
import { isUserId, isUuid, isVaultItemId, newUserId, USER_ID_PREFIX } from "@paintwarden/core/vault-ids";

import type { BackupRow, BackupTables } from "./backup-format.ts";

// Pre-release backups were single JSON files (versions 3 and 4). They predate UUID-only IDs, recipe
// row IDs, milestone roles and template recipe tables, and held only the owner's own items, not catalog sources.
// This converts one into backup sections so an existing vault can be merged into a new one after
// its sources are reinstalled. Template images were embedded as base64 and are returned separately.
type Row = Record<string, unknown>;

export const isLegacyBackup = (body: Row) =>
  (body.format === "paintwarden-backup" || body.format === "paint-vault-backup") &&
  (body.version === 3 || body.version === 4);

const rowsOf = (body: Row, key: string): Row[] =>
  Array.isArray(body[key])
    ? (body[key] as unknown[]).filter((row): row is Row => !!row && typeof row === "object")
    : [];

// Keeps the first row for each key, so older files with repeated entries satisfy v1 constraints.
const firstBy = (rows: BackupRow[], key: (row: BackupRow) => string) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const value = key(row);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

// Remembers the new ID chosen for each old one. IDs already in v1 form are kept.
function idMap(convert: (id: string) => string) {
  const ids = new Map<string, string>();
  return (id: unknown) => {
    if (typeof id !== "string") return id;
    let next = ids.get(id);
    if (next === undefined) ids.set(id, (next = convert(id)));
    return next;
  };
}

// Owner items become `user:<uuid>`: `custom-<uuid>` keeps its UUID, anything else gets a new one.
const toUserId = (id: string) => {
  const candidate = isUserId(id)
    ? id
    : `${USER_ID_PREFIX}${id.startsWith("custom-") ? id.slice("custom-".length) : id}`;
  return isVaultItemId(candidate) ? candidate : newUserId();
};
const toUuid = (id: string) => (isUuid(id) ? id : crypto.randomUUID());

// Required milestones were marked by an ID prefix; v1 keeps that in the divider's role.
const milestoneRole = (id: unknown) =>
  typeof id !== "string"
    ? null
    : id.startsWith("required-battle-milestone:start:")
      ? "START"
      : id.startsWith("required-battle-milestone:complete:")
        ? "COMPLETE"
        : null;

export function convertLegacyBackup(body: Row): {
  tables: BackupTables;
  templateImages: Map<string, { data: string; contentType: string }>;
} {
  const paintIds = new Map<string, string>(),
    schemeIds = new Map<string, string>();
  for (const paint of rowsOf(body, "customPaints"))
    if (typeof paint.id === "string") paintIds.set(paint.id, toUserId(paint.id));
  // Source schemes were included too; they come back when their source is reinstalled.
  for (const scheme of rowsOf(body, "colorSchemes"))
    if (typeof scheme.id === "string" && scheme.isSystem !== true)
      schemeIds.set(scheme.id, toUserId(scheme.id));
  const paint = (id: unknown) => (typeof id === "string" ? (paintIds.get(id) ?? id) : id);
  const scheme = (id: unknown) => (typeof id === "string" ? (schemeIds.get(id) ?? id) : id);
  const template = idMap(toUserId),
    miniature = idMap(toUuid),
    substitution = idMap(toUuid);
  const ownScheme = (row: Row) => typeof row.schemeId === "string" && schemeIds.has(row.schemeId);
  const remap = (rows: Row[], fields: Record<string, (id: unknown) => unknown>): BackupRow[] =>
    rows.map((row) => {
      const next = { ...row };
      for (const [field, map] of Object.entries(fields)) if (field in next) next[field] = map(next[field]);
      return next;
    });

  const templates = rowsOf(body, "miniatureTemplates")
    .filter((row) => typeof row.id === "string" && isUserId(row.id))
    .map((row): Row => ({ ...row, id: template(row.id) }));
  const images = body.miniatureTemplateImages;
  // Keyed by the template's new ID.
  const templateImages = new Map<string, { data: string; contentType: string }>();
  if (images && typeof images === "object")
    for (const [id, image] of Object.entries(images as Record<string, Row>))
      if (typeof image?.data === "string" && typeof image.contentType === "string")
        templateImages.set(template(id) as string, { data: image.data, contentType: image.contentType });

  return {
    templateImages,
    tables: {
      paints: remap(rowsOf(body, "customPaints"), { id: paint }).map((row) => ({
        ...row,
        colorHex: normalizeColorHex(row.colorHex) ?? null,
      })),
      paintInventory: remap(rowsOf(body, "paintInventory"), { paintId: paint }),
      schemes: remap(
        rowsOf(body, "colorSchemes").filter((row) => schemeIds.has(row.id as string)),
        { id: scheme },
      ),
      schemePaints: remap(rowsOf(body, "colorSchemePaints").filter(ownScheme), {
        schemeId: scheme,
        paintId: paint,
      }),
      schemeDividers: remap(rowsOf(body, "colorSchemeDividers").filter(ownScheme), { schemeId: scheme }).map(
        (row) => ({ ...row, id: toUuid(String(row.id)), role: milestoneRole(row.id) }),
      ),
      schemeImages: remap(rowsOf(body, "colorSchemeImages").filter(ownScheme), {
        schemeId: scheme,
      }).map((row) => ({ ...row, id: toUuid(String(row.id)) })),
      templates: templates.map((row) => ({ ...row, imageKey: null })),
      templateSchemes: templates.flatMap((template) =>
        firstBy(
          (Array.isArray(template.schemeIds) ? template.schemeIds : []).map((schemeId: unknown) => ({
            templateId: template.id,
            schemeId: scheme(schemeId),
          })),
          (row) => String(row.schemeId),
        ).map((row, sortOrder) => ({ ...row, sortOrder })),
      ),
      templatePaints: templates.flatMap((template) =>
        firstBy(
          (Array.isArray(template.paints) ? (template.paints as Row[]) : [])
            .filter((row) => row && typeof row === "object")
            .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
            .map((row) => ({
              templateId: template.id,
              paintId: paint(row.paintId),
              step: row.step,
              notes: typeof row.notes === "string" ? row.notes : "",
            })),
          (row) => `${String(row.step)}:${String(row.paintId)}`,
        ).map((row, sortOrder) => ({ ...row, sortOrder })),
      ),
      // Photos weren't part of these backups.
      miniatures: remap(rowsOf(body, "miniatures"), { id: miniature }).map((row) => ({
        ...row,
        imageKey: null,
      })),
      miniatureRecipe: remap(rowsOf(body, "requirements"), { miniatureId: miniature, paintId: paint }).map(
        (row) => ({ ...row, id: crypto.randomUUID() }),
      ),
      miniatureSteps: remap(rowsOf(body, "recipeSteps"), { miniatureId: miniature }),
      miniatureSchemes: remap(rowsOf(body, "miniatureColorSchemes"), {
        miniatureId: miniature,
        schemeId: scheme,
      }),
      substitutions: remap(rowsOf(body, "paintSubstitutions"), { id: substitution, targetPaintId: paint }),
      substitutionIngredients: remap(rowsOf(body, "paintSubstitutionIngredients"), {
        substitutionId: substitution,
        paintId: paint,
      }),
      // A choice is the original paint or one substitution; rows that are neither are dropped.
      miniatureSubstitutions: remap(rowsOf(body, "miniaturePaintSubstitutions"), {
        miniatureId: miniature,
        targetPaintId: paint,
        substitutionId: substitution,
      })
        .map((row): BackupRow =>
          row.useOriginal === true || row.useOriginal === 1
            ? { ...row, useOriginal: true, substitutionId: null }
            : { ...row, useOriginal: false },
        )
        .filter((row) => row.useOriginal || typeof row.substitutionId === "string"),
    },
  };
}
