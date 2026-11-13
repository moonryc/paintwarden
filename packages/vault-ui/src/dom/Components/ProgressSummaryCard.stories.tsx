import Button from "@mui/material/Button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Heart } from "../icons";
import { column } from "../storybook/decorators";
import { paints } from "../storybook/fixtures";

import { PaintChecklistItem } from "./PaintChecklistItem";
import { ProgressSummaryCard } from "./ProgressSummaryCard";

const missing = [paints.gold, paints.blackWash, paints.boneWhite];

const meta = {
  title: "Components/ProgressSummaryCard",
  component: ProgressSummaryCard,
  args: {
    title: "3 paints to gather",
    subtitle: "5 of 8 on hand",
    progress: 62.5,
    progressLabel: "5 of 8 paints on hand",
    hint: "Select a paint to view details or update your wishlist.",
    action: (
      <Button size="small" variant="contained" startIcon={<Heart size={14} />}>
        Wishlist all
      </Button>
    ),
    children: missing.map((paint) => (
      <PaintChecklistItem
        key={paint.id}
        paint={paint}
        subtitle={paint.range}
        selectAction="open details"
        onSelect={fn()}
      />
    )),
  },
  argTypes: {
    progress: { control: { type: "range", min: 0, max: 100 } },
    action: { control: false },
    children: { control: false },
  },
  decorators: [column(720)],
} satisfies Meta<typeof ProgressSummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { expanded: false }));
    await expect(await within(canvasElement).findByText(paints.gold.name)).toBeVisible();
  },
};

export const Complete: Story = {
  args: { title: "Palette ready — go paint!", subtitle: "8 of 8 on hand", progress: 100, complete: true },
};
