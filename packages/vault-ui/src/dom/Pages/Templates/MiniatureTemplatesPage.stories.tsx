import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

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
const matchingFolder = {
  __typename: "Folder",
  id: "story-dragon-folder",
  name: "Distant dragon folder",
  parentId: null,
  directCount: 1,
  recursiveCount: 1,
  coverThumbnailUrl: null,
};
const meta = {
  title: "Templates/Page",
  component: MiniatureTemplatesPage,
  args: { onUse: fn() },
  decorators: [
    (Story, context) => (
      <StoryGraphQL
        delay={context.parameters.queryDelay ?? 0}
        respond={(operation) => {
          if (operation.operationName === "BrowseFolders")
            return {
              folderBrowser: {
                revision: { epoch: "story", seq: "1" },
                folders: context.parameters.mixedFolder ? [matchingFolder] : [],
                totalCount: context.parameters.mixedFolder ? 1 : 0,
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            };
          if (operation.operationName === "SearchFolderContents") {
            const response = fixtureTemplateResponse(
              vault,
              "TemplateSummaries",
              operation.variables,
              { epoch: "story", seq: "1" },
              templates,
            ) as {
              templates: {
                templates: {
                  nodes: Array<{ imageUrl: string; [key: string]: unknown }>;
                  pageInfo: { endCursor: string | null; hasNextPage: boolean };
                  totalCount: number;
                };
              };
            };
            const results = {
              ...response.templates.templates,
              nodes: response.templates.templates.nodes.map(({ imageUrl, ...node }) => ({
                ...node,
                templateImageUrl: imageUrl,
              })),
            };
            return {
              folderSearch: {
                revision: { epoch: "story", seq: "1" },
                results: context.parameters.mixedFolder
                  ? {
                      ...results,
                      nodes: [matchingFolder, ...results.nodes],
                      totalCount: results.totalCount + 1,
                    }
                  : results,
              },
            };
          }
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
    await userEvent.type(canvas.getByRole("textbox", { name: "Search templates…" }), "Distant dragon");
    await expect(await canvas.findByText("1 result")).toBeInTheDocument();
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
    await expect(await canvas.findByText("1 template")).toBeInTheDocument();
    await expect(await canvas.findByRole("button", { name: /Distant dragon/ })).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: { queryDelay: 750 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("status")).toHaveAttribute("aria-live", "polite");
    const skeletons = canvasElement.querySelectorAll("[data-skeleton]");
    await expect(skeletons).toHaveLength(1);
    await expect(skeletons[0]).toHaveAttribute("data-skeleton", "templates");
    await expect(skeletons[0]).toHaveAttribute("aria-busy", "true");
    await expect(canvas.queryByPlaceholderText("Search templates…")).not.toBeInTheDocument();
    await expect(await canvas.findByText("180 templates")).toBeInTheDocument();
    await expect(canvasElement.querySelector("[data-skeleton]")).not.toBeInTheDocument();
    const card = await canvas.findByRole("button", { name: /Knight 000/ });
    // Initial loading unmounts the grid; it still must measure its first mounted width.
    await expect(card.getBoundingClientRect().width).toBeGreaterThan(100);
    const grid = card.closest(".MuiCard-root")!.parentElement!.parentElement!;
    await waitFor(async () => {
      await expect(grid.getBoundingClientRect().height).toBeGreaterThan(
        card.getBoundingClientRect().height * 2,
      );
    });
  },
};

export const BulkSelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("checkbox", { name: "Select Knight 000" }));
    await userEvent.click(canvas.getByRole("checkbox", { name: "Select Knight 001" }));
    await userEvent.click(canvas.getByRole("button", { name: "Move to folder" }));
    const dialog = within(await within(document.body).findByRole("dialog"));
    await expect(dialog.getByRole("button", { name: /Cancel/ })).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: /Cancel/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Clear selection" }));
    await expect(canvas.getByRole("checkbox", { name: "Select Knight 000" })).not.toBeChecked();
  },
};

export const MixedFolderAndTemplateSearch: Story = {
  parameters: { mixedFolder: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("180 templates")).toBeInTheDocument();
    const search = canvas.getByRole("textbox", { name: "Search templates…" });
    await userEvent.type(search, "Distant dragon");
    await expect(await canvas.findByText("2 results")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /Distant dragon 4 schemes/ })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /Distant dragon folder 1 item/ }));
    await expect(search).toHaveValue("");
  },
};
