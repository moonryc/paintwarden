import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { list } from "../storybook/decorators";
import { paints } from "../storybook/fixtures";

import { PaintRowLabel } from "./PaintRowLabel";
import { PaintSubstitutionChip } from "./PaintSubstitutionChip";
import { StatusChip } from "./StatusChip";

const meta = {
  title: "Components/PaintRowLabel",
  component: PaintRowLabel,
  args: { paint: paints.crimson, onClick: fn() },
  argTypes: { accessory: { control: false }, status: { control: false } },
  // The label fills a row, so give it one.
  decorators: [
    (Story) => (
      <li style={{ display: "flex" }}>
        <Story />
      </li>
    ),
    list(),
  ],
} satisfies Meta<typeof PaintRowLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {};

export const WithAccessory: Story = {
  args: { accessory: <StatusChip tone="gold">Restock</StatusChip> },
};

export const Substituted: Story = {
  args: { accessory: <PaintSubstitutionChip name="Royal Blue Mix" /> },
};

export const RecipeMissing: Story = {
  args: {
    variant: "recipe",
    notes: "Thin coats over the black undercoat",
    status: <StatusChip tone="muted">Missing</StatusChip>,
  },
};

export const RecipeOwned: Story = {
  args: {
    variant: "recipe",
    owned: true,
    accessory: <PaintSubstitutionChip name="Royal Blue Mix" />,
    status: <StatusChip tone="ok">Packed</StatusChip>,
  },
};

export const RecipeEditMode: Story = { args: { variant: "recipe", editMode: true } };
