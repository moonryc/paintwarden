// Sample vault data for Storybook. Names and colors are invented, not taken from any catalog.
import type { Miniature, Paint, Requirement, State } from "../types";

const SOURCE = "Example paint source";
const MANUFACTURER = "Example Miniatures";
const ROYAL_BLUE_MIX = "user:sub-royal-blue";

function paint(id: string, name: string, colorHex: string | null, range: string, extra: Partial<Paint> = {}) {
  return {
    id: `example:${id}`,
    brand: "Example Paints",
    range,
    name,
    colorHex,
    sourceUrl: null,
    isCustom: false,
    sourceName: SOURCE,
    sourceLogoUrl: null,
    ...extra,
  } satisfies Paint;
}

export const paints = {
  black: paint("abyss-black", "Abyss Black", "#1f1c1d", "Base"),
  crimson: paint("crimson-base", "Crimson Base", "#9a1115", "Base"),
  royalBlue: paint("royal-blue", "Royal Blue", "#0d407f", "Base"),
  gold: paint("antique-gold", "Antique Gold", "#b6873d", "Base"),
  gunmetal: paint("gunmetal", "Gunmetal", "#888d8f", "Base"),
  blackWash: paint("black-wash", "Black Wash", "#14100e", "Wash"),
  brownWash: paint("brown-wash", "Brown Wash", "#5a4630", "Wash"),
  scarlet: paint("scarlet-layer", "Scarlet Layer", "#c01411", "Layer"),
  skyBlue: paint("sky-blue", "Sky Blue", "#2f6bb5", "Layer"),
  boneWhite: paint("bone-white", "Bone White", "#efe7d2", "Layer"),
  toxicGreen: paint("toxic-green", "Toxic Green", "#1e7331", "Layer"),
  unknown: paint("mystery-medium", "Mystery Medium", null, "Technical"),
  tealMix: {
    id: "user:5b8f7e9e-0c55-4c2c-9d55-3a55d2a7a0a1",
    brand: "My mixes",
    range: "Custom",
    name: "Teal Mix",
    colorHex: "#2f8f8a",
    sourceUrl: null,
    isCustom: true,
  } satisfies Paint,
};

export const paintList: Paint[] = Object.values(paints);

const created = Date.UTC(2026, 9, 1);

export const miniatures: Record<"knight" | "scout" | "dragon", Miniature> = {
  knight: {
    id: "user:knight",
    title: "Crimson Knight Captain",
    status: "OWNED",
    notes: "",
    manufacturer: MANUFACTURER,
    faction: "Crimson Order",
    scale: "32mm",
    paintingStatus: "PRIMED",
    imageUrl: null,
    createdAt: created,
  },
  scout: {
    id: "user:scout",
    title: "Forest Scout",
    status: "OWNED",
    notes: "",
    manufacturer: MANUFACTURER,
    faction: "Wardens",
    scale: "28mm",
    paintingStatus: "COMPLETE",
    imageUrl: null,
    createdAt: created,
  },
  dragon: {
    id: "user:dragon",
    title: "Ancient Sky Dragon with a Very Long Name That Wraps",
    status: "WISHLIST",
    notes: "",
    manufacturer: MANUFACTURER,
    faction: "Monsters",
    scale: "Large",
    paintingStatus: "NOT_STARTED",
    imageUrl: null,
    createdAt: created,
  },
};

const owned = { state: "OWNED", stockLevel: "FULL", quantity: 1 } as const;

const requirement = (id: string, paintId: string, step: Requirement["step"], sortOrder: number, notes = "") =>
  ({
    id: `user:req-${id}`,
    miniatureId: miniatures.knight.id,
    paintId,
    step,
    sortOrder,
    notes,
  }) satisfies Requirement;

export const requirements = {
  black: requirement("black", paints.black.id, "BASECOAT", 0),
  crimson: requirement("crimson", paints.crimson.id, "BASECOAT", 1, "Two thin coats over the armour"),
  royalBlue: requirement("royal-blue", paints.royalBlue.id, "BASECOAT", 2),
  scarlet: requirement("scarlet", paints.scarlet.id, "LAYER", 3),
};

export const schemes = {
  crimsonArmour: { id: "user:scheme-crimson", name: "Crimson armour" },
  oceanCloak: { id: "user:scheme-ocean", name: "Ocean cloak" },
  empty: { id: "user:scheme-empty", name: "Blank scheme" },
};

// A small vault: some paints owned, one wishlisted, and a mix standing in for Royal Blue.
export const vault: State = {
  miniatures: Object.values(miniatures),
  catalog: paintList,
  paintStates: {
    [paints.black.id]: "OWNED",
    [paints.crimson.id]: "OWNED",
    [paints.boneWhite.id]: "OWNED",
    [paints.scarlet.id]: "WISHLIST",
  },
  paintRecords: {
    [paints.black.id]: { ...owned, quantity: 2 },
    [paints.crimson.id]: owned,
    [paints.boneWhite.id]: { ...owned, stockLevel: "LOW" },
    [paints.skyBlue.id]: owned,
    [paints.toxicGreen.id]: owned,
    [paints.scarlet.id]: { state: "WISHLIST", stockLevel: "FULL", quantity: 0 },
  },
  requirements: Object.values(requirements),
  recipeSteps: [],
  colorSchemes: Object.values(schemes).map((scheme) => ({
    ...scheme,
    category: null,
    isSystem: false,
    createdAt: created,
    updatedAt: created,
  })),
  colorSchemePaints: [
    { schemeId: schemes.crimsonArmour.id, paintId: paints.black.id, sortOrder: 0 },
    { schemeId: schemes.crimsonArmour.id, paintId: paints.crimson.id, sortOrder: 1 },
    { schemeId: schemes.crimsonArmour.id, paintId: paints.scarlet.id, sortOrder: 2 },
    { schemeId: schemes.oceanCloak.id, paintId: paints.royalBlue.id, sortOrder: 0 },
    { schemeId: schemes.oceanCloak.id, paintId: paints.skyBlue.id, sortOrder: 1 },
    { schemeId: schemes.oceanCloak.id, paintId: paints.boneWhite.id, sortOrder: 2 },
  ],
  colorSchemeDividers: [],
  colorSchemeImages: [],
  miniatureColorSchemes: [
    { miniatureId: miniatures.knight.id, schemeId: schemes.crimsonArmour.id, sortOrder: 0 },
  ],
  paintSubstitutions: [
    { id: ROYAL_BLUE_MIX, targetPaintId: paints.royalBlue.id, name: "Teal Mix", isDefault: true },
  ],
  paintSubstitutionIngredients: [
    { substitutionId: ROYAL_BLUE_MIX, paintId: paints.skyBlue.id, parts: 2, sortOrder: 0 },
    { substitutionId: ROYAL_BLUE_MIX, paintId: paints.toxicGreen.id, parts: 1, sortOrder: 1 },
  ],
  miniaturePaintSubstitutions: [],
};
