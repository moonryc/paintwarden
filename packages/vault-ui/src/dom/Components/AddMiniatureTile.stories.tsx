import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { column } from "../storybook/decorators";

import { AddMiniatureTile } from "./AddMiniatureTile";

const meta = {
  title: "Components/AddMiniatureTile",
  component: AddMiniatureTile,
  args: { onClick: fn() },
  decorators: [column(220)],
} satisfies Meta<typeof AddMiniatureTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
