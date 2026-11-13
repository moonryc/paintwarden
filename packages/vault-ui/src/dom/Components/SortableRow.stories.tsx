import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { sortableList } from "../storybook/decorators";
import { paints } from "../storybook/fixtures";

import { PaintBottle } from "./PaintBottle";
import { SortableRow } from "./SortableRow";

const meta = {
  title: "Components/SortableRow",
  component: SortableRow,
  args: {
    id: "row-crimson",
    label: paints.crimson.name,
    children: (
      <>
        <PaintBottle paint={paints.crimson} size="sm" />
        <Box component="span" sx={{ fontSize: 14, fontWeight: 600 }}>
          {paints.crimson.name}
        </Box>
      </>
    ),
  },
  argTypes: { children: { control: false } },
  decorators: [sortableList(["row-crimson"])],
} satisfies Meta<typeof SortableRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Nested: Story = { args: { nested: true } };
