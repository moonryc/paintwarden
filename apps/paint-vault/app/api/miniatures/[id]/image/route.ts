import { eq } from "drizzle-orm";

import { getDb } from "../../../../../db";
import { miniatures } from "../../../../../db/schema";
import { setMiniatureImage } from "../../../../../lib/commands/miniatures.ts";
import { serializeImageMutation } from "../../../../../lib/image-mutations";
import { deleteImage, imageResponse, saveImage, saveImageBytes } from "../../../../../lib/image-store";
import { downloadPublicImage } from "../../../image-import/route";

async function findMiniature(id: string) {
  const [row] = await getDb().select().from(miniatures).where(eq(miniatures.id, id));
  return row;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const row = await findMiniature(id);
  if (!row?.imageKey) return new Response("Not found", { status: 404 });
  return imageResponse(row.imageKey, request);
}

export const POST = serializeImageMutation(async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const row = await findMiniature(id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  let file: FormDataEntryValue | { bytes: Uint8Array; type: string; size: number } | null;
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { url?: string };
    const result = await downloadPublicImage(body.url ?? "");
    if (!result.ok) return result;
    const imageType = result.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await result.arrayBuffer());
    file = { bytes, type: imageType.toLowerCase(), size: bytes.byteLength };
  } else {
    const data = await request.formData();
    file = (data as unknown as { get(name: string): FormDataEntryValue | null }).get("image");
  }
  if (!file || typeof file === "string" || !file.type.startsWith("image/")) {
    return Response.json({ error: "Choose an image file" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return Response.json({ error: "Image must be under 8 MB" }, { status: 400 });
  }
  // The old photo is removed only once the row points at the new one, so a failure at any step
  // leaves the miniature with a photo that exists; at worst an unused file is left behind.
  const key = file instanceof File ? await saveImage(file) : await saveImageBytes(file.bytes, file.type);
  let previous: string | null | undefined;
  try {
    previous = setMiniatureImage(id, key);
  } catch (error) {
    await deleteImage(key);
    throw error;
  }
  if (previous === undefined) {
    await deleteImage(key);
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await deleteImage(previous);
  return Response.json({
    imageUrl: `/api/miniatures/${encodeURIComponent(id)}/image?v=${encodeURIComponent(key)}`,
  });
});

export const DELETE = serializeImageMutation(async function DELETE(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const previous = setMiniatureImage(id, null);
  if (previous === undefined) return Response.json({ error: "Not found" }, { status: 404 });
  await deleteImage(previous);
  return Response.json({ ok: true });
});
