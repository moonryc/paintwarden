import type { Meta, StoryObj } from "@storybook/react-vite";

import { DragHandle } from "./DragHandle";

const meta = {
  title: "Components/DragHandle",
  component: DragHandle,
  args: {
    label: "Reorder Crimson Base",
    title: "Drag to reorder",
    // Outside a sortable list there's nothing to drag, so the handle gets plain button attributes.
    attributes: {
      role: "button",
      tabIndex: 0,
      "aria-disabled": false,
      "aria-pressed": undefined,
      "aria-roledescription": "sortable",
      "aria-describedby": "",
    },
    listeners: undefined,
  },
  argTypes: { attributes: { control: false }, listeners: { control: false } },
} satisfies Meta<typeof DragHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Faint: Story = {
  args: { sx: { width: 28, height: 40, color: "var(--ink-faint)", "&:hover": { color: "var(--ink)" } } },
};
