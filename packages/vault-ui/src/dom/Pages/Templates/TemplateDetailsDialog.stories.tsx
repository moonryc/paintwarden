import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { sampleTemplates } from "../../storybook/template-api-fixtures";

import { TemplateDetailsDialog } from "./TemplateDetailsDialog";

const meta = {
  title: "Templates/Details",
  component: TemplateDetailsDialog,
  args: {
    template: sampleTemplates[0],
    confirmingDelete: false,
    onDelete: fn(),
    onEdit: fn(),
    onUse: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof TemplateDetailsDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Source: Story = {
  play: async ({ args }) => {
    const body = within(document.body);
    await expect(body.getByText("Read-only template")).toBeInTheDocument();
    await expect(body.queryByRole("button", { name: /^Edit$/ })).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "Add miniature" }));
    await expect(args.onUse).toHaveBeenCalled();
  },
};
export const User: Story = {
  args: {
    template: {
      ...sampleTemplates[0],
      id: "user:template",
      kind: "user",
      sourceName: undefined,
      paintCount: 153,
      schemeCount: 18,
    },
  },
  play: async () => {
    const body = within(document.body);
    await expect(body.getByText("18 schemes · 153 paints")).toBeInTheDocument();
    await expect(body.getByRole("button", { name: /^Delete$/ })).toBeInTheDocument();
  },
};
export const ConfirmDelete: Story = {
  args: { template: { ...sampleTemplates[0], id: "user:template", kind: "user" }, confirmingDelete: true },
  play: async ({ args }) => {
    await userEvent.click(within(document.body).getByRole("button", { name: "Confirm delete" }));
    await expect(args.onDelete).toHaveBeenCalled();
  },
};
