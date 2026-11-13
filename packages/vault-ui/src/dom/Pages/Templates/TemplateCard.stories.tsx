import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { column } from "../../storybook/decorators";
import { sampleTemplates } from "../../storybook/template-api-fixtures";

import { TemplateCard } from "./TemplateCard";

const meta = {
  title: "Templates/Card",
  component: TemplateCard,
  decorators: [column(280)],
  args: { template: sampleTemplates[0], index: 0, onOpen: fn(), onKeyDown: fn() },
} satisfies Meta<typeof TemplateCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Source: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button"));
    await expect(args.onOpen).toHaveBeenCalled();
  },
};
export const User: Story = {
  args: {
    template: {
      ...sampleTemplates[0],
      id: "user:template",
      kind: "user",
      name: "Reusable knight",
      schemeCount: 3,
      paintCount: 8,
      sourceName: undefined,
    },
  },
};
