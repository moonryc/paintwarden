import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { SelectionBar } from "./SelectionBar";

const meta = {
  title: "Components/SelectionBar",
  component: SelectionBar,
  args: { count: 3, onMove: fn(), onDelete: fn(), onClear: fn() },
} satisfies Meta<typeof SelectionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThreeSelected: Story = {
  play: async ({ args, canvasElement }) => {
    const bar = within(within(canvasElement).getByRole("group", { name: "Select items" }));
    await expect(bar.getByText("3 selected")).toBeInTheDocument();
    await userEvent.click(bar.getByRole("button", { name: "Move to folder" }));
    await expect(args.onMove).toHaveBeenCalledOnce();
    await userEvent.click(bar.getByRole("button", { name: "Delete 3" }));
    await expect(args.onDelete).toHaveBeenCalledOnce();
    await userEvent.click(bar.getByRole("button", { name: "Clear selection" }));
    await expect(args.onClear).toHaveBeenCalledOnce();
  },
};

export const NothingSelected: Story = {
  args: { count: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("group")).not.toBeInTheDocument();
  },
};
