import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";

import { StoryGraphQL } from "../../storybook/graphql";

import { ComplementaryPalette } from "./ComplementaryPalette";
import { PaintToolsPage } from "./PaintToolsPage";

const meta = {
  title: "Paint tools/Layout",
  component: PaintToolsPage,
  parameters: {
    viewport: {
      options: {
        phone390: { name: "Phone 390", styles: { width: "390px", height: "844px" } },
        desktop1440: { name: "Desktop 1440", styles: { width: "1440px", height: "1050px" } },
      },
    },
  },
  globals: { viewport: { value: "phone390", isRotated: false } },
  decorators: [
    (Story) => (
      <StoryGraphQL pending respond={() => ({})}>
        <Story />
      </StoryGraphQL>
    ),
  ],
} satisfies Meta<typeof PaintToolsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Tabs: Story = {
  play: async ({ canvasElement, globals }) => {
    const viewport = globals.viewport as { value: string };
    const phone = viewport.value === "phone390";
    await expect(window.innerWidth).toBe(phone ? 390 : 1440);
    await expect(window.innerHeight).toBe(phone ? 844 : 1050);
    const heading = within(canvasElement).getByRole("heading", { name: "Paint Tools Beta", exact: true });
    await expect(heading.querySelectorAll(".MuiChip-root")).toHaveLength(1);
    const tab = within(canvasElement).getByRole("button", { name: /^Complementary$/ });
    const label = Array.from(tab.childNodes).find((node) => node.textContent === "Complementary")!;
    const text = document.createRange();
    text.selectNodeContents(label);
    // At 390px, the complete word must fit on one line, not Complementar/y.
    await expect(text.getClientRects()).toHaveLength(1);
    await expect(tab.scrollWidth).toBeLessThanOrEqual(tab.clientWidth);
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth);
  },
};

export const Palette: Story = {
  render: () => (
    <ComplementaryPalette
      slots={["Base", "Complement", "Highlight", "Shadow"].map((label, index) => ({
        role: label.toLowerCase(),
        label,
        input: index === 0,
        paint: { name: "A paint with several whole words", hex: "#427ea8" },
      }))}
      canSave
      onSave={fn()}
    />
  ),
  play: async ({ canvasElement, globals }) => {
    const viewport = globals.viewport as { value: string };
    const phone = viewport.value === "phone390";
    await expect(window.innerWidth).toBe(phone ? 390 : 1440);
    await expect(window.innerHeight).toBe(phone ? 844 : 1050);
    const list = within(canvasElement).getByRole("list", { name: "Your palette" });
    const items = within(list).getAllByRole("listitem");
    const columns = getComputedStyle(list).gridTemplateColumns.split(" ");
    await expect(columns).toHaveLength(phone ? 2 : 4);
    for (const [index, label] of ["Base", "Complement", "Highlight", "Shadow"].entries()) {
      const role = within(items[index]).getByText(label, { exact: true });
      await expect(role).toBeVisible();
      const text = document.createRange();
      text.selectNodeContents(role);
      await expect(text.getClientRects()).toHaveLength(1);
    }
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
  },
};

export const DesktopTabs: Story = {
  ...Tabs,
  globals: { viewport: { value: "desktop1440", isRotated: false } },
};
export const DesktopPalette: Story = {
  ...Palette,
  globals: { viewport: { value: "desktop1440", isRotated: false } },
};

export const Loading: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Paint Tools Beta", exact: true })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /^Complementary$/ })).toBeEnabled();
    const field = canvas.getByRole("combobox");
    await expect(field).toBeDisabled();
    await expect(field).toHaveAttribute("placeholder", "Loading…");
    await expect(canvas.queryByRole("progressbar")).toBeNull();
  },
};
