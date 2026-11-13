import { isUserId } from "@paint-vault/core/vault-ids";
import { eq } from "drizzle-orm";

import { getDb } from "../../../db";
import { catalogSourceItems, catalogSources, miniatureTemplates } from "../../../db/schema";
import { sourceLogoUrl } from "../../../lib/catalog-sources";
import { serializeImageMutation } from "../../../lib/image-mutations";
import { deleteImage, imageCacheControl, loadImage } from "../../../lib/image-store";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  withPreparedTemplateImage,
  templateCommandResponse,
  type TemplateInput,
} from "../../../lib/template-commands";
import { templateRecipe, templateRecipeCounts } from "../../../lib/template-recipes";

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

export const POST = serializeImageMutation(async function POST(request: Request) {
  try {
    const input = (await request.json()) as TemplateInput;
    const row = await withPreparedTemplateImage(input, (key) => createTemplate(input, key));
    return Response.json(row, { status: 201 });
  } catch (error) {
    return templateCommandResponse(error);
  }
});
export const PUT = serializeImageMutation(async function PUT(request: Request) {
  try {
    const { id, ...input } = (await request.json()) as TemplateInput & { id?: string };
    return Response.json(updateTemplate(id ?? "", input));
  } catch (error) {
    return templateCommandResponse(error);
  }
});
export const DELETE = serializeImageMutation(async function DELETE(request: Request) {
  try {
    const { id } = (await request.json()) as { id?: string };
    const result = deleteTemplate(id ?? "");
    await deleteImage(result.imageKey);
    return Response.json({ ok: true });
  } catch (error) {
    return templateCommandResponse(error);
  }
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
