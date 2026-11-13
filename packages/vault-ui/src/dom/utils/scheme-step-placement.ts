import type { SchemeOrderEntry } from "../types";

export function insertIntoSchemeStep(items: SchemeOrderEntry[], stepId: string, entry: SchemeOrderEntry) {
  const stepIndex = items.findIndex(
    (item) => item.type === "DIVIDER" && item.tone === "SECTION" && item.id === stepId,
  );
  if (stepIndex < 0) return items;
  const nextDivider = items.findIndex((item, index) => index > stepIndex && item.type === "DIVIDER");
  const next = [...items];
  next.splice(nextDivider < 0 ? next.length : nextDivider, 0, entry);
  return next.map((item, sortOrder) => ({ ...item, sortOrder }));
}

export function schemePaintsHaveSteps(items: SchemeOrderEntry[]) {
  let inStep = false;
  for (const item of items) {
    if (item.type === "DIVIDER" && item.tone === "SECTION") inStep = true;
    if (item.type === "DIVIDER" && item.tone === "MILESTONE") inStep = false;
    if (item.type === "PAINT" && !inStep) return false;
  }
  return true;
}

export function reorderSchemeEntries(items: SchemeOrderEntry[], draggedId: string, overId: string) {
  const from = items.findIndex((item) => item.id === draggedId);
  const to = items.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0 || from === to) return items;
  const dragged = items[from];
  const end =
    dragged.type === "DIVIDER" && dragged.tone === "SECTION"
      ? items.findIndex((item, index) => index > from && item.type === "DIVIDER")
      : from + 1;
  const block = items.slice(from, end < 0 ? items.length : end);
  if (block.some((item) => item.id === overId)) return items;
  const remaining = items.filter((item) => !block.includes(item));
  let insertAt = remaining.findIndex((item) => item.id === overId);
  if (dragged.type === "DIVIDER" && remaining[insertAt]?.type !== "DIVIDER") {
    while (insertAt > 0 && remaining[insertAt]?.type !== "DIVIDER") insertAt--;
  }
  if (insertAt < 0) return items;
  remaining.splice(insertAt, 0, ...block);
  if (!schemePaintsHaveSteps(remaining)) return items;
  return remaining.map((item, sortOrder) => ({ ...item, sortOrder }));
}
