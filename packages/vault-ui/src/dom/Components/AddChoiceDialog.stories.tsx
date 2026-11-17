import { TextField } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { waitForDialogEntered } from "../storybook/dialog";
import { theme } from "../theme";

import { AddChoiceDialog } from "./AddChoiceDialog";
import { FolderNameDialog } from "./FolderNameDialog";
import { Modal } from "./Modal";

const onSave = fn(async () => {});
const onClose = fn();

const meta = {
  title: "Components/AddChoiceDialog",
  component: AddChoiceDialog,
  args: {
    folderView: true,
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

export const SwitchToMiniature: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const folderElement = await body.findByRole("dialog", { name: "Create folder" });
    const folder = within(folderElement);
    const choice = within(folder.getByRole("group", { name: "What would you like to add?" }));
    await expect(choice.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Folder",
      "Miniature",
    ]);
    const folderButton = choice.getByRole("button", { name: "Folder" });
    await expect(folderButton).toHaveAttribute("aria-pressed", "true");
    await expect(folder.getByRole("textbox", { name: "Name" })).not.toHaveFocus();
    // Let the first-open transition finish before comparing the shell and switch geometry.
    await waitForDialogEntered(folderElement);
    const switchTop = folderButton.getBoundingClientRect().top;
    const shell = folderElement.getBoundingClientRect();
    await userEvent.type(folder.getByRole("textbox", { name: "Name" }), "Army");
    await userEvent.click(folder.getByRole("button", { name: "Save" }));
    await expect(onSave).toHaveBeenCalledWith("Army");
    await userEvent.click(choice.getByRole("button", { name: "Miniature" }));
    const itemElement = await body.findByRole("dialog", { name: "Add a miniature" });
    const item = within(itemElement);
    const itemButton = item.getByRole("button", { name: "Miniature" });
    await expect(itemButton).toHaveAttribute("aria-pressed", "true");
    await expect(itemButton).toHaveFocus();
    await expect(body.getAllByRole("dialog")).toHaveLength(1);
    await expect(itemElement.getBoundingClientRect().top).toBeCloseTo(shell.top, 0);
    await expect(itemElement.getBoundingClientRect().height).toBeCloseTo(shell.height, 0);
    await expect(itemButton.getBoundingClientRect().top).toBeCloseTo(switchTop, 0);
    // Text entry is opt-in, and typing must not bounce focus back to the switch.
    await userEvent.type(item.getByRole("textbox", { name: "Title" }), "Scout");
    await expect(item.getByRole("textbox", { name: "Title" })).toHaveFocus();
    await userEvent.click(item.getByRole("button", { name: "Folder" }));
    const returned = within(await body.findByRole("dialog", { name: "Create folder" }));
    await expect(returned.getByRole("button", { name: "Folder" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(returned.getByRole("button", { name: "Miniature" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(await body.findByRole("button", { name: "Miniature" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await expect(onClose).toHaveBeenCalled();
  },
};

export const Template: Story = {
  args: { itemLabel: "Template" },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const folder = within(await body.findByRole("dialog", { name: "Create folder" }));
    await expect(folder.getByRole("button", { name: "Folder" })).toHaveAttribute("aria-pressed", "true");
    await expect(folder.getByRole("group").children[1]).toHaveTextContent("Template");
    await userEvent.click(folder.getByRole("button", { name: "Template" }));
    await expect(await body.findByRole("button", { name: "Template" })).toHaveFocus();
  },
};

export const FlatMiniatures: Story = {
  args: { folderView: false },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const item = within(await body.findByRole("dialog", { name: "Add a miniature" }));
    await expect(item.queryByRole("group", { name: "What would you like to add?" })).not.toBeInTheDocument();
    await expect(item.getByRole("textbox", { name: "Title" })).not.toHaveFocus();
    await expect(body.queryByRole("dialog", { name: "Create folder" })).not.toBeInTheDocument();
  },
};

export const FlatTemplates: Story = {
  args: {
    folderView: false,
    itemLabel: "Template",
    item: (
      <Modal title="New template" subtitle="Start a reusable setup." onClose={onClose}>
        <TextField fullWidth label="Name" />
      </Modal>
    ),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const item = within(await body.findByRole("dialog", { name: "New template" }));
    await expect(item.queryByRole("group", { name: "What would you like to add?" })).not.toBeInTheDocument();
    await expect(item.getByRole("textbox", { name: "Name" })).not.toHaveFocus();
  },
};

const phoneTheme = createTheme({
  ...theme,
  breakpoints: { values: { ...theme.breakpoints.values, sm: 10000 } },
});
export const PhoneSwitch: Story = {
  ...SwitchToMiniature,
  decorators: [
    (Story) => (
      <ThemeProvider theme={phoneTheme}>
        <Story />
      </ThemeProvider>
    ),
  ],
};
