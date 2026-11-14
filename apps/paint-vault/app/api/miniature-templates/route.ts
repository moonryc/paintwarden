import { eq } from "drizzle-orm";

import { getDb } from "../../../db";
import { miniatureTemplates } from "../../../db/schema";
import { serializeImageMutation } from "../../../lib/image-mutations";
import { deleteImage, imageResponse } from "../../../lib/image-store";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  withPreparedTemplateImage,
  templateCommandResponse,
  type TemplateInput,
} from "../../../lib/template-commands";

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
  if (!row?.imageKey) return new Response("Not found", { status: 404 });
  return imageResponse(row.imageKey, request);
}
