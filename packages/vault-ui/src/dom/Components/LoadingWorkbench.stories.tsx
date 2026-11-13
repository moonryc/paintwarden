import type { Meta, StoryObj } from "@storybook/react-vite";

import { LoadingWorkbench } from "./LoadingWorkbench";

const meta = {
  title: "Components/LoadingWorkbench",
  component: LoadingWorkbench,
} satisfies Meta<typeof LoadingWorkbench>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
