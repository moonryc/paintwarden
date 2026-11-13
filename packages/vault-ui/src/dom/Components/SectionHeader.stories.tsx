import Button from "@mui/material/Button";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { SectionHeader } from "./SectionHeader";

const meta = {
  title: "Components/SectionHeader",
  component: SectionHeader,
  args: { title: "Recent miniatures" },
} satisfies Meta<typeof SectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAction: Story = { args: { action: <Button size="small">View all</Button> } };
