import Button from "@mui/material/Button";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Paintbrush, SearchX } from "../icons";
import { column } from "../storybook/decorators";

import { EmptyState } from "./EmptyState";

const meta = {
  title: "Components/EmptyState",
  component: EmptyState,
  args: {
    icon: <Paintbrush size={26} />,
    title: "No miniatures yet",
    body: "Add a miniature to plan its recipe and see which paints you still need.",
  },
  decorators: [column(640)],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAction: Story = {
  args: { action: <Button variant="contained">Add miniature</Button> },
};

export const NoAction: Story = {
  args: {
    icon: <SearchX size={26} />,
    title: "No paints match",
    body: "Try a different search, or clear the filters.",
  },
};
