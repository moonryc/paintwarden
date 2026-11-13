import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { paintList, paints } from "../storybook/fixtures";

import { AddSchemeItemDialog } from "./AddSchemeItemDialog";

const meta = {
  title: "Dialogs/AddSchemeItemDialog",
  component: AddSchemeItemDialog,
  args: {
    kind: "STEP",
    paints: paintList,
    excludedIds: [paints.crimson.id],
    onAddDivider: fn(),
    onAddImage: fn(),
    onAddPaint: fn(),
    onClose: fn(),
  },
  argTypes: { paints: { control: false } },
  parameters: { docs: { story: { inline: false, iframeHeight: 420 } } },
} satisfies Meta<typeof AddSchemeItemDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Step: Story = {};

export const Milestone: Story = { args: { kind: "MILESTONE" } };

export const Image: Story = { args: { kind: "IMAGE" } };

export const Paint: Story = { args: { kind: "PAINT", stepLabel: "BASECOAT" } };
