import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { schemes, vault } from "../storybook/fixtures";
import type { ColorScheme } from "../types";
import { schemeOrderEntries } from "../utils/scheme-order";

import { SchemePreview } from "./SchemePreview";

const scheme = (id: string) => vault.colorSchemes.find((item) => item.id === id) as ColorScheme;

const meta = {
  title: "Components/SchemePreview",
  component: SchemePreview,
  args: {
    active: scheme(schemes.crimsonArmour.id),
    entries: schemeOrderEntries(vault, schemes.crimsonArmour.id),
    onEdit: fn(),
    onClose: fn(),
  },
  // Vault data is too large to edit usefully in the controls panel.
  argTypes: { active: { control: false }, entries: { control: false } },
} satisfies Meta<typeof SchemePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { active: scheme(schemes.empty.id), entries: schemeOrderEntries(vault, schemes.empty.id) },
};
