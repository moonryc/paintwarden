export const IMAGE_THUMBNAIL_WIDTHS = [160, 320, 640] as const;
export type ImageThumbnailWidth = (typeof IMAGE_THUMBNAIL_WIDTHS)[number];

// Only local raster routes support variants. Never proxy or rewrite external
// images (including absolute same-origin URLs), SVG logos, data or blob URLs.
export function isLocalThumbnailImage(url: string): boolean {
  return /^\/api\/(?:miniatures\/[^/?#\\]+\/image|miniature-templates\/[^/?#\\]+\/image|catalog-source-images\/[^/?#\\]+)(?:[?#]|$)/.test(
    url,
  );
}

export function imageThumbnailUrl(url: string, width: ImageThumbnailWidth = 320): string {
  if (!isLocalThumbnailImage(url)) return url;
  const hashStart = url.indexOf("#");
  const hash = hashStart < 0 ? "" : url.slice(hashStart);
  const resource = hashStart < 0 ? url : url.slice(0, hashStart);
  const queryStart = resource.indexOf("?");
  const pathname = queryStart < 0 ? resource : resource.slice(0, queryStart);
  const query = new URLSearchParams(queryStart < 0 ? "" : resource.slice(queryStart + 1));
  // Preserve the immutable image-key v and any other existing query values.
  query.set("w", String(width));
  return `${pathname}?${query}${hash}`;
}
