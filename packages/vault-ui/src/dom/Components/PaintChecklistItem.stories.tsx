import Card from "@mui/material/Card";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { column } from "../storybook/decorators";
import { paints } from "../storybook/fixtures";

import { PaintChecklistItem } from "./PaintChecklistItem";
import { PaintRowActions } from "./PaintRowActions";

const meta = {
  title: "Components/PaintChecklistItem",
  component: PaintChecklistItem,
  args: {
    paint: paints.gold,
    subtitle: "Base · 2 projects",
    selectAction: "add to wishlist",
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <Card>
        {/* The same list ProgressSummaryCard puts its checklist in. */}
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 8,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))",
            gap: 4,
          }}
        >
          <Story />
        </ul>
      </Card>
    ),
    column(720),
  ],
} satisfies Meta<typeof PaintChecklistItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Wishlisted: Story = { args: { wishlisted: true, subtitle: "On your wishlist" } };

export const WithActions: Story = {
  args: {
    actions: (
      <PaintRowActions
        wishlist={{ label: `Add ${paints.gold.name} to wishlist`, title: "Add to wishlist", onClick: fn() }}
      />
    ),
  },
};
