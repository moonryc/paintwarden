import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { column } from "../storybook/decorators";

import { FolderTile } from "./FolderTile";

const meta = {
  title: "Components/FolderTile",
  component: FolderTile,
  decorators: [column(240)],
  args: {
    folder: { id: "army", name: "Army", parentId: null, directCount: 2, recursiveCount: 6 },
    onOpen: fn(),
    onRename: fn(),
    onMove: fn(),
    onDelete: fn(),
  },
} satisfies Meta<typeof FolderTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const open = canvas.getByRole("button", { name: /^Army/ });
    open.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onOpen).toHaveBeenCalledWith("army");
    await userEvent.click(canvas.getByRole("button", { name: "Actions for Army" }));
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "Rename" }),
    );
    await expect(args.onRename).toHaveBeenCalledWith("army");
    await expect(args.onOpen).toHaveBeenCalledTimes(1);
  },
};

export const WithCover: Story = {
  args: {
    folder: {
      ...meta.args.folder,
      coverThumbnailUrl:
        "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#b6873d"/></svg>',
        ),
    },
  },
};
