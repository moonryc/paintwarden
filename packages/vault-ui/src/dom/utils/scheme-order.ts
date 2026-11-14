import { i18n } from "@paintwarden/i18n/runtime";
import { arrayMove } from "@dnd-kit/sortable";

import type { DividerRole, PinnedStartMilestone, SchemeOrderEntry, State } from "../types";

import { createClientId } from "./client-id";
import { REQUIRED_MILESTONE_LABELS } from "./scheme-milestones";

export { REQUIRED_MILESTONE_LABELS };
export { insertIntoSchemeStep, reorderSchemeEntries, schemePaintsHaveSteps } from "./scheme-step-placement";

export const displayDividerLabel = (role: DividerRole | null | undefined, label: string) =>
  role ? i18n.t(role === "START" ? "shell:milestoneStart" : "shell:milestoneComplete") : label;

export const customSchemeMilestones = (): SchemeOrderEntry[] => [
  {
    type: "DIVIDER",
    id: createClientId(),
    label: REQUIRED_MILESTONE_LABELS.START,
    tone: "MILESTONE",
    role: "START",
    sortOrder: 0,
  },
  {
    type: "DIVIDER",
    id: createClientId(),
    label: REQUIRED_MILESTONE_LABELS.COMPLETE,
    tone: "MILESTONE",
    role: "COMPLETE",
    sortOrder: 1,
  },
];

export const isRequiredMilestone = (entry: SchemeOrderEntry) => entry.type === "DIVIDER" && !!entry.role;

export const isPinnedStartMilestone = (entry: SchemeOrderEntry): entry is PinnedStartMilestone =>
  entry.type === "DIVIDER" && entry.role === "START";

export const keepStartMilestoneFirst = (items: SchemeOrderEntry[]) => {
  const start = items.findIndex(isPinnedStartMilestone);
  return (start > 0 ? arrayMove(items, start, 0) : items).map((item, sortOrder) => ({ ...item, sortOrder }));
};

export const insertBeforeCompletionMilestone = (items: SchemeOrderEntry[], entry: SchemeOrderEntry) => {
  const completion = items.findIndex((item) => item.type === "DIVIDER" && item.role === "COMPLETE");
  const next = [...items];
  next.splice(completion < 0 ? next.length : completion, 0, entry);
  return next.map((item, sortOrder) => ({ ...item, sortOrder }));
};

export function schemePaintRows(data: State, schemeId: string) {
  return data.colorSchemePaints
    .filter((row) => row.schemeId === schemeId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function schemeOrderEntries(data: State, schemeId: string): SchemeOrderEntry[] {
  return [
    ...data.colorSchemePaints
      .filter((row) => row.schemeId === schemeId)
      .map((row) => ({
        type: "PAINT" as const,
        id: `paint-row:${row.sortOrder}`,
        paintId: row.paintId,
        sortOrder: row.sortOrder,
      })),
    ...data.colorSchemeDividers
      .filter((row) => row.schemeId === schemeId)
      .map((row) => ({
        type: "DIVIDER" as const,
        id: row.id,
        label: displayDividerLabel(row.role, row.label),
        tone: row.tone,
        role: row.role ?? null,
        sortOrder: row.sortOrder,
      })),
    ...data.colorSchemeImages
      .filter((row) => row.schemeId === schemeId)
      .map((row) => ({
        type: "IMAGE" as const,
        id: row.id,
        imageUrl: row.imageUrl,
        thumbnailUrl: row.thumbnailUrl,
        imageType: row.imageType,
        method: row.method,
        sortOrder: row.sortOrder,
      })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);
}
