import { normalizeColorHex } from "./color-hex.ts";

/** sRGB and linear RGB channels are 0..1; XYZ uses D65 with Y=1 for white. */
export type Rgb = { r: number; g: number; b: number };
export type Xyz = { x: number; y: number; z: number };
/** CIELAB L is 0..100; OKLab L is 0..1. Hue is degrees in [0,360). */
export type Lab = { l: number; a: number; b: number };
export type Lch = { l: number; c: number; h: number };
export type PaintRole = "base" | "complement" | "highlight" | "shadow";

/** Advisory UI threshold, not a guarantee about physical paint or a search cutoff. */
export const NO_CLOSE_MATCH_DELTA_E = 10;
export type MatchCloseness = "exact" | "close" | "similar" | "distant";
/** Advisory buckets for showing CIEDE2000 distance in words; boundaries are inclusive. */
export function matchCloseness(deltaE: number): MatchCloseness {
  if (!Number.isFinite(deltaE) || deltaE < 0) return "distant";
  if (deltaE <= 2) return "exact";
  if (deltaE <= 5) return "close";
  if (deltaE <= NO_CLOSE_MATCH_DELTA_E) return "similar";
  return "distant";
}
const D65 = { x: 0.95047, y: 1, z: 1.08883 };
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;
const radians = (degrees: number) => (degrees * Math.PI) / 180;
const degrees = (angle: number) => (angle * 180) / Math.PI;
const wrapHue = (hue: number) => ((hue % 360) + 360) % 360;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function requireHex(hex: string): string {
  const normalized = normalizeColorHex(hex);
  if (!normalized) throw new RangeError("Expected a three- or six-digit RGB hex color");
  return normalized;
}

export function hexToSrgb(hex: string): Rgb {
  const normalized = requireHex(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16) / 255,
    g: Number.parseInt(normalized.slice(3, 5), 16) / 255,
    b: Number.parseInt(normalized.slice(5, 7), 16) / 255,
  };
}

/** Clips out-of-gamut channels and quantizes only at this final display boundary. */
export function srgbToHex(rgb: Rgb): string {
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((value) =>
      Math.round(clamp(value) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function srgbToLinear(rgb: Rgb): Rgb {
  const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return { r: decode(rgb.r), g: decode(rgb.g), b: decode(rgb.b) };
}

export function linearToSrgb(rgb: Rgb): Rgb {
  const encode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  return { r: encode(rgb.r), g: encode(rgb.g), b: encode(rgb.b) };
}

export function linearToXyz({ r, g, b }: Rgb): Xyz {
  return {
    x: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    y: 0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    z: 0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  };
}

export function xyzToLinear({ x, y, z }: Xyz): Rgb {
  return {
    r: 3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    g: -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    b: 0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  };
}

export function xyzToLab(xyz: Xyz): Lab {
  const f = (v: number) => (v > EPSILON ? Math.cbrt(v) : (KAPPA * v + 16) / 116);
  const x = f(xyz.x / D65.x);
  const y = f(xyz.y / D65.y);
  const z = f(xyz.z / D65.z);
  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

export function labToXyz({ l, a, b }: Lab): Xyz {
  const inverse = (v: number) => (v ** 3 > EPSILON ? v ** 3 : (116 * v - 16) / KAPPA);
  const y = (l + 16) / 116;
  return { x: D65.x * inverse(y + a / 500), y: inverse(y), z: D65.z * inverse(y - b / 200) };
}

export function labToLch({ l, a, b }: Lab): Lch {
  const c = Math.hypot(a, b);
  return { l, c, h: c < 1e-7 ? 0 : wrapHue(degrees(Math.atan2(b, a))) };
}

export function lchToLab({ l, c, h }: Lch): Lab {
  return { l, a: c * Math.cos(radians(h)), b: c * Math.sin(radians(h)) };
}

export function hexToLab(hex: string): Lab {
  return xyzToLab(linearToXyz(srgbToLinear(hexToSrgb(hex))));
}

export function labToHex(lab: Lab): string {
  return srgbToHex(linearToSrgb(xyzToLinear(labToXyz(lab))));
}

export function hexToLch(hex: string): Lch {
  return labToLch(hexToLab(hex));
}

export function lchToHex(lch: Lch): string {
  return labToHex(lchToLab(lch));
}

/** OKLab matrices from Björn Ottosson's published sRGB implementation (2021). */
export function linearToOklab({ r, g, b }: Rgb): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToLinear({ l, a, b }: Lab): Rgb {
  const ll = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * ll - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * ll + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * ll - 0.7034186147 * m + 1.707614701 * s,
  };
}

export function hexToOklch(hex: string): Lch {
  return labToLch(linearToOklab(srgbToLinear(hexToSrgb(hex))));
}

export function oklchToHex(oklch: Lch): string {
  return srgbToHex(linearToSrgb(oklabToLinear(lchToLab(oklch))));
}

/** CIEDE2000, standard parametric factors kL=kC=kH=1; D65 CIELAB inputs.
 * Sharma, Wu & Dalal (2005), https://doi.org/10.1002/col.20070.
 */
export function deltaE2000(first: Lab, second: Lab): number {
  const averageC = (Math.hypot(first.a, first.b) + Math.hypot(second.a, second.b)) / 2;
  const g = 0.5 * (1 - Math.sqrt(averageC ** 7 / (averageC ** 7 + 25 ** 7)));
  const a1 = (1 + g) * first.a;
  const a2 = (1 + g) * second.a;
  const c1 = Math.hypot(a1, first.b);
  const c2 = Math.hypot(a2, second.b);
  const h1 = c1 === 0 ? 0 : wrapHue(degrees(Math.atan2(first.b, a1)));
  const h2 = c2 === 0 ? 0 : wrapHue(degrees(Math.atan2(second.b, a2)));
  const achromatic = c1 * c2 === 0;
  let hueDifference = h2 - h1;
  if (achromatic) hueDifference = 0;
  else if (hueDifference > 180) hueDifference -= 360;
  else if (hueDifference < -180) hueDifference += 360;
  let averageHue = h1 + h2;
  if (!achromatic) {
    if (Math.abs(h1 - h2) <= 180) averageHue /= 2;
    else averageHue = (averageHue + (averageHue < 360 ? 360 : -360)) / 2;
  }
  const dl = second.l - first.l;
  const dc = c2 - c1;
  const dh = 2 * Math.sqrt(c1 * c2) * Math.sin(radians(hueDifference / 2));
  const averageL = (first.l + second.l) / 2;
  const cp = (c1 + c2) / 2;
  const t =
    1 -
    0.17 * Math.cos(radians(averageHue - 30)) +
    0.24 * Math.cos(radians(2 * averageHue)) +
    0.32 * Math.cos(radians(3 * averageHue + 6)) -
    0.2 * Math.cos(radians(4 * averageHue - 63));
  const sl = 1 + (0.015 * (averageL - 50) ** 2) / Math.sqrt(20 + (averageL - 50) ** 2);
  const sc = 1 + 0.045 * cp;
  const sh = 1 + 0.015 * cp * t;
  const rotation =
    -2 *
    Math.sqrt(cp ** 7 / (cp ** 7 + 25 ** 7)) *
    Math.sin(radians(60 * Math.exp(-(((averageHue - 275) / 25) ** 2))));
  return Math.sqrt((dl / sl) ** 2 + (dc / sc) ** 2 + (dh / sh) ** 2 + rotation * (dc / sc) * (dh / sh));
}

export type IndexedPaint = { id: string; hex?: string | null; owned: boolean; available: boolean };
/** Snapshot: rebuild when colors or server-derived availability change. Three doubles + one
 * flag byte per valid paint, plus references. No substitutions or ownership are inferred here.
 */
export type ColorIndex<T extends IndexedPaint> = {
  readonly paints: readonly T[];
  readonly labValues: Float64Array;
  readonly flags: Uint8Array;
};
export type NearestPaintOptions = {
  limit?: number;
  filter?: "library" | "owned" | "available";
  excludeIds?: readonly string[];
};

export function buildColorIndex<T extends IndexedPaint>(paints: readonly T[]): ColorIndex<T> {
  const valid: T[] = [];
  const values: number[] = [];
  const flags: number[] = [];
  for (const paint of paints) {
    const hex = normalizeColorHex(paint.hex);
    if (!hex) continue;
    const lab = hexToLab(hex);
    valid.push(paint);
    values.push(lab.l, lab.a, lab.b);
    flags.push((paint.owned ? 1 : 0) | (paint.available ? 2 : 0));
  }
  return { paints: valid, labValues: new Float64Array(values), flags: new Uint8Array(flags) };
}

function insertNearest<T extends IndexedPaint>(
  result: { paint: T; deltaE: number }[],
  candidate: { paint: T; deltaE: number },
  count: number,
): void {
  let low = 0;
  let high = result.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    const other = result[mid];
    if (
      candidate.deltaE < other.deltaE ||
      (candidate.deltaE === other.deltaE && candidate.paint.id < other.paint.id)
    )
      high = mid;
    else low = mid + 1;
  }
  if (low >= count) return;
  result.splice(low, 0, candidate);
  if (result.length > count) result.pop();
}

/** Exact CIEDE2000 scan with bounded top-N storage, not a full-catalog sort. Equal scores
 * break by ID (lexicographic order, independent of locale), then original catalog order.
 */
export function nearestPaints<T extends IndexedPaint>(
  index: ColorIndex<T>,
  hex: string,
  { limit = 5, filter = "library", excludeIds = [] }: NearestPaintOptions = {},
): { paint: T; deltaE: number }[] {
  const target = hexToLab(hex);
  if (!Number.isFinite(limit) || limit < 0) throw new RangeError("limit must be finite and nonnegative");
  const count = Math.min(Math.floor(limit), index.paints.length);
  const result: { paint: T; deltaE: number }[] = [];
  if (count === 0) return result;
  const excluded = new Set(excludeIds);
  const mask = filter === "owned" ? 1 : filter === "available" ? 2 : 0;
  for (let i = 0; i < index.paints.length; i++) {
    const paint = index.paints[i];
    if ((mask && !(index.flags[i] & mask)) || excluded.has(paint.id)) continue;
    const deltaE = deltaE2000(target, {
      l: index.labValues[3 * i],
      a: index.labValues[3 * i + 1],
      b: index.labValues[3 * i + 2],
    });
    insertNearest(result, { paint, deltaE }, count);
  }
  return result;
}

function inGamut(rgb: Rgb): boolean {
  return [rgb.r, rgb.g, rgb.b].every((value) => value >= -1e-7 && value <= 1 + 1e-7);
}

/** Reduce CIE LCh chroma at fixed lightness/hue before display; do not channel-clip roles. */
function roleToHex(lab: Lab): string {
  const lch = labToLch({ ...lab, l: clamp(lab.l, 0, 100) });
  const rgb = (c: number) => xyzToLinear(labToXyz(lchToLab({ ...lch, c })));
  let low = 0;
  let high = lch.c;
  if (inGamut(rgb(high))) return srgbToHex(linearToSrgb(rgb(high)));
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (inGamut(rgb(mid))) low = mid;
    else high = mid;
  }
  return srgbToHex(linearToSrgb(rgb(low)));
}

/** Monotone hue warp (derivative >= 1 - 6*pi/180), so inverse inference is unique. */
function biasHue(h: number, target: number, amount: number, inverse = false): number {
  if (!inverse) return wrapHue(h + amount * Math.sin(radians(target - h)));
  let estimate = h;
  for (let i = 0; i < 8; i++) {
    const angle = radians(target - estimate);
    estimate -= (estimate + amount * Math.sin(angle) - h) / (1 - radians(amount) * Math.cos(angle));
  }
  return wrapHue(estimate);
}

/** Treat hex as the supplied role and infer base before deriving all roles in D65 CIE LCh.
 * Strength clamps to 0..100 and maps to 8..35 L* units (not zero at 0).
 * Complement rotates hue 180°. Highlight: L+d, C*.88, hue biased toward warm 85°.
 * Shadow: L-d, C*.92, hue biased toward cool 265°. Hue bias is 6*(d/35)*sin(target-h).
 * Achromatic inputs stay achromatic. Inference inverts the hue warp, chroma scale and
 * lightness shift before rendering. Gamut mapping/8-bit rounding lose information,
 * so exact round trips at gamut extremes are impossible. Selected input is preserved.
 * This is a design heuristic, not a pigment mixing or lighting simulation.
 */
export function derivePaintRoles(hex: string, role: PaintRole, strength: number): Record<PaintRole, string> {
  if (!Number.isFinite(strength)) throw new RangeError("strength must be finite");
  const normalized = requireHex(hex);
  const source = labToLch(hexToLab(normalized));
  const d = 8 + 0.27 * clamp(strength, 0, 100);
  const amount = (6 * d) / 35;
  let base = source;
  if (role === "complement") base = { ...source, h: wrapHue(source.h + 180) };
  if (role === "highlight") {
    base = { l: source.l - d, c: source.c / 0.88, h: biasHue(source.h, 85, amount, true) };
  }
  if (role === "shadow") {
    base = { l: source.l + d, c: source.c / 0.92, h: biasHue(source.h, 265, amount, true) };
  }
  const result = {
    base: roleToHex(lchToLab(base)),
    complement: roleToHex(lchToLab({ ...base, h: base.h + 180 })),
    highlight: roleToHex(lchToLab({ l: base.l + d, c: base.c * 0.88, h: biasHue(base.h, 85, amount) })),
    shadow: roleToHex(lchToLab({ l: base.l - d, c: base.c * 0.92, h: biasHue(base.h, 265, amount) })),
  };
  result[role] = normalized;
  return result;
}
