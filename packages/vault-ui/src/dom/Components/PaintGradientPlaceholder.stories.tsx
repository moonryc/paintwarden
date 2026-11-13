import Box from "@mui/material/Box";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";

import { paints } from "../storybook/fixtures";

import { PaintGradientPlaceholder } from "./PaintGradientPlaceholder";

// The placeholder fills its positioned parent, like a miniature tile's image area.
const tile: Decorator = (Story) => (
  <Box
    sx={{
      position: "relative",
      width: 200,
      aspectRatio: "4 / 5",
      overflow: "hidden",
      borderRadius: "20px",
      bgcolor: "var(--sunken)",
    }}
  >
    <Story />
  </Box>
);

const meta = {
  title: "Components/PaintGradientPlaceholder",
  component: PaintGradientPlaceholder,
  args: { paints: [paints.black, paints.crimson, paints.scarlet, paints.gold] },
  decorators: [tile],
} satisfies Meta<typeof PaintGradientPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecipeColors: Story = {};

export const OneColor: Story = { args: { paints: [paints.royalBlue] } };

export const NoColors: Story = { args: { paints: [] } };

export const WithoutIcon: Story = { args: { showIcon: false } };
