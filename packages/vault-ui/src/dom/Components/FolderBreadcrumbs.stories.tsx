import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { FolderBreadcrumbs } from "./FolderBreadcrumbs";

const meta = {
  title: "Components/FolderBreadcrumbs",
  component: FolderBreadcrumbs,
  args: {
    kind: "project",
    ancestors: [
      { id: "army", name: "Army" },
      { id: "scouts", name: "Scouts" },
    ],
    onNavigate: fn(),
  },
} satisfies Meta<typeof FolderBreadcrumbs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Nested: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Projects" }));
    await expect(args.onNavigate).toHaveBeenLastCalledWith(null);
    canvas.getByRole("button", { name: "Army" }).focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onNavigate).toHaveBeenLastCalledWith("army");
    await expect(canvas.getByText("Scouts")).toHaveAttribute("aria-current", "page");
  },
};
export const Root: Story = { args: { ancestors: [] } };
export const Templates: Story = { args: { kind: "template" } };
