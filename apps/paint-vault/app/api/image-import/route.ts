import { BlockedUrlError, ResponseTooLargeError, downloadPublic } from "../../../lib/public-fetch";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { url?: string };
  return downloadPublicImage(body.url ?? "");
}

export async function downloadPublicImage(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return Response.json({ error: "That image link is not valid" }, { status: 400 });
  }
  try {
    const image = await downloadPublic(url, { maxBytes: MAX_IMAGE_BYTES, accept: "image/*" });
    if (image.status < 200 || image.status >= 300)
      return Response.json({ error: `The image server returned ${image.status}` }, { status: 400 });
    if (!image.contentType.startsWith("image/"))
      return Response.json({ error: "That link did not return an image" }, { status: 400 });
    return new Response(new Uint8Array(image.bytes), {
      headers: { "content-type": image.contentType, "cache-control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof BlockedUrlError
        ? "Only public HTTP image links can be imported"
        : error instanceof ResponseTooLargeError
          ? "Image must be under 8 MB"
          : "Could not download that image";
    return Response.json({ error: message }, { status: 400 });
  }
}
