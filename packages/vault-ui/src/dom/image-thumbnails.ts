import {
  IMAGE_THUMBNAIL_WIDTHS,
  imageThumbnailUrl,
  isLocalThumbnailImage,
} from "@paint-vault/core/image-thumbnails";

import { imageUrl } from "./utils/image-cache.ts";

// The caller reserves its image's aspect ratio; detail/lightbox views deliberately
// do not use this helper and continue requesting the original image.
export function thumbnailImageProps(url: string, sizes: string) {
  return {
    src: imageUrl(imageThumbnailUrl(url)),
    ...(isLocalThumbnailImage(url)
      ? {
          srcSet: IMAGE_THUMBNAIL_WIDTHS.map(
            (width) => `${imageUrl(imageThumbnailUrl(url, width))} ${width}w`,
          ).join(", "),
          sizes,
        }
      : {}),
    loading: "lazy" as const,
    decoding: "async" as const,
  };
}
