import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { FolderPicker } from "./FolderPicker";

const meta = {
  title: "Components/FolderPicker",
  component: FolderPicker,
  args: {
    folders: [
      { id: "army", name: "Army", parentId: null, directCount: 0, recursiveCount: 4 },
      { id: "scouts", name: "Scouts", parentId: "army", directCount: 4, recursiveCount: 4 },
      { id: "excluded", name: "Cannot move here", parentId: null, directCount: 0, recursiveCount: 0 },
    ],
    excludedIds: ["excluded"],
    onMove: fn(),
    onClose: fn(),
  },
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
} satisfies Meta<typeof FolderPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ChooseNestedFolder: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Move to folder" }),
    );
    await expect(dialog.getByRole("button", { name: "Cannot move here" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Expand Army" }));
    await userEvent.click(dialog.getByRole("button", { name: "Scouts" }));
    await expect(args.onMove).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole("button", { name: "Move" }));
    await expect(args.onMove).toHaveBeenCalledWith("scouts");
  },
};
export const NoFolder: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Army" }));
    await userEvent.click(dialog.getByRole("button", { name: "No folder" }));
    await userEvent.click(dialog.getByRole("button", { name: "Move" }));
    await expect(args.onMove).toHaveBeenCalledWith(null);
  },
};
export const Cancel: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect(args.onClose).toHaveBeenCalled();
    await expect(args.onMove).not.toHaveBeenCalled();
  },
};

export const FailureKeepsChoice: Story = {
  args: {
    onMove: fn(async () => {
      throw new Error("private database detail");
    }),
  },
  play: async ({ canvasElement }) => {
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Army" }));
    await userEvent.click(dialog.getByRole("button", { name: "Move" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent(
      "The folder operation failed. Please try again.",
    );
    await expect(dialog.queryByText("private database detail")).not.toBeInTheDocument();
    await expect(dialog.getByRole("button", { name: "Army" })).toHaveAttribute("aria-pressed", "true");
  },
};
