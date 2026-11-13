import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { paints } from "../storybook/fixtures";

import { PaintBottle } from "./PaintBottle";

const meta = {
  title: "Components/PaintBottle",
  component: PaintBottle,
  args: { paint: paints.crimson },
  argTypes: { size: { control: "inline-radio", options: ["xs", "sm", "md"] } },
} satisfies Meta<typeof PaintBottle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {};

export const Small: Story = { args: { size: "sm" } };

export const ExtraSmall: Story = { args: { size: "xs" } };

export const UnknownColor: Story = { args: { paint: paints.unknown } };

export const Palette: Story = {
  render: (args) => (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {Object.values(paints).map((paint) => (
        <PaintBottle key={paint.id} paint={paint} size={args.size} />
      ))}
    </Box>
  ),
};
