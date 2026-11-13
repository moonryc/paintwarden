import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";

import { sortableList } from "../storybook/decorators";
import { miniatures, paints, requirements, schemes, vault } from "../storybook/fixtures";

import { PaintRow, PaintRowView } from "./PaintRow";

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
      canvas.queryByRole("button", { name: `Add ${paints.royalBlue.name} to wishlist` }),
    ).not.toBeInTheDocument();
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
    await expect(canvas.getByText("Missing")).toBeVisible();
  },
};

// Circular recipes remain unavailable even with their original paints owned.
export const BrokenCycleOriginalOwned: Story = {
  ...Substituted,
  parameters: {
    vault: {
      ...vault,
      paintRecords: {
        ...vault.paintRecords,
        [paints.royalBlue.id]: { state: "OWNED", stockLevel: "FULL", quantity: 1 },
      },
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
    await expect(canvas.getByText("Missing")).toBeVisible();
  },
};

// An ingredient equal to its recipe owner consumes the physical original, not the recipe again.
export const DirectSelfIngredientPacked: Story = {
  ...Substituted,
  parameters: {
    vault: {
      ...vault,
      paintRecords: {
        ...vault.paintRecords,
        [paints.royalBlue.id]: { state: "OWNED", stockLevel: "FULL", quantity: 1 },
      },
      paintSubstitutionIngredients: [
        {
          substitutionId: vault.paintSubstitutions[0].id,
          paintId: paints.royalBlue.id,
          parts: 1,
          sortOrder: 0,
        },
        {
          substitutionId: vault.paintSubstitutions[0].id,
          paintId: paints.skyBlue.id,
          parts: 1,
          sortOrder: 1,
        },
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Packed")).toBeVisible();
    await expect(canvas.getByText("Teal Mix")).toBeVisible();
    await expect(canvas.queryByText("Broken: Teal Mix")).not.toBeInTheDocument();
  },
};

// Projection data, not a snapshot resolver, controls broken and available status.
export const ProjectedBrokenOriginalOwned: Story = {
  render: (args) => (
    <PaintRowView
      {...args}
      available={false}
      wished={false}
      activeSubstitution={{ name: "Projected broken mix", broken: true }}
      onSetPaintState={fn()}
      renderSchemeChip={() => null}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Broken: Projected broken mix")).toBeVisible();
    await expect(canvas.getByText("Missing")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: `Add ${paints.crimson.name} to wishlist` })).toBeNull();
  },
};

const projectedSetState = fn();
export const ProjectedWishlist: Story = {
  render: (args) => (
    <PaintRowView
      {...args}
      available={false}
      wished={true}
      activeSubstitution={null}
      onSetPaintState={projectedSetState}
      renderSchemeChip={() => null}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Wishlisted")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: `Remove ${paints.crimson.name} from wishlist` }),
    );
    await expect(projectedSetState).toHaveBeenCalledWith(paints.crimson.id, null);
  },
};
