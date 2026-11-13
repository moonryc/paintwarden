import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { column } from "../storybook/decorators";
import { miniatures, vault } from "../storybook/fixtures";
import type { Paint } from "../types";
import { resolvedPaintIds } from "../utils/vault-data";

import { ProjectRecipe } from "./ProjectRecipe";

const knight = miniatures.knight;
const required = resolvedPaintIds(vault, knight.id)
  .map((id) => vault.catalog.find((paint) => paint.id === id))
  .filter(Boolean) as Paint[];
const requirementRows = vault.requirements
  .filter((row) => row.miniatureId === knight.id)
  .sort((a, b) => a.sortOrder - b.sortOrder);

const meta = {
  title: "Components/ProjectRecipe",
  component: ProjectRecipe,
  args: {
    miniature: knight,
    required,
    requirementRows,
    onOpenPaint: fn(),
    onOpenScheme: fn(),
  },
  // Vault data is too large to edit usefully in the controls panel.
  argTypes: {
    miniature: { control: false },
    required: { control: false },
    requirementRows: { control: false },
  },
  decorators: [column(720)],
} satisfies Meta<typeof ProjectRecipe>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoPaints: Story = {
  args: { miniature: miniatures.dragon, required: [], requirementRows: [] },
};
