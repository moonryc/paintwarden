import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

import { column } from "../storybook/decorators";

import { ColorHexField } from "./ColorHexField";

const meta = {
  title: "Components/ColorHexField",
  component: ColorHexField,
  args: { value: "#9a1115", onChange: fn() },
  decorators: [column(360)],
  // Keeps the typed value so the swatch follows it.
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <ColorHexField
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
    );
  },
} satisfies Meta<typeof ColorHexField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Valid: Story = {};

export const ShortHex: Story = { args: { value: "#4a8" } };

export const Empty: Story = { args: { value: "" } };

export const Invalid: Story = { args: { value: "not a color" } };
