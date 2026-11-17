import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { waitForDialogEntered } from "../storybook/dialog";

import { BulkDeleteDialog } from "./BulkDeleteDialog";

const meta = {
  title: "Components/BulkDeleteDialog",
  component: BulkDeleteDialog,
  args: {
    kind: "MINIATURE",
    items: [
      { id: "scout", name: "Scout" },
      { id: "captain", name: "Captain" },
    ],
    onClose: fn(),
    onDelete: fn(async () => undefined),
  },
} satisfies Meta<typeof BulkDeleteDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Confirm: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const element = await body.findByRole("dialog", { name: "Delete 2 miniatures" });
    await waitForDialogEntered(element);
    const dialog = within(element);
    await expect(dialog.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await expect(dialog.getByText("Scout")).toBeVisible();
    await expect(dialog.getByText("Captain")).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "Delete 2 miniatures" }));
    await expect(args.onDelete).toHaveBeenCalledOnce();
    await waitFor(() => expect(args.onClose).toHaveBeenCalledOnce());
  },
};
export const Cancel: Story = {
  play: async ({ canvasElement, args }) => {
    const element = await within(canvasElement.ownerDocument.body).findByRole("dialog");
    await waitForDialogEntered(element);
    const dialog = within(element);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(args.onClose).toHaveBeenCalledOnce());
    await expect(args.onDelete).not.toHaveBeenCalled();
    await expect(dialog.getByText("Scout")).toBeVisible();
  },
};
export const Templates: Story = { args: { kind: "TEMPLATE" } };
export const LongList: Story = {
  args: {
    items: Array.from({ length: 100 }, (_, index) => ({
      id: String(index),
      name: `Miniature ${index} ${"Long name ".repeat(12)}`,
    })),
  },
};
export const Failure: Story = {
  args: { onDelete: fn(async () => undefined) },
  play: async ({ canvasElement, args }) => {
    const element = await within(canvasElement.ownerDocument.body).findByRole("dialog");
    await waitForDialogEntered(element);
    const dialog = within(element);
    args.onDelete.mockRejectedValueOnce(new Error("Synthetic failure"));
    await userEvent.click(dialog.getByRole("button", { name: "Delete 2 miniatures" }));
    await expect(await dialog.findByRole("alert")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeEnabled();
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};
