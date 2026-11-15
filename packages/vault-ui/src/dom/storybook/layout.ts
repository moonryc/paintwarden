import { expect } from "storybook/test";

/** Shared page regression: inspect actual scrollable width, not only visible boxes. */
export async function expectNoPageOverflow(document: Document) {
  const width = document.documentElement.clientWidth;
  const offenders = [...document.body.querySelectorAll("*")]
    .filter((element) => {
      const b = element.getBoundingClientRect();
      return b.width > 0 && b.right > width + 1 && !element.closest('[role="listbox"]');
    })
    .slice(-10)
    .map((element) => ({
      tag: element.tagName,
      text: element.textContent?.slice(0, 80),
      right: element.getBoundingClientRect().right,
    }));
  await expect(document.documentElement.scrollWidth, JSON.stringify(offenders)).toBeLessThanOrEqual(
    width + 1,
  );
  await expect(document.body.scrollWidth).toBeLessThanOrEqual(width + 1);
}
