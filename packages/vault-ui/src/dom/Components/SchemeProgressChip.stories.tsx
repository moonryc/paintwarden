import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { SchemeProgressChip } from "./SchemeProgressChip";

const meta = {
  title: "Components/SchemeProgressChip",
  component: SchemeProgressChip,
  args: { available: 3, total: 5 },
  argTypes: { size: { control: "inline-radio", options: ["sm", "md"] } },
  // Shown over a scheme card's color gradient, where the small chip sits.
  decorators: [
    (Story) => (
      <Box
        sx={{
          position: "relative",
          width: 220,
          height: 120,
          p: 1.5,
          borderRadius: "20px",
          background: "linear-gradient(135deg, #1f1c1d, #9a1115, #c01411)",
        }}
      >
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof SchemeProgressChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PaintsNeeded: Story = {};

export const Ready: Story = { args: { available: 5 } };

export const NoPaints: Story = { args: { available: 0, total: 0 } };

export const Small: Story = { args: { size: "sm" } };
