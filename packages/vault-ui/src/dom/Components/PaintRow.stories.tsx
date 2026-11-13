import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { sortableList } from "../storybook/decorators";
import { miniatures, paints, requirements, schemes } from "../storybook/fixtures";

import { PaintRow } from "./PaintRow";

const meta = {
  title: "Components/PaintRow",
  component: PaintRow,
  args: {
    paint: paints.crimson,
    requirement: requirements.crimson,
    sortableId: requirements.crimson.id,
    miniatureId: miniatures.knight.id,
    onOpenPaint: fn(),
    onRemove: fn(),
    editMode: false,
  },
  decorators: [sortableList([requirements.crimson.id, requirements.royalBlue.id])],
} satisfies Meta<typeof PaintRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Packed: Story = {};

export const Missing: Story = {
  args: {
    paint: paints.gold,
    requirement: { ...requirements.black, paintId: paints.gold.id },
    sortableId: undefined,
  },
};

export const Wishlisted: Story = {
  args: { paint: paints.scarlet, requirement: requirements.scarlet, sortableId: undefined },
};

export const Substituted: Story = {
  args: {
    paint: paints.royalBlue,
    requirement: requirements.royalBlue,
    sortableId: requirements.royalBlue.id,
  },
};

export const EditMode: Story = { args: { editMode: true, schemeSources: [schemes.crimsonArmour] } };

export const FromScheme: Story = { args: { manual: false, schemeSources: [schemes.crimsonArmour] } };
