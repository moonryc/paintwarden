import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { paints } from "../storybook/fixtures";

import { PaintBottle } from "./PaintBottle";
import { PaintDetailsButton } from "./PaintDetailsButton";

const meta = {
  title: "Components/PaintDetailsButton",
  component: PaintDetailsButton,
  args: {
    onClick: fn(),
    sx: {
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      borderRadius: 3,
      px: 1.5,
      py: 1,
      textAlign: "left",
    },
    children: (
      <>
        <PaintBottle paint={paints.crimson} />
        <Box component="span">
          <Box component="b" sx={{ display: "block", fontSize: 14 }}>
            {paints.crimson.name}
          </Box>
          <Box component="small" sx={{ color: "var(--ink-faint)" }}>
            {paints.crimson.range}
          </Box>
        </Box>
      </>
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof PaintDetailsButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
