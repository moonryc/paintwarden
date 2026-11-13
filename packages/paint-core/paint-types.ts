// The kinds of paint a catalog source may assign. Brands name their ranges differently, so sources
// map each paint onto one of these shared types for filtering across brands.
export const PAINT_TYPES = [
  ["PRIMER", "Primer"],
  ["BASE", "Base"],
  ["LAYER", "Layer"],
  ["SHADE", "Shade"],
  ["CONTRAST", "Contrast"],
  ["TECHNICAL", "Technical"],
  ["DRY", "Dry"],
  ["AIR", "Air"],
  ["METALLIC", "Metallic"],
  ["VARNISH", "Varnish"],
  ["INK", "Ink"],
  ["OTHER", "Other"],
] as const;

export type PaintType = (typeof PAINT_TYPES)[number][0];
export const PAINT_TYPE_VALUES = PAINT_TYPES.map(([id]) => id) as [PaintType, ...PaintType[]];
export const PAINT_TYPE_IDS = new Set<string>(PAINT_TYPE_VALUES);
