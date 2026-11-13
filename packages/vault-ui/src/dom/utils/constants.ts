import { RECIPE_STEPS } from "@paint-vault/core/recipe-steps";

import type { PaintingStatus, RecipeStep, State } from "../types";

export const emptyState: State = {
  miniatures: [],
  catalog: [],
  paintStates: {},
  paintRecords: {},
  requirements: [],
  recipeSteps: [],
  colorSchemes: [],
  colorSchemePaints: [],
  colorSchemeDividers: [],
  colorSchemeImages: [],
  miniatureColorSchemes: [],
  paintSubstitutions: [],
  paintSubstitutionIngredients: [],
  miniaturePaintSubstitutions: [],
};

export const noop = () => {};

export const STEPS: [RecipeStep, string][] = RECIPE_STEPS.map(([id, label]) => [id, label]);

export const STAGES: [PaintingStatus, string][] = [
  ["NOT_STARTED", "Not started"],
  ["ASSEMBLED", "Assembled"],
  ["PRIMED", "Primed"],
  ["IN_PROGRESS", "In progress"],
  ["COMPLETE", "Complete"],
];
