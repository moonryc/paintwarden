export const COLOR_CATEGORIES = [
  "RED",
  "PINK",
  "ORANGE",
  "YELLOW",
  "GREEN",
  "TURQUOISE",
  "BLUE",
  "PURPLE",
  "BROWN",
  "BLACK",
  "GREY",
  "WHITE",
  "GOLD",
  "SILVER",
  "BONE",
  "FLESH",
] as const;

export type ColorCategory = (typeof COLOR_CATEGORIES)[number];

export const COLOR_CATEGORY_LABELS: Record<ColorCategory, string> = {
  RED: "Red",
  PINK: "Pink",
  ORANGE: "Orange",
  YELLOW: "Yellow",
  GREEN: "Green",
  TURQUOISE: "Turquoise",
  BLUE: "Blue",
  PURPLE: "Purple",
  BROWN: "Brown",
  BLACK: "Black",
  GREY: "Grey",
  WHITE: "White",
  GOLD: "Gold",
  SILVER: "Silver",
  BONE: "Bone",
  FLESH: "Flesh",
};

export function isColorCategory(value: unknown): value is ColorCategory {
  return typeof value === "string" && COLOR_CATEGORIES.includes(value as ColorCategory);
}
