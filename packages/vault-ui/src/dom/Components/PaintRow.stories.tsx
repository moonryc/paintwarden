import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { sortableList } from "../storybook/decorators";
import { miniatures, paints, requirements, schemes, vault } from "../storybook/fixtures";

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

export const BrokenSubstitution: Story = {
  ...Substituted,
  parameters: { vault: { ...vault, paintSubstitutionIngredients: [] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Broken: Teal Mix")).toBeVisible();
    await expect(canvas.getByText("Missing")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: `Add ${paints.royalBlue.name} to wishlist` }),
    ).toBeEnabled();
  },
};

export const BrokenSubstitutionOriginalOwned: Story = {
  ...Substituted,
  parameters: {
    vault: {
      ...vault,
      paintSubstitutionIngredients: [],
      paintRecords: {
        ...vault.paintRecords,
        [paints.royalBlue.id]: { state: "OWNED", stockLevel: "FULL", quantity: 1 },
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Broken: Teal Mix")).toBeVisible();
    await expect(canvas.getByText("Packed")).toBeVisible();
  },
};

// Closing the cycle falls back to Sky Blue, which is on hand; cycle is not an ownership guard.
export const BrokenCycleAvailable: Story = {
  ...Substituted,
  parameters: {
    vault: {
      ...vault,
      paintSubstitutions: [
        ...vault.paintSubstitutions,
        { id: "sky-cycle", targetPaintId: paints.skyBlue.id, name: "Blue cycle", isDefault: true },
      ],
      paintSubstitutionIngredients: [
        { ...vault.paintSubstitutionIngredients[0], parts: 1 },
        { substitutionId: "sky-cycle", paintId: paints.royalBlue.id, parts: 1, sortOrder: 0 },
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Broken: Teal Mix")).toBeVisible();
    await expect(canvas.getByText("Packed")).toBeVisible();
  },
};
