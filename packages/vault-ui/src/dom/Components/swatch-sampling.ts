export type ImagePoint = { x: number; y: number };
export function imagePoint(
  client: ImagePoint,
  bounds: { left: number; top: number; width: number; height: number },
  size: { width: number; height: number },
): ImagePoint | null {
  if (bounds.width <= 0 || bounds.height <= 0 || size.width <= 0 || size.height <= 0) return null;
  const x = (client.x - bounds.left) / bounds.width;
  const y = (client.y - bounds.top) / bounds.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return {
    x: Math.min(size.width - 1, Math.floor(x * size.width)),
    y: Math.min(size.height - 1, Math.floor(y * size.height)),
  };
}
export function canSampleImage(source: string, base: string): boolean {
  try {
    const url = new URL(source, base),
      origin = new URL(base);
    // Electron's custom scheme has opaque origin 'null'; compare protocol + host
    // explicitly rather than accidentally treating two opaque URLs as same-origin.
    return (
      url.protocol === origin.protocol &&
      url.host === origin.host &&
      (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "paintwarden:")
    );
  } catch {
    return false;
  }
}
export function averagedHex(pixels: Uint8ClampedArray): string | null {
  const sum = [0, 0, 0];
  let weight = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    weight += alpha;
    for (let c = 0; c < 3; c++) {
      const value = pixels[i + c] / 255;
      sum[c] += (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * alpha;
    }
  }
  if (!weight) return null;
  return (
    "#" +
    sum
      .map((value) => {
        const linear = value / weight;
        const srgb = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
        return Math.round(srgb * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
      .toUpperCase()
  );
}
export function sampleImage(image: HTMLImageElement, point: ImagePoint): string | null {
  // Read a clipped 9x9 area of the ORIGINAL. Never allocate a full-photo canvas,
  // upscale a thumbnail or mix transparent out-of-bounds pixels at image edges.
  const left = Math.max(0, point.x - 4),
    top = Math.max(0, point.y - 4);
  const width = Math.min(image.naturalWidth - left, 9),
    height = Math.min(image.naturalHeight - top, 9);
  if (width <= 0 || height <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, left, top, width, height, 0, 0, width, height);
  return averagedHex(context.getImageData(0, 0, width, height).data);
}
