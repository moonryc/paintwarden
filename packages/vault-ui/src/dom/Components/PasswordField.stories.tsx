import type { Meta, StoryObj } from "@storybook/react-vite";

import { column } from "../storybook/decorators";

import { PasswordField } from "./PasswordField";

const meta = {
  title: "Components/PasswordField",
  component: PasswordField,
  args: { label: "Password", fullWidth: true, autoComplete: "off" },
  decorators: [column(360)],
} satisfies Meta<typeof PasswordField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  args: { error: true, helperText: "Use at least 12 characters." },
};

export const Disabled: Story = { args: { disabled: true } };
