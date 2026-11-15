import { TextField } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AddChoiceDialog } from "./AddChoiceDialog";
import { FolderNameDialog } from "./FolderNameDialog";
import { Modal } from "./Modal";

const onSave = fn(async () => {});
const onClose = fn();

const meta = {
  title: "Components/AddChoiceDialog",
  component: AddChoiceDialog,
  args: {
    itemLabel: "Miniature",
    item: (
      <Modal title="Add a miniature" subtitle="Name it and choose a status." onClose={onClose}>
        <TextField fullWidth label="Title" />
      </Modal>
    ),
    folder: <FolderNameDialog title="Create folder" onSave={onSave} onClose={onClose} />,
  },
} satisfies Meta<typeof AddChoiceDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SwitchToFolder: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const item = within(await body.findByRole("dialog", { name: "Add a miniature" }));
    const choice = within(item.getByRole("group", { name: "What would you like to add?" }));
    await expect(choice.getByRole("button", { name: "Miniature" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(choice.getByRole("button", { name: "Folder" }));
    const folder = within(await body.findByRole("dialog", { name: "Create folder" }));
    await expect(folder.getByRole("button", { name: "Folder" })).toHaveFocus();
    await expect(body.getAllByRole("dialog")).toHaveLength(1);
    await userEvent.type(folder.getByRole("textbox", { name: "Name" }), "Army");
    await userEvent.click(folder.getByRole("button", { name: "Save" }));
    await expect(onSave).toHaveBeenCalledWith("Army");
    await userEvent.click(folder.getByRole("button", { name: "Miniature" }));
    await expect(await body.findByRole("dialog", { name: "Add a miniature" })).toBeInTheDocument();
  },
};

export const Template: Story = {
  args: { itemLabel: "Template" },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole("button", { name: "Template" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};
