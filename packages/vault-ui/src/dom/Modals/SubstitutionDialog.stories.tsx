import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { paints } from "../storybook/fixtures";

import { SubstitutionDialog } from "./SubstitutionDialog";

const meta = {
  title: "Dialogs/SubstitutionDialog",
  component: SubstitutionDialog,
  args: { paint: paints.royalBlue, onClose: fn() },
  argTypes: { paint: { control: false } },
  parameters: { docs: { story: { inline: false, iframeHeight: 640 } } },
} satisfies Meta<typeof SubstitutionDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// Royal Blue has a saved mix in the sample vault.
export const WithSavedMix: Story = {};

export const NoMixes: Story = { args: { paint: paints.gold } };
