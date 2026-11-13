import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

import { column } from "../storybook/decorators";
import { STAGES } from "../utils/constants";

import { StageStepper } from "./StageStepper";

const meta = {
  title: "Components/StageStepper",
  component: StageStepper,
  args: { value: "PRIMED", onChange: fn() },
  argTypes: { value: { control: "select", options: STAGES.map(([stage]) => stage) } },
  decorators: [column(560)],
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <StageStepper
        value={value}
        onChange={(stage) => {
          setValue(stage);
          args.onChange(stage);
        }}
      />
    );
  },
} satisfies Meta<typeof StageStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primed: Story = {};

export const NotStarted: Story = { args: { value: "NOT_STARTED" } };

export const Complete: Story = { args: { value: "COMPLETE" } };
