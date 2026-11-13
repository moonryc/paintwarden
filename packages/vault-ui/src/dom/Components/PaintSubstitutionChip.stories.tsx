import type { Meta, StoryObj } from "@storybook/react-vite";

import { PaintSubstitutionChip } from "./PaintSubstitutionChip";

const meta = {
  title: "Components/PaintSubstitutionChip",
  component: PaintSubstitutionChip,
  args: { name: "Teal Mix" },
} satisfies Meta<typeof PaintSubstitutionChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

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
