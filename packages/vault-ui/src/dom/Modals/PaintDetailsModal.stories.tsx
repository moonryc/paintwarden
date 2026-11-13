import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";

import { paints, vault } from "../storybook/fixtures";

import { PaintDetailsModal } from "./PaintDetailsModal";

const meta = {
  title: "Dialogs/PaintDetailsModal",
  component: PaintDetailsModal,
  args: { paint: paints.royalBlue, onClose: fn(), openMini: fn(), onEdit: fn() },
  parameters: { docs: { story: { inline: false, iframeHeight: 640 } } },
} satisfies Meta<typeof PaintDetailsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BrokenSubstitution: Story = {
  parameters: { vault: { ...vault, paintSubstitutionIngredients: [] } },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(page.getByRole("alert")).toHaveTextContent("Broken substitution: Teal Mix");
    await expect(page.getByRole("button", { name: "Paint substitutions (1)" })).toBeEnabled();
  },
};
