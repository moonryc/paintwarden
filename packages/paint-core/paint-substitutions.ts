import { isPaintOwned, type PaintState, type StockLevel } from "./paint-state.ts";

export type PaintSubstitution = { id: string; targetPaintId: string; name: string; isDefault: boolean };
export type PaintSubstitutionIngredient = {
  substitutionId: string;
  paintId: string;
  parts: number;
  sortOrder: number;
};
export type MiniaturePaintSubstitution = {
  miniatureId: string;
  targetPaintId: string;
  substitutionId: string | null;
  useOriginal: boolean;
};

export type SubstitutionData = {
  paintSubstitutions: PaintSubstitution[];
  paintSubstitutionIngredients: PaintSubstitutionIngredient[];
  miniaturePaintSubstitutions: MiniaturePaintSubstitution[];
};

export function defaultSubstitution(data: SubstitutionData, paintId: string) {
  // Legacy per-miniature choices stay in saved vaults, but the paint's default is authoritative.
  return data.paintSubstitutions.find((row) => row.targetPaintId === paintId && row.isDefault) ?? null;
}

export function selectedSubstitution(data: SubstitutionData, _miniatureId: string, paintId: string) {
  return defaultSubstitution(data, paintId);
}

type PaintChoice = { paintIds: string[]; cycle: boolean; substitutionIds: string[] };
type ChoiceLookup = {
  substitution(paintId: string): PaintSubstitution | null;
  ingredients(substitutionId: string): PaintSubstitutionIngredient[];
};

function resolveChoice(lookup: ChoiceLookup, paintId: string, trail: string[]): PaintChoice {
  if (trail.includes(paintId)) return { paintIds: [], cycle: true, substitutionIds: [] };
  const substitution = lookup.substitution(paintId);
  if (!substitution) return { paintIds: [paintId], cycle: false, substitutionIds: [] };
  const ingredients = lookup.ingredients(substitution.id);
  if (!ingredients.length) return { paintIds: [paintId], cycle: false, substitutionIds: [] };
  const resolved = ingredients.map((ingredient) =>
    resolveChoice(lookup, ingredient.paintId, [...trail, paintId]),
  );
  return {
    paintIds: [...new Set(resolved.flatMap((row) => row.paintIds))],
    cycle: resolved.some((row) => row.cycle),
    substitutionIds: [substitution.id, ...resolved.flatMap((row) => row.substitutionIds)],
  };
}

export function resolvePaintChoice(
  data: SubstitutionData,
  miniatureId: string,
  paintId: string,
  trail: string[] = [],
): PaintChoice {
  return resolveChoice(
    {
      substitution: (id) => selectedSubstitution(data, miniatureId, id),
      ingredients: (id) =>
        data.paintSubstitutionIngredients
          .filter((row) => row.substitutionId === id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
    },
    paintId,
    trail,
  );
}

// Build once per immutable snapshot when resolving a collection. The global default is
// authoritative, so resolutions are independent of miniature ID. Returned choices are shared;
// callers must treat them as immutable. Only cache complete roots, never trail-dependent branches.
export function createPaintChoiceResolver(data: SubstitutionData) {
  const defaults = new Map<string, PaintSubstitution>();
  for (const row of data.paintSubstitutions)
    if (row.isDefault && !defaults.has(row.targetPaintId)) defaults.set(row.targetPaintId, row);
  const ingredients = new Map<string, PaintSubstitutionIngredient[]>();
  for (const row of data.paintSubstitutionIngredients) {
    const group = ingredients.get(row.substitutionId);
    if (group) group.push(row);
    else ingredients.set(row.substitutionId, [row]);
  }
  for (const group of ingredients.values()) group.sort((a, b) => a.sortOrder - b.sortOrder);
  const lookup: ChoiceLookup = {
    substitution: (id) => defaults.get(id) ?? null,
    ingredients: (id) => ingredients.get(id) ?? [],
  };
  const resolved = new Map<string, PaintChoice>();
  return (paintId: string) => {
    let choice = resolved.get(paintId);
    if (!choice) {
      choice = resolveChoice(lookup, paintId, []);
      resolved.set(paintId, choice);
    }
    return choice;
  };
}

export function isPaintAvailable(
  data: SubstitutionData,
  records: Record<string, { state: PaintState; stockLevel: StockLevel; quantity: number } | undefined>,
  paintId: string,
) {
  const substitution = defaultSubstitution(data, paintId);
  if (!substitution) {
    const record = records[paintId];
    return isPaintOwned(record?.state ?? null, record?.stockLevel ?? null, record?.quantity ?? 0);
  }
  if (!data.paintSubstitutionIngredients.some((row) => row.substitutionId === substitution.id)) return false;
  const resolved = resolvePaintChoice(data, "", paintId);
  return (
    !resolved.cycle &&
    resolved.paintIds.length > 0 &&
    resolved.paintIds.every((id) => {
      const record = records[id];
      return isPaintOwned(record?.state ?? null, record?.stockLevel ?? null, record?.quantity ?? 0);
    })
  );
}
