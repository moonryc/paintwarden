// A diagonal CSS background blending paint colors evenly from top left to bottom right. One color
// is returned as is, since a gradient needs at least two stops; no colors give undefined.
export function paintGradient(colors: readonly string[]): string | undefined {
  if (colors.length < 2) return colors[0];
  const stops = colors.map((color, index) => `${color} ${(index / (colors.length - 1)) * 100}%`);
  return `linear-gradient(135deg, ${stops.join(", ")})`;
}
