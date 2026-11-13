import { stepFromDivider, type RecipeStep } from "@paint-vault/core/recipe-steps";

type ManualPaint = { paintId: string; step: RecipeStep; notes: string; sortOrder: number };
type SchemeEntry =
  | { type: "PAINT"; paintId: string }
  | { type: "DIVIDER"; label: string; tone: "SECTION" | "MILESTONE" }
  | { type: "IMAGE" };

export type RecipePaint<M extends ManualPaint = ManualPaint> = {
  paintId: string;
  step: RecipeStep;
  manual: M | null;
  schemeSources: { id: string; name: string }[];
};

export function mergeRecipePaints<M extends ManualPaint>(
  manual: M[],
  schemes: { id: string; name: string; entries: SchemeEntry[] }[],
): RecipePaint<M>[] {
  const rows = new Map<string, RecipePaint<M>>();
  const get = (paintId: string, step: RecipeStep) => {
    const key = `${step}:${paintId}`;
    let row = rows.get(key);
    if (!row) {
      row = { paintId, step, manual: null, schemeSources: [] };
      rows.set(key, row);
    }
    return row;
  };
  for (const entry of manual) get(entry.paintId, entry.step).manual ??= entry;
  for (const scheme of schemes) {
    let step: RecipeStep | null = null;
    for (const entry of scheme.entries) {
      if (entry.type === "DIVIDER" && entry.tone === "SECTION") step = stepFromDivider(entry.label);
      if (entry.type === "PAINT") {
        const row = get(entry.paintId, step ?? "OTHER");
        if (!row.schemeSources.some((source) => source.id === scheme.id))
          row.schemeSources.push({ id: scheme.id, name: scheme.name });
      }
    }
  }
  return [...rows.values()];
}
