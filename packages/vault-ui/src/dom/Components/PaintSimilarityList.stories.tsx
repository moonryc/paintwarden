import { rankPaintsByColor } from "@paintwarden/core/paint-color-similarity";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { column } from "../storybook/decorators";
import { paintList, paints } from "../storybook/fixtures";
import type { Paint } from "../types";

import { PaintSimilarityList } from "./PaintSimilarityList";

const rank = (paint: Paint) => rankPaintsByColor(paint, paintList) ?? [];

const meta = {
  title: "Components/PaintSimilarityList",
  component: PaintSimilarityList,
  args: { ranked: rank(paints.crimson) },
  argTypes: { ranked: { control: false } },
  decorators: [column(820)],
} satisfies Meta<typeof PaintSimilarityList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ClosestToCrimson: Story = {};

export const ClosestToSkyBlue: Story = { args: { ranked: rank(paints.skyBlue) } };

// Only the visible rows render; scroll to reach the end of a long list.
export const LongList: Story = {
  args: {
    ranked:
      rankPaintsByColor(paints.crimson, [
        ...paintList,
        // 300 generated colors spread across the RGB range.
        ...Array.from({ length: 300 }, (_, index) => ({
          ...paints.crimson,
          id: `example:generated-${index}`,
          name: `Generated paint ${index + 1}`,
          colorHex: `#${((index * 0x0b1d37) % 0xffffff).toString(16).padStart(6, "0")}`,
        })),
      ]) ?? [],
  },
};
