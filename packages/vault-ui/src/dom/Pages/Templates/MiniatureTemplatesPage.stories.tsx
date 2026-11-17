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
    const title = canvas.getByRole("heading", { level: 2 });
    const search = canvas.getByRole("textbox", { name: "Search templates…" });
    const shell = [title, search];
    const bounds = shell.map((element) => element.getBoundingClientRect());
    const skeleton = canvasElement.querySelector('[data-skeleton="templates"]');
    await expect(skeleton).toBeInTheDocument();
    await expect(skeleton?.closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    await expect(await canvas.findByText("180 templates")).toBeInTheDocument();
    await expect(canvasElement.querySelector("[data-skeleton]")).not.toBeInTheDocument();
    for (const [index, element] of shell.entries()) {
      const next = element.getBoundingClientRect();
      await expect(next.top).toBeCloseTo(bounds[index].top, 0);
      await expect(next.left).toBeCloseTo(bounds[index].left, 0);
      await expect(next.width).toBeCloseTo(bounds[index].width, 0);
      await expect(next.height).toBeCloseTo(bounds[index].height, 0);
    }
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    const card = await canvas.findByRole("button", { name: /Knight 000/ });
    await expect(card.getBoundingClientRect().width).toBeGreaterThan(100);
    const grid = card.closest(".MuiCard-root")!.parentElement!.parentElement!;
    await waitFor(() =>
      expect(grid.getBoundingClientRect().height).toBeGreaterThan(card.getBoundingClientRect().height * 2),
    );
  },
};

export const BulkSelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("button", { name: /Knight 000/ });
    // Checkboxes only appear in edit mode.
    await expect(canvas.queryByRole("checkbox", { name: "Select Knight 000" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Select items" }));
    await userEvent.click(await canvas.findByRole("checkbox", { name: "Select Knight 000" }));
    await userEvent.click(canvas.getByRole("checkbox", { name: "Select Knight 001" }));
    await userEvent.click(canvas.getByRole("button", { name: "Move to folder" }));
    const dialog = within(await within(document.body).findByRole("dialog"));
    await expect(dialog.getByRole("button", { name: /Cancel/ })).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: /Cancel/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Clear selection" }));
    await expect(canvas.getByRole("checkbox", { name: "Select Knight 000" })).not.toBeChecked();
    // Tapping a card selects it in edit mode; leaving edit mode clears and hides the checkboxes.
    await userEvent.click(canvas.getByRole("button", { name: /Knight 001/ }));
    await expect(canvas.getByRole("checkbox", { name: "Select Knight 001" })).toBeChecked();
    await userEvent.click(canvas.getByRole("button", { name: "Select items" }));
    await expect(canvas.queryByRole("checkbox", { name: "Select Knight 001" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Move to folder" })).not.toBeInTheDocument();
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

export const AddInFlatAndFolderViews: Story = {
  beforeEach: () => {
    localStorage.removeItem("paintwarden.folders.templates.flat");
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const add = await canvas.findByRole("button", { name: "New template" });
    await userEvent.click(add);
    const direct = within(await body.findByRole("dialog", { name: "New template" }));
    await expect(
      direct.queryByRole("group", { name: "What would you like to add?" }),
    ).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    try {
      await userEvent.click(canvas.getByRole("button", { name: "Folder view" }));
      await userEvent.click(add);
      const folder = within(await body.findByRole("dialog", { name: "Create folder" }));
      const group = within(folder.getByRole("group", { name: "What would you like to add?" }));
      await expect(group.getAllByRole("button").map((button) => button.textContent)).toEqual([
        "Folder",
        "Template",
      ]);
      await expect(group.getByRole("button", { name: "Folder" })).toHaveAttribute("aria-pressed", "true");
      await userEvent.click(group.getByRole("button", { name: "Template" }));
      const item = within(await body.findByRole("dialog", { name: "New template" }));
      await expect(item.getByRole("button", { name: "Template" })).toHaveFocus();
      await expect(body.getAllByRole("dialog")).toHaveLength(1);
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    } finally {
      await userEvent.click(canvas.getByRole("button", { name: "Flat view" }));
      localStorage.removeItem("paintwarden.folders.templates.flat");
    }
  },
};
