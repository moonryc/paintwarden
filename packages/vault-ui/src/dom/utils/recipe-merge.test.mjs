import assert from "node:assert/strict";
import test from "node:test";

import { mergeRecipePaints } from "./recipe-merge.ts";

test("merges repeated scheme paints within a step and keeps each source", () => {
  const rows = mergeRecipePaints(
    [{ paintId: "red", step: "BASECOAT", notes: "Thin coats", sortOrder: 0 }],
    [
      {
        id: "armor",
        name: "Armor",
        entries: [
          { type: "DIVIDER", label: "BASECOAT", tone: "SECTION" },
          { type: "PAINT", paintId: "red" },
          { type: "PAINT", paintId: "red" },
          { type: "DIVIDER", label: "GET BATTLE READY!", tone: "MILESTONE" },
          { type: "PAINT", paintId: "blue" },
          { type: "DIVIDER", label: "HIGHLIGHT", tone: "SECTION" },
          { type: "PAINT", paintId: "red" },
        ],
      },
      {
        id: "cloth",
        name: "Cloth",
        entries: [
          { type: "DIVIDER", label: "BASECOAT", tone: "SECTION" },
          { type: "PAINT", paintId: "red" },
        ],
      },
    ],
  );
  assert.deepEqual(
    rows.map(({ paintId, step, manual, schemeSources }) => [paintId, step, !!manual, schemeSources]),
    [
      [
        "red",
        "BASECOAT",
        true,
        [
          { id: "armor", name: "Armor" },
          { id: "cloth", name: "Cloth" },
        ],
      ],
      ["blue", "BASECOAT", false, [{ id: "armor", name: "Armor" }]],
      ["red", "HIGHLIGHT", false, [{ id: "armor", name: "Armor" }]],
    ],
  );
  const schemeOnly = mergeRecipePaints(
    [],
    [
      {
        id: "armor",
        name: "Armor",
        entries: [
          { type: "DIVIDER", label: "BASECOAT", tone: "SECTION" },
          { type: "PAINT", paintId: "red" },
        ],
      },
    ],
  );
  assert.deepEqual(
    schemeOnly.map(({ paintId, manual, schemeSources }) => [paintId, manual, schemeSources]),
    [["red", null, [{ id: "armor", name: "Armor" }]]],
  );
});

test("unrecognized or missing section uses Other and milestones do not set a step", () => {
  const rows = mergeRecipePaints(
    [],
    [
      {
        id: "legacy",
        name: "Legacy",
        entries: [
          { type: "PAINT", paintId: "first" },
          { type: "DIVIDER", label: "Unusual label", tone: "SECTION" },
          { type: "PAINT", paintId: "second" },
          { type: "DIVIDER", label: "GET PARADE READY!", tone: "MILESTONE" },
          { type: "PAINT", paintId: "third" },
          { type: "DIVIDER", label: "Drybrush", tone: "SECTION" },
          { type: "PAINT", paintId: "fourth" },
        ],
      },
    ],
  );
  assert.deepEqual(
    rows.map(({ paintId, step }) => [paintId, step]),
    [
      ["first", "OTHER"],
      ["second", "OTHER"],
      ["third", "OTHER"],
      ["fourth", "DRYBRUSH"],
    ],
  );
});

test("schemes with the same name keep distinct image sources", () => {
  const rows = mergeRecipePaints(
    [],
    [
      { id: "one", name: "Armor", entries: [{ type: "PAINT", paintId: "red" }] },
      { id: "two", name: "Armor", entries: [{ type: "PAINT", paintId: "red" }] },
    ],
  );
  assert.deepEqual(rows[0].schemeSources, [
    { id: "one", name: "Armor" },
    { id: "two", name: "Armor" },
  ]);
});
