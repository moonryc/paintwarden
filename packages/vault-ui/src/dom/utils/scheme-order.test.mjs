import assert from "node:assert/strict";
import test from "node:test";

import { convertedSchemeEntries } from "./converted-scheme-entries.ts";
import {
  insertIntoSchemeStep,
  reorderSchemeEntries,
  schemePaintsHaveSteps,
} from "./scheme-step-placement.ts";

test("converted scheme preserves order and references while renewing entry ids", () => {
  let next = 0;
  const entries = [
    {
      type: "DIVIDER",
      id: "start-old",
      label: "GET READY!",
      tone: "MILESTONE",
      role: "START",
      sortOrder: 0,
    },
    { type: "PAINT", id: "row", paintId: "missing", sortOrder: 1 },
    {
      type: "IMAGE",
      id: "image-old",
      imageUrl: "https://example.com/a.png",
      thumbnailUrl: null,
      imageType: null,
      method: null,
      sortOrder: 2,
    },
    {
      type: "DIVIDER",
      id: "complete-old",
      label: "YOU'RE READY!",
      tone: "MILESTONE",
      role: "COMPLETE",
      sortOrder: 3,
    },
  ];
  const result = convertedSchemeEntries(entries, { missing: "owned" }, () => `new-${++next}`);

  assert.deepEqual(
    result.map((entry) => entry.type),
    ["DIVIDER", "PAINT", "IMAGE", "DIVIDER"],
  );
  assert.equal(result[0].id, "new-1");
  assert.equal(result[0].role, "START");
  assert.equal(result[1].paintId, "owned");
  assert.equal(result[2].imageUrl, "https://example.com/a.png");
  assert.equal(result[2].id, "new-2");
  assert.equal(result[3].id, "new-3");
  assert.equal(result[3].role, "COMPLETE");
});

test("scheme paints stay inside an explicit step", () => {
  const entries = [
    { type: "DIVIDER", id: "start", tone: "MILESTONE", label: "GET READY!", sortOrder: 0 },
    { type: "DIVIDER", id: "base", tone: "SECTION", label: "BASECOAT", sortOrder: 1 },
    { type: "DIVIDER", id: "finish", tone: "MILESTONE", label: "YOU'RE READY!", sortOrder: 2 },
  ];
  const paint = { type: "PAINT", id: "paint", paintId: "blue", sortOrder: 0 };
  assert.equal(schemePaintsHaveSteps([...entries.slice(0, 1), paint, ...entries.slice(1)]), false);
  const placed = insertIntoSchemeStep(entries, "base", paint);
  assert.deepEqual(
    placed.map((entry) => entry.id),
    ["start", "base", "paint", "finish"],
  );
  assert.equal(schemePaintsHaveSteps(placed), true);
  assert.deepEqual(
    reorderSchemeEntries(placed, "paint", "start").map((entry) => entry.id),
    ["start", "base", "paint", "finish"],
  );
  const withSecondStep = [
    ...placed.slice(0, 3),
    { type: "DIVIDER", id: "layer", tone: "SECTION", label: "LAYER", sortOrder: 3 },
    { type: "PAINT", id: "highlight", paintId: "white", sortOrder: 4 },
    placed[3],
  ];
  assert.deepEqual(
    reorderSchemeEntries(withSecondStep, "layer", "base").map((entry) => entry.id),
    ["start", "layer", "highlight", "base", "paint", "finish"],
  );
});
