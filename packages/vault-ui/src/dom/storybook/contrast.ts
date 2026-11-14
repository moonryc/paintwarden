// Assert resolved browser colors, not just palette hex values: MUI state rules can
// override tokens. These targets use opaque text and solid ancestor backgrounds.
export function computedContrast(element: Element): number {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is required to resolve computed CSS colors");
  const rgb = (value: string) => {
    // Let the browser resolve CSS Color 4 values too (for example color-mix in
    // oklab), then read the composited sRGB channels used by the contrast math.
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b, alpha / 255];
  };
  const foreground = rgb(getComputedStyle(element).color);
  if ((foreground[3] ?? 1) !== 1) throw new Error("Expected opaque text");
  let node: Element | null = element;
  let background: number[] | undefined;
  while (node) {
    const color = rgb(getComputedStyle(node).backgroundColor);
    const alpha = color[3] ?? 1;
    if (alpha === 1) {
      background = color;
      break;
    }
    if (alpha !== 0) throw new Error("Expected a solid background, not a translucent layer");
    node = node.parentElement;
  }
  if (!background) throw new Error("No opaque background for contrast check");
  const luminance = (color: number[]) =>
    color.slice(0, 3).reduce((sum, channel, index) => {
      const value = channel / 255;
      return (
        sum +
        (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) *
          [0.2126, 0.7152, 0.0722][index]
      );
    }, 0);
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
