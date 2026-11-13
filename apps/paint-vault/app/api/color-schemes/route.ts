import { isColorCategory, type ColorCategory } from "@paint-vault/core/color-categories";
import { RECIPE_STEP_IDS, SCHEME_MILESTONE_LABELS } from "@paint-vault/core/recipe-steps";
import { TEXT_LIMITS } from "@paint-vault/core/text-limits";
import { isUserId, isUuid, newUserId } from "@paint-vault/core/vault-ids";
import { eq, inArray } from "drizzle-orm";

import { getDb } from "../../../db";
import {
  colorSchemeDividers,
  colorSchemeImages,
  colorSchemePaints,
  colorSchemes,
  paintCatalog,
} from "../../../db/schema";
import { serializeImageMutation } from "../../../lib/image-mutations";
import { textTooLong } from "../../../lib/text-limits";

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

type SchemeBody = { id?: string; name?: string; category?: unknown; entries?: unknown; paintIds?: string[] };

export const POST = serializeImageMutation(async function POST(request: Request) {
  const body = (await request.json()) as SchemeBody;
  const parsed = await validateScheme(body);
  if (parsed instanceof Response) return parsed;
  const id = newUserId(),
    now = Date.now();
  const db = getDb();
  db.transaction((tx) => {
    tx.insert(colorSchemes)
      .values({ id, name: parsed.name, category: parsed.category, createdAt: now, updatedAt: now })
      .run();
    parsed.entries.forEach((entry, sortOrder) => {
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
  });
  return Response.json({ id }, { status: 201 });
});

export const PUT = serializeImageMutation(async function PUT(request: Request) {
  const body = (await request.json()) as SchemeBody;
  if (!body.id) return Response.json({ error: "Color scheme is required" }, { status: 400 });
  const [existing] = await getDb()
    .select({ id: colorSchemes.id })
    .from(colorSchemes)
    .where(eq(colorSchemes.id, body.id));
  if (!existing) return Response.json({ error: "Color scheme not found" }, { status: 404 });
  if (!isUserId(existing.id))
    return Response.json({ error: "Catalog source schemes are read-only" }, { status: 403 });
  const previousDividers = await getDb()
    .select({
      id: colorSchemeDividers.id,
      label: colorSchemeDividers.label,
      tone: colorSchemeDividers.tone,
      role: colorSchemeDividers.role,
    })
    .from(colorSchemeDividers)
    .where(eq(colorSchemeDividers.schemeId, body.id));
  const parsed = await validateScheme(body, previousDividers);
  if (parsed instanceof Response) return parsed;
  const db = getDb();
  db.transaction((tx) => {
    tx.update(colorSchemes)
      .set({ name: parsed.name, category: parsed.category, updatedAt: Date.now() })
      .where(eq(colorSchemes.id, body.id!))
      .run();
    tx.delete(colorSchemePaints).where(eq(colorSchemePaints.schemeId, body.id!)).run();
    tx.delete(colorSchemeDividers).where(eq(colorSchemeDividers.schemeId, body.id!)).run();
    tx.delete(colorSchemeImages).where(eq(colorSchemeImages.schemeId, body.id!)).run();
    parsed.entries.forEach((entry, sortOrder) => {
      if (entry.type === "PAINT")
        tx.insert(colorSchemePaints).values({ schemeId: body.id!, paintId: entry.paintId, sortOrder }).run();
      else if (entry.type === "DIVIDER")
        tx.insert(colorSchemeDividers)
          .values({
            id: entry.id,
            schemeId: body.id!,
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
            schemeId: body.id!,
            imageUrl: entry.imageUrl,
            thumbnailUrl: entry.thumbnailUrl,
            imageType: entry.imageType,
            method: entry.method,
            sortOrder,
          })
          .run();
    });
  });
  return Response.json({ ok: true });
});

export const DELETE = serializeImageMutation(async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Color scheme is required" }, { status: 400 });
  const [existing] = await getDb()
    .select({ id: colorSchemes.id })
    .from(colorSchemes)
    .where(eq(colorSchemes.id, id));
  if (!existing) return Response.json({ error: "Color scheme not found" }, { status: 404 });
  if (!isUserId(existing.id))
    return Response.json({ error: "Catalog source schemes cannot be deleted here" }, { status: 403 });
  await getDb().delete(colorSchemes).where(eq(colorSchemes.id, id));
  return Response.json({ ok: true });
});

async function validateScheme(
  body: SchemeBody,
  previousDividers: { id: string; label: string; tone: DividerTone; role: DividerRole | null }[] = [],
): Promise<{ name: string; category: ColorCategory; entries: SchemeEntry[] } | Response> {
  const name = body.name?.trim() ?? "";
  if (!name) return Response.json({ error: "Give the color scheme a name" }, { status: 400 });
  const tooLong = textTooLong([["Scheme name", name, "name"]]);
  if (tooLong) return tooLong;
  if (!isColorCategory(body.category))
    return Response.json({ error: "Choose a color category" }, { status: 400 });
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
    if (!value || typeof value !== "object")
      return Response.json({ error: "Invalid color scheme entry" }, { status: 400 });
    const entry = value as Record<string, unknown>;
    if (entry.type === "PAINT" && typeof entry.paintId === "string" && entry.paintId) {
      if (!hasPaintStep) return Response.json({ error: "Place every paint beneath a step" }, { status: 400 });
      paintIds.add(entry.paintId);
      entries.push({ type: "PAINT", paintId: entry.paintId });
      continue;
    }
    if (entry.type === "DIVIDER" && typeof entry.label === "string") {
      const label = entry.label.trim().toUpperCase(),
        tone = entry.tone;
      if (!label || label.length > TEXT_LIMITS.dividerLabel || (tone !== "SECTION" && tone !== "MILESTONE"))
        return Response.json({ error: "Give each divider a label and style" }, { status: 400 });
      const previous = typeof entry.id === "string" ? previousById.get(entry.id) : undefined;
      const unchangedLegacy = previous?.label.trim().toUpperCase() === label && previous.tone === tone;
      const role = entry.role === "START" || entry.role === "COMPLETE" ? entry.role : null;
      if (entry.role != null && !role)
        return Response.json({ error: "Invalid milestone role" }, { status: 400 });
      if (role) {
        if (tone !== "MILESTONE" || label !== REQUIRED_MILESTONE_LABELS[role] || roles.has(role))
          return Response.json({ error: "Required milestones must be kept" }, { status: 400 });
        roles.add(role);
      }
      if (
        !unchangedLegacy &&
        !(tone === "SECTION" ? RECIPE_STEP_IDS.has(label) : SCHEME_MILESTONE_LABELS.has(label))
      )
        return Response.json({ error: "Choose a listed step or milestone label" }, { status: 400 });
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
        return Response.json({ error: "Use a valid HTTPS image URL" }, { status: 400 });
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
    return Response.json({ error: "Invalid color scheme entry" }, { status: 400 });
  }
  if (!paintIds.size) return Response.json({ error: "Add at least one paint" }, { status: 400 });
  // A scheme keeps the required milestones it already has.
  if (previousDividers.some((divider) => divider.role && !roles.has(divider.role)))
    return Response.json({ error: "Required milestones must be kept" }, { status: 400 });
  const ids = [...paintIds];
  const allowed = new Set(
    (
      await getDb().select({ id: paintCatalog.id }).from(paintCatalog).where(inArray(paintCatalog.id, ids))
    ).map((row) => row.id),
  );
  if (ids.some((id) => !allowed.has(id)))
    return Response.json({ error: "One or more paints are unavailable" }, { status: 400 });
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
