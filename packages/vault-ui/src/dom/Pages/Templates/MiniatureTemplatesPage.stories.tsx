import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { vault } from "../../storybook/fixtures";
import { StoryGraphQL } from "../../storybook/graphql";
import { fixtureTemplateResponse, sampleTemplates } from "../../storybook/template-api-fixtures";

import { MiniatureTemplatesPage } from "./MiniatureTemplatesPage";

const templates = Array.from({ length: 180 }, (_, index) => ({
  ...sampleTemplates[0],
  id: `source:template-${index}`,
  name: index === 179 ? "Distant dragon" : `Knight ${String(index).padStart(3, "0")}`,
  categories: index === 179 ? ["Dragons"] : ["Infantry"],
  paintCount: index,
  schemeCount: 4,
}));
const meta = {
  title: "Templates/Page",
  component: MiniatureTemplatesPage,
  args: { onUse: fn() },
  decorators: [
    (Story) => (
      <StoryGraphQL
        respond={(operation) => {
          if (operation.operationName !== "TemplateSummaries")
            throw new Error("Browsing and summary details must not fetch a recipe");
          return (
            fixtureTemplateResponse(
              vault,
              operation.operationName,
              operation.variables,
              { epoch: "story", seq: "1" },
              templates,
            ) ?? {}
          );
        }}
      >
        <Story />
      </StoryGraphQL>
    ),
  ],
} satisfies Meta<typeof MiniatureTemplatesPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const GlobalSearchAndSummaryOnly: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("180 templates")).toBeInTheDocument();
    await userEvent.type(canvas.getByPlaceholderText("Search templates…"), "Distant dragon");
    await expect(await canvas.findByText("1 templates")).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole("button", { name: /Distant dragon/ }));
    const dialog = within(await within(document.body).findByRole("dialog", { name: "Distant dragon" }));
    await expect(dialog.getByText("4 schemes · 179 paints")).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Add miniature" }));
    await expect(args.onUse).toHaveBeenCalledWith("source:template-179");
  },
};
export const GlobalCategoryFacet: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("180 templates")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("combobox", { name: "Category" }));
    await userEvent.click(within(document.body).getByRole("option", { name: "Dragons" }));
    await expect(await canvas.findByText("1 templates")).toBeInTheDocument();
    await expect(await canvas.findByRole("button", { name: /Distant dragon/ })).toBeInTheDocument();
  },
};
