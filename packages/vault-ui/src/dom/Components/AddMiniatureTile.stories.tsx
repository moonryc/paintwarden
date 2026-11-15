import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { column } from "../storybook/decorators";

import { AddMiniatureTile } from "./AddMiniatureTile";

const meta = {
  title: "Components/AddMiniatureTile",
  component: AddMiniatureTile,
  args: { onClick: fn() },
  decorators: [column(220)],
} satisfies Meta<typeof AddMiniatureTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const tile = within(canvasElement).getByRole("button", { name: "Add miniature" });
    await expect(tile).toHaveAttribute("aria-haspopup", "dialog");
    await userEvent.click(tile);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const NamedForTemplates: Story = {
  args: { title: "New template" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "New template" })).toBeVisible();
  },
};
