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

export const LocalThumbnail: Story = {
  args: {
    template: {
      ...sampleTemplates[0],
      imageUrl: "/api/miniature-templates/story/image?v=photo.webp",
      thumbnailUrl: "/api/miniature-templates/story/image?v=photo.webp&w=320",
    },
  },
  play: async ({ canvas }) => {
    const image = canvas.getByRole("img");
    await expect(image).toHaveAttribute(
      "srcset",
      [160, 320, 640]
        .map((width) => `/api/miniature-templates/story/image?v=photo.webp&w=${width} ${width}w`)
        .join(", "),
    );
    await expect(image).toHaveAttribute("loading", "lazy");
    await expect(image).toHaveAttribute("decoding", "async");
  },
};
