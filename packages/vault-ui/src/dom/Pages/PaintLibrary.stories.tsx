import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor } from "storybook/test";

import { paints } from "../storybook/fixtures";
import type { State } from "../types";
import { emptyState } from "../utils/constants";

import { PaintLibrary } from "./PaintLibrary";

const catalog = Array.from({ length: 120 }, (_, index) => ({
  ...paints.black,
  id: `fixture:paint-${index}`,
  name: `Fixture paint ${String(index).padStart(3, "0")}`,
}));
const vault: State = {
  ...emptyState,
  catalog,
  paintStates: Object.fromEntries(catalog.map((paint) => [paint.id, "OWNED" as const])),
  paintRecords: Object.fromEntries(
    catalog.map((paint) => [paint.id, { state: "OWNED" as const, stockLevel: "FULL" as const, quantity: 1 }]),
  ),
};

const meta = {
  title: "Pages/PaintLibrary",
  component: PaintLibrary,
  args: { onAddPaint: fn() },
  parameters: { vault },
} satisfies Meta<typeof PaintLibrary>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WindowedKeyboardHandoff: Story = {
  play: async ({ canvasElement }) => {
    const rows = () => [...canvasElement.querySelectorAll<HTMLElement>("[data-paint-index]")];
    const activeIndex = () =>
      Number(
        (document.activeElement as HTMLElement).closest<HTMLElement>("[data-paint-index]")?.dataset
          .paintIndex,
      );
    try {
      window.scrollTo(0, 0);
      await waitFor(async () => {
        await expect(rows().length).toBeGreaterThan(1);
        await expect(rows().length).toBeLessThan(catalog.length);
      });
      const last = rows().at(-1)!;
      const next = Number(last.dataset.paintIndex) + 1;
      // Enter quantity naturally with Tab; never programmatically focus a text field.
      last.querySelector<HTMLButtonElement>("button")!.focus();
      await userEvent.tab();
      await expect(document.activeElement).toHaveAttribute(
        "aria-label",
        `${catalog[next - 1].name} quantity`,
      );
      await userEvent.tab();
      await expect(document.activeElement).toHaveAttribute(
        "aria-label",
        `Set ${catalog[next - 1].name} quantity to 0`,
      );
      await userEvent.tab();
      await waitFor(() => expect(activeIndex()).toBe(next));

      const first = rows()[0];
      const previous = Number(first.dataset.paintIndex) - 1;
      await expect(previous).toBeGreaterThanOrEqual(0);
      first.querySelector<HTMLButtonElement>("button")!.focus();
      await userEvent.tab({ shift: true });
      await waitFor(() => expect(activeIndex()).toBe(previous));
    } finally {
      window.scrollTo(0, 0);
    }
  },
};
