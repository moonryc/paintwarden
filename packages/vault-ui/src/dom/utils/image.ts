import { i18n } from "../i18n";

export async function preprocessImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file),
    max = 1600,
    ratio = 4 / 3;
  let sx = 0,
    sy = 0,
    sw = bitmap.width,
    sh = bitmap.height;
  if (sw / sh > ratio) {
    sw = sh * ratio;
    sx = (bitmap.width - sw) / 2;
  } else {
    sh = sw / ratio;
    sy = (bitmap.height - sh) / 2;
  }
  const width = Math.min(max, sw),
    height = Math.round(width / ratio),
    canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (v) => (v ? resolve(v) : reject(new Error(i18n.t("components:couldNotImportThatImage")))),
      "image/webp",
      0.84,
    ),
  );
  return new File([blob], "miniature.webp", { type: "image/webp" });
}

export async function imageFormData(file: File) {
  const form = new FormData();
  form.append("image", await preprocessImage(file));
  return form;
}

export function droppedImageUrl(data: DataTransfer) {
  const uri = data
    .getData("text/uri-list")
    .split(/\r?\n/)
    .find((line) => line && !line.startsWith("#"));
  const value = uri || data.getData("text/plain").trim();
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function imageNameFromUrl(value: string) {
  try {
    return decodeURIComponent(new URL(value).pathname.split("/").pop() || "project-image");
  } catch {
    return "project-image";
  }
}

export async function rotateImage(
  source: File | string,
  headers: Record<string, string> = {},
): Promise<File> {
  const blob =
    typeof source === "string"
      ? await fetch(source, { headers, cache: "no-store" }).then((response) => response.blob())
      : source;
  const bitmap = await createImageBitmap(blob),
    canvas = document.createElement("canvas");
  canvas.width = bitmap.height;
  canvas.height = bitmap.width;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const out = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error(i18n.t("components:couldNotRotatePhoto")))),
      "image/webp",
      0.84,
    ),
  );
  return new File([out], "miniature.webp", { type: "image/webp" });
}
