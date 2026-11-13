import assert from "node:assert/strict";
import test from "node:test";

import type { MiniatureSchemeRead } from "./miniature-scheme-loader";
import { schemeEntryModels } from "./miniature-scheme-model";

type Entry = MiniatureSchemeRead["entries"]["nodes"][number];
const divider: Entry = {
  id: "persisted-divider-uuid",
  kind: "DIVIDER",
  sortOrder: 0,
  paint: null,
  label: "Legacy glaze and stipple",
  tone: "SECTION",
  role: null,
  imageUrl: null,
  thumbnailUrl: null,
  imageType: null,
  method: null,
};

void test("editable scheme mapping preserves legacy divider IDs and labels and image metadata", () => {
  const image: Entry = {
    ...divider,
    id: "persisted-image-uuid",
    kind: "IMAGE",
    sortOrder: 1,
    label: null,
    tone: null,
    imageUrl: "https://example.test/image.webp",
    thumbnailUrl: "https://example.test/thumb.webp",
    imageType: "FINISHED",
    method: "painted",
  };
  const result = schemeEntryModels([divider, image]);
  assert.deepEqual(result.entries, [
    { id: divider.id, type: "DIVIDER", sortOrder: 0, label: divider.label, tone: "SECTION", role: null },
    {
      id: image.id,
      type: "IMAGE",
      sortOrder: 1,
      imageUrl: image.imageUrl,
      thumbnailUrl: image.thumbnailUrl,
      imageType: image.imageType,
      method: image.method,
    },
  ]);
  assert.deepEqual(result.paints, []);
});

void test("mapping rejects invalid entry roles and missing paints instead of inventing partial entries", () => {
  assert.throws(() => schemeEntryModels([{ ...divider, role: "UNKNOWN" }]), /invalid/);
  assert.throws(() => schemeEntryModels([{ ...divider, kind: "PAINT" }]), /no paint/);
  assert.throws(() => schemeEntryModels([{ ...divider, kind: "IMAGE" }]), /no image URL/);
});

void test("scheme paints carry server availability, substitution and inventory without a snapshot", () => {
  const paint: NonNullable<Entry["paint"]> = {
    id: "paint",
    name: "Paint",
    brand: "Brand",
    range: "Range",
    colorHex: "#112233",
    sourceUrl: null,
    isCustom: false,
    sourceName: null,
    sourceLogoUrl: null,
    inventory: { state: "WISHLIST", stockLevel: "LOW", quantity: 0 },
    available: true,
    hasActiveSubstitution: true,
    brokenReason: null,
    missingStock: false,
    brokenSubstitution: false,
    activeSubstitution: { id: "mix", name: "Available mix" },
  };
  const result = schemeEntryModels([{ ...divider, kind: "PAINT", paint }]);
  assert.equal(result.entries[0].type, "PAINT");
  assert.equal(result.paints[0].id, paint.id);
  assert.equal(result.projections[0].available, true);
  assert.deepEqual(result.projections[0].substitution, paint.activeSubstitution);
  assert.deepEqual(result.projections[0].record, { state: "WISHLIST", stockLevel: "LOW", quantity: 0 });
});
