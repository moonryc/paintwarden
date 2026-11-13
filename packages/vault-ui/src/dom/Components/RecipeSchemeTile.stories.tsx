import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { column } from "../storybook/decorators";
import { schemes } from "../storybook/fixtures";

import { RecipeSchemeTile } from "./RecipeSchemeTile";

const meta = {
  title: "Components/RecipeSchemeTile",
  component: RecipeSchemeTile,
  args: { scheme: schemes.crimsonArmour, editMode: false, onOpen: fn(), onRemove: fn() },
  // A tile is one cell of the recipe's scheme grid.
  decorators: [column(160)],
} satisfies Meta<typeof RecipeSchemeTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EditMode: Story = { args: { editMode: true } };

export const EmptyScheme: Story = { args: { scheme: schemes.empty } };
