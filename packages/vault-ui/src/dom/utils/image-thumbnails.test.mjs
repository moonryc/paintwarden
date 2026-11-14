import assert from "node:assert/strict";
import test from "node:test";

import { rememberImageScope } from "./image-cache.ts";

import { thumbnailImageProps } from "../image-thumbnails.ts";

test("list images offer the three bounded widths without losing their immutable key", () => {
  const props = thumbnailImageProps("/api/miniatures/model/image?v=immutable.webp&w=320", "160px");
  assert.equal(props.src, "/api/miniatures/model/image?v=immutable.webp&w=320");
  assert.equal(
    props.srcSet,
    [160, 320, 640]
      .map((width) => `/api/miniatures/model/image?v=immutable.webp&w=${width} ${width}w`)
      .join(", "),
  );
  assert.equal(props.sizes, "160px");
  assert.equal(props.loading, "lazy");
  assert.equal(props.decoding, "async");
});

test("external images and vector source logos are never sent through a local transform", () => {
  for (const src of ["https://example.test/image.png", "/api/catalog-source-logos/source?v=logo"]) {
    assert.deepEqual(thumbnailImageProps(src, "160px"), { src, loading: "lazy", decoding: "async" });
  }
});

test("desktop thumbnail candidates retain the active server/account namespace", () => {
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  try {
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: new URL("paintwarden://app/"),
    });
    rememberImageScope(new Response("", { headers: { "x-paintwarden-image-scope": "server-account" } }));
    const props = thumbnailImageProps("/api/miniatures/model/image?v=key.webp", "160px");
    assert.equal(props.src, "/api/miniatures/model/image?v=key.webp&w=320&_pv_scope=server-account");
    assert.equal(props.srcSet.split(", ").length, 3);
    for (const candidate of props.srcSet.split(", ")) {
      const url = new URL(candidate.split(" ")[0], "https://vault.test");
      assert.equal(url.searchParams.get("v"), "key.webp");
      assert.equal(url.searchParams.get("_pv_scope"), "server-account");
    }
  } finally {
    rememberImageScope(new Response(""));
    if (originalLocation) Object.defineProperty(globalThis, "location", originalLocation);
    else delete globalThis.location;
  }
});
