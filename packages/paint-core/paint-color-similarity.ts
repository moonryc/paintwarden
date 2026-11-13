export type ColorMatch = {
  score: number;
  distance: number;
  lightnessDelta: number;
  hueDelta: number | null;
  intensityDelta: number;
};

export type RankedPaint<T> = { paint: T; match: ColorMatch };

type Color = { lightness: number; a: number; b: number; intensity: number; hue: number };

function parseColor(hex: string | null | undefined): Color | null {
  const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex?.trim() ?? "");
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  const channels = [0, 2, 4].map((index) => {
    const value = Number.parseInt(digits.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red, green, blue] = channels;
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const intensity = Math.hypot(a, b);
  const hue = (Math.atan2(b, a) * 180) / Math.PI;
  return { lightness, a, b, intensity, hue };
}

function compareColors(base: Color, candidate: Color): ColorMatch {
  const distance = Math.hypot(
    candidate.lightness - base.lightness,
    candidate.a - base.a,
    candidate.b - base.b,
  );
  const hueDelta =
    base.intensity < 0.02 || candidate.intensity < 0.02
      ? null
      : ((candidate.hue - base.hue + 540) % 360) - 180;
  return {
    score: Math.max(0, Math.round(100 * (1 - distance / 0.5))),
    distance,
    lightnessDelta: (candidate.lightness - base.lightness) * 100,
    hueDelta,
    intensityDelta: (candidate.intensity - base.intensity) * 100,
  };
}

export function rankPaintsByColor<
  T extends { id: string; colorHex: string | null; name?: string; brand?: string },
>(selected: T, paints: T[]): RankedPaint<T>[] | null {
  const base = parseColor(selected.colorHex);
  if (!base) return null;
  const selectedName = selected.name?.trim().toLowerCase();
  const selectedBrand = selected.brand?.trim().toLowerCase();
  return paints
    .filter(
      (paint) =>
        paint.id !== selected.id &&
        !(
          selectedName &&
          selectedBrand &&
          paint.name?.trim().toLowerCase() === selectedName &&
          paint.brand?.trim().toLowerCase() === selectedBrand
        ),
    )
    .flatMap((paint) => {
      const color = parseColor(paint.colorHex);
      return color ? [{ paint, match: compareColors(base, color) }] : [];
    })
    .sort(
      (left, right) =>
        left.match.distance - right.match.distance || left.paint.id.localeCompare(right.paint.id),
    );
}
