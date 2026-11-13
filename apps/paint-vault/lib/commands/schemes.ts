import { isColorCategory, type ColorCategory } from "@paint-vault/core/color-categories";
import { RECIPE_STEP_IDS, SCHEME_MILESTONE_LABELS } from "@paint-vault/core/recipe-steps";
import { TEXT_LIMITS } from "@paint-vault/core/text-limits";
import { isUserId, isUuid, newUserId } from "@paint-vault/core/vault-ids";
import { eq, inArray } from "drizzle-orm";

import { getDb } from "../../db/index.ts";
import {
  colorSchemeDividers,
  colorSchemeImages,
  colorSchemePaints,
  colorSchemes,
  paintCatalog,
} from "../../db/schema.ts";
export class SchemeCommandError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SchemeCommandError";
  }
}

// Nullable fields accept GraphQL inputs as well as the legacy REST representation.
export type SchemeEntryInput = {
  type?: string | null;
  paintId?: string | null;
  id?: string | null;
  label?: string | null;
  tone?: string | null;
  role?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  imageType?: string | null;
  method?: string | null;
};
export type SchemeInput = {
  name?: string | null;
  category?: string | null;
  entries?: (SchemeEntryInput | null)[] | null;
  paintIds?: (string | null)[] | null;
};

type DividerTone = "SECTION" | "MILESTONE";
type DividerRole = "START" | "COMPLETE";
type SchemeEntry =
  | { type: "PAINT"; paintId: string }
  | { type: "DIVIDER"; id: string; label: string; tone: DividerTone; role: DividerRole | null }
  | {
      type: "IMAGE";
      id: string;
      imageUrl: string;
      thumbnailUrl: string | null;
      imageType: string | null;
      method: string | null;
    };
// The fixed labels of the milestones an owner scheme starts and ends with.
const REQUIRED_MILESTONE_LABELS: Record<DividerRole, string> = {
  START: "GET READY!",
  COMPLETE: "YOU'RE READY!",
};

// Keep every database operation synchronous so callers can include a command and its
// revision/invalidation reads in one outer transaction. Nested writes use savepoints.
export function createScheme(input: SchemeInput): { id: string } {
  return getDb().transaction((tx) => {
    const parsed = validateScheme(input);
    const id = newUserId(),
      now = Date.now();
    tx.insert(colorSchemes)
      .values({ id, name: parsed.name, category: parsed.category, createdAt: now, updatedAt: now })
      .run();
    insertEntries(tx, id, parsed.entries);
    return { id };
  });
}

export function updateScheme(id: string, input: SchemeInput): void {
  getDb().transaction((tx) => {
    const existing = requireScheme(id);
    if (!isUserId(existing.id)) throw new SchemeCommandError(403, "Catalog source schemes are read-only");
    const previousDividers = tx
      .select({
        id: colorSchemeDividers.id,
        label: colorSchemeDividers.label,
        tone: colorSchemeDividers.tone,
        role: colorSchemeDividers.role,
      })
      .from(colorSchemeDividers)
      .where(eq(colorSchemeDividers.schemeId, id))
      .all();
    const parsed = validateScheme(input, previousDividers);
    tx.update(colorSchemes)
      .set({ name: parsed.name, category: parsed.category, updatedAt: Date.now() })
      .where(eq(colorSchemes.id, id))
      .run();
    tx.delete(colorSchemePaints).where(eq(colorSchemePaints.schemeId, id)).run();
    tx.delete(colorSchemeDividers).where(eq(colorSchemeDividers.schemeId, id)).run();
    tx.delete(colorSchemeImages).where(eq(colorSchemeImages.schemeId, id)).run();
    insertEntries(tx, id, parsed.entries);
  });
}

export function deleteScheme(id: string): void {
  getDb().transaction((tx) => {
    const existing = requireScheme(id);
    if (!isUserId(existing.id))
      throw new SchemeCommandError(403, "Catalog source schemes cannot be deleted here");
    tx.delete(colorSchemes).where(eq(colorSchemes.id, id)).run();
  });
}

function requireScheme(id: string) {
  if (!id) throw new SchemeCommandError(400, "Color scheme is required");
  const existing = getDb()
    .select({ id: colorSchemes.id })
    .from(colorSchemes)
    .where(eq(colorSchemes.id, id))
    .get();
  if (!existing) throw new SchemeCommandError(404, "Color scheme not found");
  return existing;
}

function insertEntries(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  id: string,
  entries: SchemeEntry[],
) {
  entries.forEach((entry, sortOrder) => {
    if (entry.type === "PAINT")
      tx.insert(colorSchemePaints).values({ schemeId: id, paintId: entry.paintId, sortOrder }).run();
    else if (entry.type === "DIVIDER")
      tx.insert(colorSchemeDividers)
        .values({
          id: entry.id,
          schemeId: id,
          label: entry.label,
          tone: entry.tone,
          role: entry.role,
          sortOrder,
        })
        .run();
    else
      tx.insert(colorSchemeImages)
        .values({
          id: entry.id,
          schemeId: id,
          imageUrl: entry.imageUrl,
          thumbnailUrl: entry.thumbnailUrl,
          imageType: entry.imageType,
          method: entry.method,
          sortOrder,
        })
        .run();
  });
}

function validateScheme(
  body: SchemeInput,
  previousDividers: { id: string; label: string; tone: DividerTone; role: DividerRole | null }[] = [],
): { name: string; category: ColorCategory; entries: SchemeEntry[] } {
  const name = body.name?.trim() ?? "";
  if (!name) throw new SchemeCommandError(400, "Give the color scheme a name");
  if (name.length > TEXT_LIMITS.name)
    throw new SchemeCommandError(
      400,
      `Scheme name must be ${TEXT_LIMITS.name.toLocaleString("en-US")} characters or fewer`,
    );
  if (!isColorCategory(body.category)) throw new SchemeCommandError(400, "Choose a color category");
  const source = Array.isArray(body.entries)
    ? body.entries
    : (body.paintIds ?? []).map((paintId) => ({ type: "PAINT", paintId }));
  const entries: SchemeEntry[] = [];
  const previousById = new Map(previousDividers.map((divider) => [divider.id, divider]));
  const paintIds = new Set<string>(),
    entryIds = new Set<string>(),
    roles = new Set<DividerRole>();
  // Entry IDs are UUIDs; any other value, or a repeat, gets a new one.
  const entryId = (value: unknown) => {
    const id = isUuid(value) && !entryIds.has(value) ? value : crypto.randomUUID();
    entryIds.add(id);
    return id;
  };
  let hasPaintStep = false;
  for (const value of source) {
    if (!value || typeof value !== "object") throw new SchemeCommandError(400, "Invalid color scheme entry");
    const entry = value as Record<string, unknown>;
    if (entry.type === "PAINT" && typeof entry.paintId === "string" && entry.paintId) {
      if (!hasPaintStep) throw new SchemeCommandError(400, "Place every paint beneath a step");
      paintIds.add(entry.paintId);
      entries.push({ type: "PAINT", paintId: entry.paintId });
      continue;
    }
    if (entry.type === "DIVIDER" && typeof entry.label === "string") {
      const label = entry.label.trim().toUpperCase(),
        tone = entry.tone;
      if (!label || label.length > TEXT_LIMITS.dividerLabel || (tone !== "SECTION" && tone !== "MILESTONE"))
        throw new SchemeCommandError(400, "Give each divider a label and style");
      const previous = typeof entry.id === "string" ? previousById.get(entry.id) : undefined;
      const unchangedLegacy = previous?.label.trim().toUpperCase() === label && previous.tone === tone;
      const role = entry.role === "START" || entry.role === "COMPLETE" ? entry.role : null;
      if (entry.role != null && !role) throw new SchemeCommandError(400, "Invalid milestone role");
      if (role) {
        if (tone !== "MILESTONE" || label !== REQUIRED_MILESTONE_LABELS[role] || roles.has(role))
          throw new SchemeCommandError(400, "Required milestones must be kept");
        roles.add(role);
      }
      if (
        !unchangedLegacy &&
        !(tone === "SECTION" ? RECIPE_STEP_IDS.has(label) : SCHEME_MILESTONE_LABELS.has(label))
      )
        throw new SchemeCommandError(400, "Choose a listed step or milestone label");
      const id = entryId(entry.id);
      hasPaintStep = tone === "SECTION";
      entries.push({ type: "DIVIDER", id, label: unchangedLegacy ? previous.label : label, tone, role });
      continue;
    }
    if (entry.type === "IMAGE" && typeof entry.imageUrl === "string") {
      const imageUrl = validImageUrl(entry.imageUrl),
        thumbnailUrl =
          typeof entry.thumbnailUrl === "string" && entry.thumbnailUrl
            ? validImageUrl(entry.thumbnailUrl)
            : null;
      if (!imageUrl || (entry.thumbnailUrl && !thumbnailUrl))
        throw new SchemeCommandError(400, "Use a valid HTTPS image URL");
      const id = entryId(entry.id);
      entries.push({
        type: "IMAGE",
        id,
        imageUrl,
        thumbnailUrl,
        imageType: shortText(entry.imageType),
        method: shortText(entry.method),
      });
      continue;
    }
    throw new SchemeCommandError(400, "Invalid color scheme entry");
  }
  if (!paintIds.size) throw new SchemeCommandError(400, "Add at least one paint");
  // A scheme keeps the required milestones it already has.
  if (previousDividers.some((divider) => divider.role && !roles.has(divider.role)))
    throw new SchemeCommandError(400, "Required milestones must be kept");
  const ids = [...paintIds];
  const allowed = new Set(
    getDb()
      .select({ id: paintCatalog.id })
      .from(paintCatalog)
      .where(inArray(paintCatalog.id, ids))
      .all()
      .map((row) => row.id),
  );
  if (ids.some((id) => !allowed.has(id)))
    throw new SchemeCommandError(400, "One or more paints are unavailable");
  return { name, category: body.category, entries };
}

function validImageUrl(value: string) {
  if (value.length > TEXT_LIMITS.url) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function shortText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, TEXT_LIMITS.imageLabel) : null;
}
