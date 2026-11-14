import assert from "node:assert/strict";
import test from "node:test";

import { imageThumbnailUrl, isLocalThumbnailImage } from "./image-thumbnails.ts";

test("local image variants preserve immutable keys and replace existing width", () => {
  for (const path of [
    "/api/miniatures/mini%20one/image",
    "/api/miniature-templates/template/image",
    "/api/catalog-source-images/abc.webp",
  ]) {
    for (const width of [160, 320, 640] as const) {
      const result = imageThumbnailUrl(`${path}?v=key%2B1.webp&w=320&w=160#preview`, width);
      const url = new URL(result, "https://vault.test");
      assert.equal(url.pathname, path);
      assert.equal(url.searchParams.get("v"), "key+1.webp");
      assert.deepEqual(url.searchParams.getAll("w"), [String(width)]);
      assert.equal(url.hash, "#preview");
    }
  }
  assert.equal(
    imageThumbnailUrl("/api/catalog-source-images/abc.webp"),
    "/api/catalog-source-images/abc.webp?w=320",
  );
});

test("unsupported and external URLs remain byte-for-byte unchanged", () => {
  for (const url of [
    "https://example.test/photo.jpg?v=original",
    "https://vault.test/api/miniatures/id/image",
    "//example.test/api/catalog-source-images/a.webp",
    "data:image/png;base64,AAA=",
    "blob:https://vault.test/123",
    "/api/catalog-source-logos/source?v=hash",
    "/api/miniatures/id/image/other",
    "/api/miniatures/id\\other/image",
    "",
  ]) {
    assert.equal(isLocalThumbnailImage(url), false, url);
    assert.equal(imageThumbnailUrl(url), url);
  }
});
