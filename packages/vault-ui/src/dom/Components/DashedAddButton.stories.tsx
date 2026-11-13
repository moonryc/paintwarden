import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { column } from "../storybook/decorators";

import { DashedAddButton } from "./DashedAddButton";

const meta = {
  title: "Components/DashedAddButton",
  component: DashedAddButton,
  args: { label: "Add a step", onClick: fn() },
  decorators: [column(480)],
} satisfies Meta<typeof DashedAddButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Expanded: Story = { args: { label: "Close", expanded: true } };

export const OpensDialog: Story = { args: { label: "Add Scheme", ariaHaspopup: "dialog", minHeight: 116 } };
