import { eq } from "drizzle-orm";

import { getDb } from "../../../../../db";
import { miniatures } from "../../../../../db/schema";
import { serializeImageMutation } from "../../../../../lib/image-mutations";
import { deleteImage, imageCacheControl, loadImage, saveImage } from "../../../../../lib/image-store";
import { downloadPublicImage } from "../../../image-import/route";

async function findMiniature(id: string) {
  const [row] = await getDb().select().from(miniatures).where(eq(miniatures.id, id));
  return row;
}

// Points a miniature at another photo and returns the key it had, or undefined when the miniature
// doesn't exist. Reading and updating in one transaction means two overlapping changes each remove
// the photo they actually replaced.
function setImageKey(id: string, imageKey: string | null) {
  return getDb().transaction((tx) => {
    const row = tx
      .select({ imageKey: miniatures.imageKey })
      .from(miniatures)
      .where(eq(miniatures.id, id))
      .get();
    if (!row) return undefined;
    tx.update(miniatures)
      .set({ imageKey, sourceImageUrl: null, updatedAt: Date.now() })
      .where(eq(miniatures.id, id))
      .run();
    return row.imageKey;
  });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const row = await findMiniature(id);
  if (!row?.imageKey) return new Response("Not found", { status: 404 });
  const image = await loadImage(row.imageKey);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "content-type": image.contentType,
      "cache-control": imageCacheControl(request, row.imageKey),
    },
  });
}

export const POST = serializeImageMutation(async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const row = await findMiniature(id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  let file: FormDataEntryValue | null;
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { url?: string };
    const result = await downloadPublicImage(body.url ?? "");
    if (!result.ok) return result;
    const imageType = result.headers.get("content-type") || "image/jpeg";
    file = new File([await result.arrayBuffer()], "miniature-image", { type: imageType });
  } else {
    const data = await request.formData();
    file = (data as unknown as { get(name: string): FormDataEntryValue | null }).get("image");
  }
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return Response.json({ error: "Choose an image file" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return Response.json({ error: "Image must be under 8 MB" }, { status: 400 });
  }
  // The old photo is removed only once the row points at the new one, so a failure at any step
  // leaves the miniature with a photo that exists; at worst an unused file is left behind.
  const key = await saveImage(file);
  let previous: string | null | undefined;
  try {
    previous = setImageKey(id, key);
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
  const previous = setImageKey(id, null);
  if (previous === undefined) return Response.json({ error: "Not found" }, { status: 404 });
  await deleteImage(previous);
  return Response.json({ ok: true });
});
