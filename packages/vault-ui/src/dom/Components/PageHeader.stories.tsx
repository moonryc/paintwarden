import Button from "@mui/material/Button";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Plus } from "../icons";

import { PageHeader } from "./PageHeader";

const meta = {
  title: "Components/PageHeader",
  component: PageHeader,
  args: { eyebrow: "Collection", title: "Miniatures" },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBodyAndAction: Story = {
  args: {
    body: "Everything you own or want to paint, with the paints each project still needs.",
    action: (
      <Button variant="contained" startIcon={<Plus size={18} />}>
        Add miniature
      </Button>
    ),
  },
};
