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

export type PaintChoice = {
  paintIds: string[];
  // Broken terminal owners stay in paintIds for requirement diagnostics, NOT ownership fallback.
  unavailablePaintIds: string[];
  // True if traversal reaches a cycle; never sufficient on its own for availability.
  cycle: boolean;
  // True only for this paint's empty or cycle-member recipe, not a broken descendant.
  broken: boolean;
  brokenReason: "empty" | "cycle" | null;
  // Recipes visited, including a blocked broken recipe, for diagnostics.
  substitutionIds: string[];
};
type ChoiceLookup = {
  substitution(paintId: string): PaintSubstitution | null;
  ingredients(substitutionId: string): PaintSubstitutionIngredient[];
};
type ResolvedChoice = Omit<PaintChoice, "broken" | "brokenReason">;

function resolveChoice(
  lookup: ChoiceLookup,
  paintId: string,
  trail: string[],
  substitution = lookup.substitution(paintId),
): ResolvedChoice {
  if (trail.includes(paintId))
    return { paintIds: [paintId], unavailablePaintIds: [paintId], cycle: true, substitutionIds: [] };
  if (!substitution)
    return { paintIds: [paintId], unavailablePaintIds: [], cycle: false, substitutionIds: [] };
  const ingredients = lookup.ingredients(substitution.id);
  const path = [...trail, paintId];
  // Block the whole closing-step owner, not just the offending ingredient.
  // A -> B -> A records B as unavailable from root A (A from root B).
  // Owning that original never makes the active broken recipe available.
  const closesCycle = ingredients.some((row) => row.paintId !== paintId && path.includes(row.paintId));
  if (!ingredients.length || closesCycle)
    return {
      paintIds: [paintId],
      unavailablePaintIds: [paintId],
      cycle: closesCycle,
      substitutionIds: [substitution.id],
    };
  // A direct self ingredient means the physical original, not another application of
  // this recipe. Longer loops still block the closing-step owner.
  const resolved = ingredients.map((ingredient) =>
    ingredient.paintId === paintId
      ? { paintIds: [paintId], unavailablePaintIds: [], cycle: false, substitutionIds: [] }
      : resolveChoice(lookup, ingredient.paintId, path),
  );
  return {
    paintIds: [...new Set(resolved.flatMap((row) => row.paintIds))],
    unavailablePaintIds: [...new Set(resolved.flatMap((row) => row.unavailablePaintIds))],
    cycle: resolved.some((row) => row.cycle),
    substitutionIds: [substitution.id, ...resolved.flatMap((row) => row.substitutionIds)],
  };
}

// Validate the owner separately from resolution: a valid ancestor of a cycle is not
// broken, and all cycle members must be flagged even when resolution cuts an earlier
// cycle short. Also supports a non-default root recipe while following nested defaults.
function isCircularRecipe(lookup: ChoiceLookup, substitution: PaintSubstitution) {
  const pending = lookup
    .ingredients(substitution.id)
    .filter((row) => row.paintId !== substitution.targetPaintId)
    .map((row) => row.paintId);
  const visited = new Set<string>();
  while (pending.length) {
    const paintId = pending.pop()!;
    if (paintId === substitution.targetPaintId) return true;
    if (visited.has(paintId)) continue;
    visited.add(paintId);
    const nested = lookup.substitution(paintId);
    if (nested)
      pending.push(
        ...lookup
          .ingredients(nested.id)
          .filter((row) => row.paintId !== nested.targetPaintId)
          .map((row) => row.paintId),
      );
  }
  return false;
}

function paintChoice(
  lookup: ChoiceLookup,
  paintId: string,
  trail: string[] = [],
  substitution = lookup.substitution(paintId),
): PaintChoice {
  const brokenReason = !substitution
    ? null
    : !lookup.ingredients(substitution.id).length
      ? "empty"
      : isCircularRecipe(lookup, substitution)
        ? "cycle"
        : null;
  return {
    ...resolveChoice(lookup, paintId, trail, substitution),
    broken: brokenReason !== null,
    brokenReason,
  };
}

function choiceLookup(data: SubstitutionData): ChoiceLookup {
  return {
    substitution: (id) => defaultSubstitution(data, id),
    ingredients: (id) =>
      data.paintSubstitutionIngredients
        .filter((row) => row.substitutionId === id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export function resolvePaintChoice(
  data: SubstitutionData,
  _miniatureId: string,
  paintId: string,
  trail: string[] = [],
): PaintChoice {
  return paintChoice(choiceLookup(data), paintId, trail);
}

// Validate/display any saved recipe, including inactive recipes, without changing defaults.
export function resolveSubstitution(data: SubstitutionData, substitutionId: string): PaintChoice | null {
  const substitution = data.paintSubstitutions.find((row) => row.id === substitutionId);
  return substitution ? paintChoice(choiceLookup(data), substitution.targetPaintId, [], substitution) : null;
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
      choice = paintChoice(lookup, paintId);
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
  const resolved = resolvePaintChoice(data, "", paintId);
  return (
    !resolved.unavailablePaintIds.length &&
    resolved.paintIds.every((id) => {
      const record = records[id];
      return isPaintOwned(record?.state ?? null, record?.stockLevel ?? null, record?.quantity ?? 0);
    })
  );
}
