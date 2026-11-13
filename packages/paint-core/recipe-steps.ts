// Steps are listed in painting order; recipes group and sort their paints by this order.
export const RECIPE_STEPS = [
  ["PRIMER", "Primer"],
  ["UNDERCOAT", "Undercoat"],
  ["SPRAY", "Spray"],
  ["BASECOAT", "Basecoat"],
  ["APPLY", "Apply"],
  ["SHADE", "Shade"],
  ["WASH", "Wash"],
  ["LAYER", "Layer"],
  ["DRYBRUSH", "Drybrush"],
  ["GLAZE", "Glaze"],
  ["HIGHLIGHT", "Highlight"],
  ["EDGE_HIGHLIGHT", "Edge highlight"],
  ["DETAIL", "Detail"],
  ["TECHNICAL", "Technical"],
  ["BASING", "Basing"],
  ["VARNISH", "Varnish"],
  ["OTHER", "Other"],
] as const;

export type RecipeStep = (typeof RECIPE_STEPS)[number][0];
export const RECIPE_STEP_VALUES = RECIPE_STEPS.map(([id]) => id) as [RecipeStep, ...RecipeStep[]];
export const RECIPE_STEP_IDS = new Set<string>(RECIPE_STEPS.map(([id]) => id));

export const SCHEME_MILESTONES = [
  "GET READY!",
  "YOU'RE READY!",
  "GET BATTLE READY!",
  "YOU'RE BATTLE READY!",
  "GET PARADE READY!",
  "YOU'RE PARADE READY!",
] as const;
export const SCHEME_MILESTONE_LABELS = new Set<string>(SCHEME_MILESTONES);

export function stepFromDivider(label: string): RecipeStep | null {
  const normalized = label
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return (RECIPE_STEP_IDS.has(normalized) ? normalized : null) as RecipeStep | null;
}
