import { RECIPE_STEP_IDS, type RecipeStep } from "@paint-vault/core/recipe-steps";
import { TEXT_LIMITS } from "@paint-vault/core/text-limits";
import { isUserId, newUserId } from "@paint-vault/core/vault-ids";
import { eq } from "drizzle-orm";

import { getDb } from "../../../db";
import {
  catalogSourceItems,
  catalogSources,
  colorSchemes,
  miniatureColorSchemes,
  miniatureRequiredPaints,
  miniatureTemplates,
  miniatures,
  paintCatalog,
} from "../../../db/schema";
import { sourceLogoUrl } from "../../../lib/catalog-sources";
import { serializeImageMutation } from "../../../lib/image-mutations";
import { deleteImage, imageCacheControl, loadImage, saveImage } from "../../../lib/image-store";
import {
  templateRecipe,
  templateRecipeCounts,
  writeTemplateRecipe,
  type TemplateRecipe,
} from "../../../lib/template-recipes";

type PaintEntry = { paintId: string; step: string; notes: string; sortOrder: number };
type Input = {
  id?: string;
  name?: string;
  manufacturer?: string;
  faction?: string;
  imageUrl?: string | null;
  sourceMiniatureId?: string;
  schemeIds?: string[];
  paints?: PaintEntry[];
};
const steps = RECIPE_STEP_IDS;

export async function GET() {
  const db = getDb();
  const rows = db.select().from(miniatureTemplates).all();
  const counts = templateRecipeCounts(db);
  const sources = new Map(
    db
      .select()
      .from(catalogSources)
      .all()
      .map((source) => [source.id, { name: source.name, logoUrl: sourceLogoUrl(source.id, source.logoSvg) }]),
  );
  const owners = new Map(
    db
      .select()
      .from(catalogSourceItems)
      .all()
      .filter((item) => item.kind === "template")
      .map((item) => [item.itemId, sources.get(item.sourceId)]),
  );
  const templates = rows.map((row) => {
    const recipeCounts = counts.get(row.id) ?? { schemeCount: 0, paintCount: 0 };
    return {
      id: row.id,
      name: row.name,
      manufacturer: row.manufacturer,
      faction: row.faction,
      imageUrl: row.imageKey
        ? `/api/miniature-templates/${encodeURIComponent(row.id)}/image?v=${encodeURIComponent(row.imageKey)}`
        : row.imageUrl || "",
      categories: isUserId(row.id) ? ["My templates"] : row.categories,
      kind: isUserId(row.id) ? "user" : "source",
      sourceName: owners.get(row.id)?.name,
      sourceLogoUrl: owners.get(row.id)?.logoUrl ?? null,
      ...recipeCounts,
    };
  });
  return Response.json({
    sourceVersion: null,
    categories: ["My templates", ...new Set(templates.flatMap((row) => row.categories))],
    templates,
  });
}

async function prepare(input: Input, existing?: typeof miniatureTemplates.$inferSelect & TemplateRecipe) {
  const db = getDb();
  const source = input.sourceMiniatureId
    ? db.select().from(miniatures).where(eq(miniatures.id, input.sourceMiniatureId)).get()
    : undefined;
  if (input.sourceMiniatureId && !source) return { error: "Miniature not found" } as const;
  const name = (input.name ?? source?.title ?? existing?.name ?? "").trim();
  if (!name || name.length > TEXT_LIMITS.name)
    return { error: `Template name must be 1–${TEXT_LIMITS.name} characters` } as const;
  const manufacturer = (input.manufacturer ?? source?.manufacturer ?? existing?.manufacturer ?? "").trim();
  const faction = (input.faction ?? source?.faction ?? existing?.faction ?? "").trim();
  if (manufacturer.length > TEXT_LIMITS.detail || faction.length > TEXT_LIMITS.detail)
    return { error: `Manufacturer and faction must be ${TEXT_LIMITS.detail} characters or fewer` } as const;
  const schemeIds = source
    ? db
        .select()
        .from(miniatureColorSchemes)
        .where(eq(miniatureColorSchemes.miniatureId, source.id))
        .all()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => row.schemeId)
    : (input.schemeIds ?? existing?.schemeIds ?? []);
  const paints = source
    ? db
        .select()
        .from(miniatureRequiredPaints)
        .where(eq(miniatureRequiredPaints.miniatureId, source.id))
        .all()
    : (input.paints ?? existing?.paints ?? []);
  if (!Array.isArray(schemeIds) || !Array.isArray(paints))
    return { error: "Invalid template content" } as const;
  const validSchemes = new Set(
    db
      .select({ id: colorSchemes.id })
      .from(colorSchemes)
      .all()
      .map((row) => row.id),
  );
  const validPaints = new Set(
    db
      .select({ id: paintCatalog.id })
      .from(paintCatalog)
      .all()
      .map((row) => row.id),
  );
  if (
    schemeIds.some((id) => typeof id !== "string" || !validSchemes.has(id)) ||
    new Set(schemeIds).size !== schemeIds.length
  )
    return { error: "Template contains invalid schemes" } as const;
  if (
    paints.some(
      (row) =>
        !row || typeof row.paintId !== "string" || !validPaints.has(row.paintId) || !steps.has(row.step),
    ) ||
    new Set(paints.map((row) => `${row.step}:${row.paintId}`)).size !== paints.length
  )
    return { error: "Template contains invalid paints" } as const;
  const imageUrl = source?.sourceImageUrl ?? input.imageUrl ?? existing?.imageUrl ?? null;
  if (imageUrl && !/^https?:\/\//.test(imageUrl))
    return { error: "Image URL must use http or https" } as const;
  if (imageUrl && imageUrl.length > TEXT_LIMITS.url)
    return {
      error: `Image URL must be ${TEXT_LIMITS.url.toLocaleString("en-US")} characters or fewer`,
    } as const;
  if (paints.some((row) => typeof row.notes === "string" && row.notes.length > TEXT_LIMITS.stepNotes))
    return {
      error: `Step notes must be ${TEXT_LIMITS.stepNotes.toLocaleString("en-US")} characters or fewer`,
    } as const;
  return {
    value: {
      name,
      manufacturer,
      faction,
      imageUrl,
      schemeIds,
      paints: paints
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row, index) => ({
          paintId: row.paintId,
          step: row.step as RecipeStep,
          notes: row.notes || "",
          sortOrder: index,
        })),
    },
    sourceImageKey: source?.imageKey,
  } as const;
}

export const POST = serializeImageMutation(async function POST(request: Request) {
  const result = await prepare((await request.json()) as Input);
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  let imageKey: string | null = null;
  if (result.sourceImageKey) {
    const image = await loadImage(result.sourceImageKey);
    if (image)
      imageKey = await saveImage(
        new File([new Uint8Array(image.bytes)], "template", { type: image.contentType }),
      );
  }
  const now = Date.now();
  const { schemeIds, paints, ...fields } = result.value;
  const row = {
    id: newUserId(),
    ...fields,
    categories: ["My templates"],
    imageKey,
    createdAt: now,
    updatedAt: now,
  };
  getDb().transaction((tx) => {
    tx.insert(miniatureTemplates).values(row).run();
    writeTemplateRecipe(tx, row.id, { schemeIds, paints });
  });
  return Response.json({ ...row, schemeIds, paints }, { status: 201 });
});

export const PUT = serializeImageMutation(async function PUT(request: Request) {
  const input = (await request.json()) as Input;
  const id = input.id;
  if (!id || !isUserId(id))
    return Response.json({ error: "Source templates are read-only" }, { status: 403 });
  const db = getDb();
  const existing = db.select().from(miniatureTemplates).where(eq(miniatureTemplates.id, id)).get();
  if (!existing) return Response.json({ error: "Template not found" }, { status: 404 });
  const result = await prepare(input, { ...existing, ...templateRecipe(db, id) });
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  const { schemeIds, paints, ...fields } = result.value;
  db.transaction((tx) => {
    tx.update(miniatureTemplates)
      .set({ ...fields, updatedAt: Date.now() })
      .where(eq(miniatureTemplates.id, id))
      .run();
    writeTemplateRecipe(tx, id, { schemeIds, paints });
  });
  return Response.json({ ok: true });
});

export const DELETE = serializeImageMutation(async function DELETE(request: Request) {
  const { id } = (await request.json()) as { id?: string };
  if (!id || !isUserId(id))
    return Response.json({ error: "Source templates are read-only" }, { status: 403 });
  const db = getDb();
  const existing = db.select().from(miniatureTemplates).where(eq(miniatureTemplates.id, id)).get();
  if (!existing) return Response.json({ error: "Template not found" }, { status: 404 });
  db.delete(miniatureTemplates).where(eq(miniatureTemplates.id, id)).run();
  await deleteImage(existing.imageKey);
  return Response.json({ ok: true });
});

export async function imageForTemplate(id: string, request?: Request) {
  const row = getDb().select().from(miniatureTemplates).where(eq(miniatureTemplates.id, id)).get();
  const image = row?.imageKey ? await loadImage(row.imageKey) : null;
  if (!row?.imageKey || !image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.bytes), {
    headers: { "content-type": image.contentType, "cache-control": imageCacheControl(request, row.imageKey) },
  });
}

export function recipeForTemplate(id: string) {
  const db = getDb();
  const row = db
    .select({ id: miniatureTemplates.id })
    .from(miniatureTemplates)
    .where(eq(miniatureTemplates.id, id))
    .get();
  if (!row) return Response.json({ error: "Template not found" }, { status: 404 });
  return Response.json(templateRecipe(db, id));
}
