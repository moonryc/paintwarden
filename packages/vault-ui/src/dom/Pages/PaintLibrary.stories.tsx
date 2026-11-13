import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { paints } from "../storybook/fixtures";
import { LibraryApolloFixture } from "../storybook/library-apollo-fixture";
import { LibraryFixtureProvider } from "../storybook/library-fixtures";
import type { State } from "../types";
import { emptyState } from "../utils/constants";

import { PaintLibrary } from "./PaintLibrary";

const catalog = Array.from({ length: 360 }, (_, index) => ({
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
  decorators: [
    (Story) => (
      <LibraryFixtureProvider>
        <Story />
      </LibraryFixtureProvider>
    ),
  ],
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

// Exercises the actual paged hook, Apollo cache/fragment reads, virtualization, and the
// uncapped tail. The legacy fixture decorator is explicitly disabled by this adapter.
export const ApolloPagingReachesFinalPaint: Story = {
  render: (args) => (
    <LibraryApolloFixture>
      <PaintLibrary {...args} />
    </LibraryApolloFixture>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = () => canvas.getByRole("list", { name: "Paint library" });
    const loaded = () => Number(list().getAttribute("data-loaded-count"));
    try {
      await canvas.findByRole("list", { name: "Paint library" });
      await expect(loaded()).toBe(48);
      while (loaded() < catalog.length) {
        const before = loaded();
        window.scrollTo(0, document.body.scrollHeight);
        await waitFor(() => expect(loaded()).toBeGreaterThan(before));
      }
      window.scrollTo(0, document.body.scrollHeight);
      await waitFor(() => expect(canvas.getByText(catalog.at(-1)!.name)).toBeInTheDocument());
      await expect(list().querySelectorAll("[data-paint-index]").length).toBeLessThan(catalog.length);
      await expect(canvas.queryByRole("button", { name: "Load more paints" })).not.toBeInTheDocument();
      await expect(canvas.getByText("360 matching paints")).toBeInTheDocument();
    } finally {
      window.scrollTo(0, 0);
    }
  },
};

export const ApolloKeyboardCrossesPageBoundary: Story = {
  render: (args) => (
    <LibraryApolloFixture pageDelay={300}>
      <PaintLibrary {...args} />
    </LibraryApolloFixture>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    try {
      const list = await canvas.findByRole("list", { name: "Paint library" });
      await expect(list).toHaveAttribute("data-loaded-count", "48");
      window.scrollTo(0, document.body.scrollHeight);
      const last = await waitFor(() => {
        const row = list.querySelector<HTMLElement>('[data-paint-index="47"]');
        if (!row) throw new Error("Last row of the first page is not rendered");
        return row;
      });
      // Start on a non-text action; the handoff must wait for the next network page,
      // then land on its first button, never its quantity input.
      within(last)
        .getByRole("button", { name: `Set ${catalog[47].name} quantity to 0` })
        .focus();
      await userEvent.tab();
      await waitFor(() =>
        expect((document.activeElement as HTMLElement).closest("[data-paint-index]")).toHaveAttribute(
          "data-paint-index",
          "48",
        ),
      );
      await expect(document.activeElement?.tagName).toBe("BUTTON");
    } finally {
      window.scrollTo(0, 0);
    }
  },
};

export const ApolloDelayedHandoffDoesNotStealFocus: Story = {
  render: (args) => (
    <LibraryApolloFixture pageDelay={300}>
      <PaintLibrary {...args} />
    </LibraryApolloFixture>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    try {
      const list = await canvas.findByRole("list", { name: "Paint library" });
      window.scrollTo(0, document.body.scrollHeight);
      const last = await waitFor(() => {
        const row = list.querySelector<HTMLElement>('[data-paint-index="47"]');
        if (!row) throw new Error("Last row of the first page is not rendered");
        return row;
      });
      within(last)
        .getByRole("button", { name: `Set ${catalog[47].name} quantity to 0` })
        .focus();
      await userEvent.tab();
      const addPaint = canvas.getByRole("button", { name: "Add paint" });
      await userEvent.click(addPaint);
      await waitFor(() => expect(list).toHaveAttribute("data-loaded-count", "96"));
      await expect(addPaint).toHaveFocus();
    } finally {
      window.scrollTo(0, 0);
    }
  },
};
