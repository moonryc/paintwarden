import { i18n } from "@paintwarden/i18n/runtime";
import { RECIPE_STEPS } from "@paintwarden/core/recipe-steps";

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

// Display labels are resolved at render time; persisted enum values never change.
export const getStages = (): [PaintingStatus, string][] => [
  ["NOT_STARTED", i18n.t("shell:stageNotStarted")],
  ["ASSEMBLED", i18n.t("shell:stageAssembled")],
  ["PRIMED", i18n.t("shell:stagePrimed")],
  ["IN_PROGRESS", i18n.t("shell:stageInProgress")],
  ["COMPLETE", i18n.t("shell:stageComplete")],
];
export const getSteps = (): [RecipeStep, string][] => [
  ["PRIMER", i18n.t("glossary:primer")],
  ["UNDERCOAT", i18n.t("glossary:undercoat")],
  ["SPRAY", i18n.t("shell:stepSpray")],
  ["BASECOAT", i18n.t("glossary:basecoat")],
  ["APPLY", i18n.t("shell:stepApply")],
  ["SHADE", i18n.t("glossary:shade")],
  ["WASH", i18n.t("glossary:wash")],
  ["LAYER", i18n.t("glossary:layer")],
  ["DRYBRUSH", i18n.t("glossary:drybrush")],
  ["GLAZE", i18n.t("glossary:glaze")],
  ["HIGHLIGHT", i18n.t("glossary:highlight")],
  ["EDGE_HIGHLIGHT", i18n.t("glossary:edgeHighlight")],
  ["DETAIL", i18n.t("shell:stepDetail")],
  ["TECHNICAL", i18n.t("shell:stepTechnical")],
  ["BASING", i18n.t("glossary:basing")],
  ["VARNISH", i18n.t("glossary:varnish")],
  ["OTHER", i18n.t("shell:stepOther")],
];
