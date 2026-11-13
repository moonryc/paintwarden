import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { column } from "../storybook/decorators";
import { miniatures, paints } from "../storybook/fixtures";

import { MiniatureTile } from "./MiniatureTile";

const recipe = [paints.black, paints.crimson, paints.scarlet, paints.gold];

const meta = {
  title: "Components/MiniatureTile",
  component: MiniatureTile,
  args: { mini: miniatures.knight, paints: recipe, total: 4, missing: 2, onClick: fn() },
  decorators: [column(240)],
} satisfies Meta<typeof MiniatureTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PaintsMissing: Story = {};

export const ReadyToPaint: Story = { args: { mini: miniatures.scout, missing: 0 } };

export const NoRecipe: Story = { args: { paints: [], total: 0, missing: 0 } };

export const WishlistLongTitle: Story = { args: { mini: miniatures.dragon, total: 6, missing: 6 } };

export const WithPhoto: Story = {
  args: {
    // An inline image keeps the story offline.
    mini: {
      ...miniatures.knight,
      imageUrl:
        "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5"><rect width="4" height="5" fill="#3a2a2a"/><circle cx="2" cy="1.8" r="1" fill="#9a1115"/><rect x="1" y="2.8" width="2" height="2.2" rx=".4" fill="#b6873d"/></svg>',
        ),
    },
  },
};
