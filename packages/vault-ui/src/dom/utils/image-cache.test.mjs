import assert from "node:assert/strict";
import test from "node:test";

import { imageUrl, rememberImageScope } from "./image-cache.ts";

test("desktop image namespaces change without mutating persisted URLs and web URLs remain unchanged", () => {
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  try {
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: new URL("paintvault://app/"),
    });
    const source = "/api/miniatures/same-id/image?v=photo-key";
    rememberImageScope(new Response("", { headers: { "x-paint-vault-image-scope": "server-a-account-a" } }));
    assert.equal(imageUrl(source), `${source}&_pv_scope=server-a-account-a`);
    for (const url of [
      "https://example.com/a.webp",
      "data:image/png;base64,abc",
      "blob:preview",
      "/api/auth/status",
      "/api/miniatures/id/image/other",
      "//other.invalid/api/catalog-source-images/key.webp",
    ]) {
      assert.equal(imageUrl(url), url);
    }
    rememberImageScope(new Response("", { headers: { "x-paint-vault-image-scope": "server-b-account-b" } }));
    assert.equal(imageUrl(source), `${source}&_pv_scope=server-b-account-b`);
    assert.equal(imageUrl(`${source}&_pv_scope=old`), `${source}&_pv_scope=server-b-account-b`);
    assert.equal(
      imageUrl("/api/catalog-source-images/key.webp"),
      "/api/catalog-source-images/key.webp?_pv_scope=server-b-account-b",
    );
    assert.equal(
      imageUrl("/api/catalog-source-logos/id?v=hash"),
      "/api/catalog-source-logos/id?v=hash&_pv_scope=server-b-account-b",
    );
    assert.equal(
      imageUrl("/api/miniature-templates/id/image?v=key"),
      "/api/miniature-templates/id/image?v=key&_pv_scope=server-b-account-b",
    );
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: new URL("https://fixture.invalid/"),
    });
    assert.equal(imageUrl(source), source);
    rememberImageScope(new Response(""));
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: new URL("paintvault://app/"),
    });
    assert.equal(imageUrl(source), source);
  } finally {
    rememberImageScope(new Response(""));
    if (originalLocation) Object.defineProperty(globalThis, "location", originalLocation);
    else delete globalThis.location;
  }
});
