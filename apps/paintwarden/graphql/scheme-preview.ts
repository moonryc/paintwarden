// Card-only limits approved for Phase 4. Authored rows are never truncated in
// the detail/editor connection; repeats retain their position in the preview.
export function schemePreview(names: readonly string[], colors: readonly string[]) {
  const fullNames = names.join(" · ");
  const paintNames = fullNames.length > 512 ? `${fullNames.slice(0, 511)}…` : fullNames;
  let visibleNames = 0;
  let length = 0;
  for (const name of names) {
    length += (visibleNames ? 3 : 0) + name.length;
    if (length > (fullNames.length > 512 ? 511 : 512)) break;
    visibleNames += 1;
  }
  const stops = colors.slice(0, 32);
  const gradient =
    stops.length < 2
      ? (stops[0] ?? "")
      : `linear-gradient(135deg, ${stops.map((color, index) => `${color} ${(index / (stops.length - 1)) * 100}%`).join(", ")})`;
  return {
    paintNames,
    gradient,
    previewMoreCount: Math.max(names.length - visibleNames, colors.length - stops.length),
  };
}
