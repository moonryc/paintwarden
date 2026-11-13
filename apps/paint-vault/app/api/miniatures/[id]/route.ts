import {
  commandResponse,
  deleteMiniature,
  updateMiniature,
  type MiniatureInput,
} from "../../../../lib/commands/miniatures.ts";
import { serializeImageMutation } from "../../../../lib/image-mutations.ts";
import { deleteImage } from "../../../../lib/image-store.ts";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json(updateMiniature(id, (await request.json()) as MiniatureInput));
  } catch (error) {
    return commandResponse(error);
  }
}

export const DELETE = serializeImageMutation(async function DELETE(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = deleteMiniature(id);
  await deleteImage(result.imageKey);
  return Response.json({ ok: result.ok });
});
