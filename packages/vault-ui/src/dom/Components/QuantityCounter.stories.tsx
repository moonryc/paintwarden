import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

import { QuantityCounter } from "./QuantityCounter";

const meta = {
  title: "Components/QuantityCounter",
  component: QuantityCounter,
  args: { name: "Crimson Base", value: 2, onChange: fn() },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <QuantityCounter
        name={args.name}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
    );
  },
} satisfies Meta<typeof QuantityCounter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AtZero: Story = { args: { value: 0 } };

export const AtMaximum: Story = { args: { value: 999 } };
