import type { Meta, StoryObj } from "@storybook/react-vite";

import { AppBanner } from "../Components/AppBanner";

import { AppContent } from "./AppContent";

const meta = {
  title: "Layout/AppContent",
  component: AppContent,
  args: { children: <AppBanner>Notices share the responsive page gutters.</AppBanner> },
  parameters: { fullBleed: true },
} satisfies Meta<typeof AppContent>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Page: Story = {};
export const Header: Story = { args: { compact: true } };
