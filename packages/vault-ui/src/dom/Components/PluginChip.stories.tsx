import type { Meta, StoryObj } from "@storybook/react-vite";

import { PluginChip } from "./PluginChip";

const logo =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#d9b72b"/><path d="M5 11 8 4l3 7" stroke="#262626" stroke-width="1.6" fill="none"/></svg>',
  );

const meta = {
  title: "Components/PluginChip",
  component: PluginChip,
  args: { name: "Example paint source" },
} satisfies Meta<typeof PluginChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LetterAvatar: Story = {};

export const WithLogo: Story = { args: { logoUrl: logo } };

export const LongName: Story = {
  args: { name: "A community catalog with an unusually long and descriptive name" },
};

export const Unnamed: Story = { args: { name: undefined } };
