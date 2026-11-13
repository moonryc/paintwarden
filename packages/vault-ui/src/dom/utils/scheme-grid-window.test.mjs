import assert from "node:assert/strict";
import test from "node:test";

import { schemeGridWindow } from "./scheme-grid-window.ts";

const base = {
  itemCount: 10,
  columns: 1,
  rowHeight: 100,
  rowGap: 10,
  gridTop: 200,
  scrollY: 0,
  viewportHeight: 300,
  overscanRows: 1,
};

test("one-column grid mounts nearby rows and reserves full scroll height", () => {
  assert.deepEqual(schemeGridWindow(base), {
    startRow: 0,
    endRow: 2,
    startIndex: 0,
    endIndex: 2,
    totalRows: 10,
    topOffset: 0,
    totalHeight: 1090,
  });
});

test("two-column grid includes the final partial row", () => {
  const result = schemeGridWindow({
    ...base,
    itemCount: 11,
    columns: 2,
    gridTop: 100,
    scrollY: 430,
    viewportHeight: 220,
  });
  assert.deepEqual(result, {
    startRow: 2,
    endRow: 6,
    startIndex: 4,
    endIndex: 11,
    totalRows: 6,
    topOffset: 220,
    totalHeight: 650,
  });
});

test("resizing from two to three columns recalculates the mounted indices", () => {
  const options = { ...base, gridTop: 100, scrollY: 310, viewportHeight: 100, overscanRows: 0 };
  const twoColumns = schemeGridWindow({ ...options, columns: 2 });
  const threeColumns = schemeGridWindow({ ...options, columns: 3 });
  assert.deepEqual([twoColumns.startIndex, twoColumns.endIndex, twoColumns.totalRows], [2, 6, 5]);
  assert.deepEqual([threeColumns.startIndex, threeColumns.endIndex, threeColumns.totalRows], [3, 9, 4]);
});

test("deep scrolling still mounts the final item", () => {
  const result = schemeGridWindow({
    ...base,
    itemCount: 548,
    columns: 3,
    rowHeight: 288,
    rowGap: 16,
    scrollY: 60000,
    viewportHeight: 1000,
    overscanRows: 2,
  });
  assert.equal(result.startIndex, 546);
  assert.equal(result.endIndex, 548);
  assert.equal(result.endRow, result.totalRows);
});

test("shrinking a deeply scrolled list clamps the range", () => {
  const result = schemeGridWindow({
    ...base,
    itemCount: 5,
    columns: 3,
    rowHeight: 288,
    rowGap: 16,
    scrollY: 60000,
    viewportHeight: 1000,
  });
  assert.deepEqual([result.startRow, result.endRow, result.startIndex, result.endIndex], [1, 2, 3, 5]);
  assert.equal(result.totalHeight, 592);
});

test("empty results have no mounted rows or spacer height", () => {
  assert.deepEqual(schemeGridWindow({ ...base, itemCount: 0 }), {
    startRow: 0,
    endRow: 0,
    startIndex: 0,
    endIndex: 0,
    totalRows: 0,
    topOffset: 0,
    totalHeight: 0,
  });
});
