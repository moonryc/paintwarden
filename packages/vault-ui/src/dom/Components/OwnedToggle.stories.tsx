import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { paints } from "../storybook/fixtures";

import { OwnedToggle } from "./OwnedToggle";

const meta = {
  title: "Components/OwnedToggle",
  component: OwnedToggle,
  args: { paint: paints.crimson, owned: false, onToggle: fn() },
  argTypes: {
    unownedAction: { control: "inline-radio", options: ["owned", "bought"] },
    unownedIcon: { control: "inline-radio", options: ["check", "plus"] },
  },
} satisfies Meta<typeof OwnedToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotOwned: Story = {};

export const Owned: Story = { args: { owned: true } };

export const PlusIcon: Story = { args: { unownedIcon: "plus", unownedAction: "bought" } };

export const ThroughSubstitution: Story = { args: { owned: true, resolvedBy: "Teal Mix" } };

export const Medium: Story = { args: { size: "md" } };

export const MediumOwned: Story = { args: { size: "md", owned: true } };
