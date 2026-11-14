import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import type { FolderBrowserState } from "../graphql/folder-hooks";

import { FolderBrowser } from "./FolderBrowser";

const army = { id: "army", name: "Army", parentId: null, directCount: 2, recursiveCount: 5 };
const scouts = { id: "scouts", name: "Scouts", parentId: "army", directCount: 3, recursiveCount: 3 };
const browser: FolderBrowserState = {
  folderId: null,
  flat: false,
  setFlat: fn(),
  navigate: fn(),
  folders: [army, scouts],
  visibleFolders: [army],
  ancestors: [],
  currentFolder: null,
  loading: false,
  error: "",
  refresh: fn(),
  create: fn(async () => {}),
  rename: fn(async () => {}),
  move: fn(async () => {}),
  remove: fn(async () => {}),
  moveItems: fn(async () => {}),
};
const meta = {
  title: "Components/FolderBrowser",
  component: FolderBrowser,
  args: { browser, kind: "project", onAddItem: fn() },
} satisfies Meta<typeof FolderBrowser>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = {
  args: { browser: { ...browser, folders: [], visibleFolders: [], loading: true } },
};
export const Retry: Story = {
  args: { browser: { ...browser, error: "Unsafe server details" } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).not.toHaveTextContent("Unsafe server details");
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(args.browser.refresh).toHaveBeenCalled();
  },
};
export const AddMiniature: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Add" }));
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Add" }),
    );
    await userEvent.click(dialog.getByRole("button", { name: "Miniature" }));
    await expect(args.onAddItem).toHaveBeenCalled();
  },
};
export const CreateFolder: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Add" }));
    await userEvent.click(
      within(await body.findByRole("dialog", { name: "Add" })).getByRole("button", {
        name: "Folder",
      }),
    );
    const dialog = within(await body.findByRole("dialog", { name: "Create folder" }));
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.type(dialog.getByRole("textbox", { name: "Name" }), "New army");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect(args.browser.create).toHaveBeenCalledWith("New army");
  },
};
export const DeleteContents: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Actions for Army" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Delete" }));
    const dialog = within(await body.findByRole("dialog", { name: "Delete folder" }));
    await expect(dialog.getByRole("radio", { name: "Move contents to the parent folder" })).toBeChecked();
    await userEvent.click(dialog.getByRole("radio", { name: "Delete folder and all contents" }));
    await userEvent.click(dialog.getByRole("button", { name: "Delete" }));
    await expect(args.browser.remove).toHaveBeenCalledWith("army", "DELETE_CONTENTS");
  },
};
export const SafeCreateError: Story = {
  args: {
    browser: {
      ...browser,
      create: fn(async () => {
        throw new Error("Unsafe server details");
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Add" }));
    await userEvent.click(
      within(await body.findByRole("dialog", { name: "Add" })).getByRole("button", {
        name: "Folder",
      }),
    );
    const dialog = within(await body.findByRole("dialog", { name: "Create folder" }));
    await userEvent.type(dialog.getByRole("textbox", { name: "Name" }), "Army");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent(
      "The folder operation failed. Please try again.",
    );
    await expect(dialog.getByRole("alert")).not.toHaveTextContent("Unsafe server details");
  },
};

export const MoveExcludesDescendants: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Actions for Army" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Move" }));
    const dialog = within(await body.findByRole("dialog", { name: "Move to folder" }));
    await expect(dialog.getByRole("button", { name: "Army" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(dialog.getByRole("button", { name: "Expand Army" }));
    await expect(dialog.getByRole("button", { name: "Scouts" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(dialog.getByRole("button", { name: "Move" }));
    await expect(args.browser.move).toHaveBeenCalledWith("army", null);
  },
};

export const FlatSearchResults: Story = {
  args: { browser: { ...browser, flat: true, visibleFolders: [scouts] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /^Scouts/ })).toBeVisible();
    await expect(canvas.queryByRole("navigation", { name: "Folder navigation" })).not.toBeInTheDocument();
  },
};
