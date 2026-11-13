import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";

import { sortableList } from "../storybook/decorators";
import { miniatures, paints, requirements } from "../storybook/fixtures";

import { PaintRowView } from "./PaintRow";

const meta = {
  title: "Components/PaintRow",
  component: PaintRowView,
  args: {
    available: false,
    wished: false,
    activeSubstitution: null,
    onSetPaintState: fn(),
    renderSchemeChip: () => null,
    paint: paints.crimson,
    requirement: requirements.crimson,
    sortableId: requirements.crimson.id,
    miniatureId: miniatures.knight.id,
    onOpenPaint: fn(),
    onRemove: fn(),
    editMode: false,
  },
  decorators: [sortableList([requirements.crimson.id, requirements.royalBlue.id])],
} satisfies Meta<typeof PaintRowView>;

export default meta;
type Story = StoryObj<typeof meta>;

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
