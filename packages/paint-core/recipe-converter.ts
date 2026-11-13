import { rankPaintsByColor, type RankedPaint } from "./paint-color-similarity.ts";

export type ConvertiblePaint = {
  id: string;
  name: string;
  brand: string;
  range: string;
  colorHex: string | null;
};

export type OwnedPaintMatch<T> = RankedPaint<T> & { sameType: boolean };

export function paintType(range: string): string {
  const value = range.toLowerCase();
  if (/\b(spray|primer)\b/.test(value)) return "Primer or spray";
  if (/\b(shade|wash)\b/.test(value)) return "Shade or wash";
  if (/\b(contrast|speedpaint|xpress|instant color|tone pro)\b/.test(value)) return "Transparent color";
  if (/\b(metallic|metal colour|metal color)\b/.test(value)) return "Metallic";
  if (/\b(technical|effect|texture|pigment)\b/.test(value)) return "Effect or texture";
  if (/\bair\b/.test(value)) return "Airbrush";
  return "Standard color";
}

export function rankOwnedPaintMatches<T extends ConvertiblePaint>(
  target: T,
  ownedPaints: T[],
): OwnedPaintMatch<T>[] {
  const ranked = rankPaintsByColor(target, ownedPaints) ?? [];
  const targetType = paintType(target.range);
  return ranked
    .map((entry) => ({ ...entry, sameType: paintType(entry.paint.range) === targetType }))
    .sort(
      (left, right) =>
        Number(right.sameType) - Number(left.sameType) ||
        left.match.distance - right.match.distance ||
        left.paint.id.localeCompare(right.paint.id),
    );
}

export function suggestedOwnedPaint<T extends ConvertiblePaint>(
  matches: OwnedPaintMatch<T>[],
): OwnedPaintMatch<T> | null {
  const first = matches.find((entry) => entry.sameType);
  return first && first.match.score >= 85 ? first : null;
}
