import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { PaintSubstitutionChip } from "./PaintSubstitutionChip";

const meta = {
  title: "Components/PaintSubstitutionChip",
  component: PaintSubstitutionChip,
  args: { name: "Teal Mix" },
} satisfies Meta<typeof PaintSubstitutionChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Broken: Story = {
  args: { broken: true },
  play: async ({ canvas }) => {
    const chip = canvas.getByText("Broken: Teal Mix").closest(".MuiChip-root");
    await expect(chip).toHaveClass("MuiChip-colorError");
    await expect(chip).not.toHaveClass("MuiChip-colorWarning");
  },
};

// The chip truncates long names to leave room for the paint name beside it.
export const LongName: Story = {
  args: { name: "Two parts Sky Blue with one part Toxic Green" },
  decorators: [
    (Story) => (
      <div style={{ display: "flex", width: 260 }}>
        <Story />
      </div>
    ),
  ],
};
