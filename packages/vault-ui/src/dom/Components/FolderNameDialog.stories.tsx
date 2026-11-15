import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { FolderNameDialog } from "./FolderNameDialog";

const meta = {
  title: "Components/FolderNameDialog",
  component: FolderNameDialog,
  args: { title: "Create folder", onSave: fn(async () => {}), onClose: fn() },
} satisfies Meta<typeof FolderNameDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Create folder" }),
    );
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.type(dialog.getByRole("textbox", { name: "Name" }), "  New army ");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect(args.onSave).toHaveBeenCalledWith("New army");
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

export const Rename: Story = {
  args: { title: "Rename", initialName: "Army" },
  play: async ({ canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Rename" }),
    );
    await expect(dialog.getByRole("textbox", { name: "Name" })).toHaveValue("Army");
  },
};

export const SafeError: Story = {
  args: {
    onSave: fn(async () => {
      throw new Error("Unsafe server details");
    }),
  },
  play: async ({ args, canvasElement }) => {
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Create folder" }),
    );
    await userEvent.type(dialog.getByRole("textbox", { name: "Name" }), "Army");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent(
      "The folder operation failed. Please try again.",
    );
    await expect(dialog.getByRole("alert")).not.toHaveTextContent("Unsafe server details");
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};
