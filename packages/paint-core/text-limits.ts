// The most characters each kind of text may hold. The API, the database and the catalog source
// format share these limits, so anything the owner creates can be shared as a plugin, and one
// request can't store an unbounded amount of text.
export const TEXT_LIMITS = {
  paintBrand: 120,
  paintRange: 120,
  // Paint, scheme, template and miniature names.
  name: 200,
  paintSourceLabel: 200,
  // A template or miniature's manufacturer, faction or scale.
  detail: 200,
  templateCategory: 120,
  // Notes on a recipe or template step.
  stepNotes: 2000,
  miniatureNotes: 10_000,
  dividerLabel: 80,
  // A scheme image's type or method.
  imageLabel: 40,
  substitutionName: 80,
  url: 2000,
} as const;

export type TextLimit = keyof typeof TEXT_LIMITS;
