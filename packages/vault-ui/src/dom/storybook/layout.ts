import { expect } from "storybook/test";

/** Shared page regression: inspect actual scrollable width, not only visible boxes. */
export async function expectNoPageOverflow(document: Document) {
  const width = document.documentElement.clientWidth;
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
  await expect(document.body.scrollWidth).toBeLessThanOrEqual(width + 1);
}
