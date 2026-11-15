import { Box, Button } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { VaultGraphQLProvider } from "../graphql/provider";
import { WishlistFixtureContext } from "../graphql/wishlist-hooks";
import { StoryGraphQL } from "../storybook/graphql";
import { miniatures, paints, requirements, vault } from "../storybook/fixtures";
import { mockApi } from "../storybook/mock-api";
import { useStoryFixture } from "../storybook/story-fixture";
import type { State } from "../types";

import { WishlistPage } from "./WishlistPage";

const catalog = Array.from({ length: 2001 }, (_, index) => ({
  ...paints.gold,
  id: `wishlist-page-${index}`,
  name: `Shopping paint ${String(index + 1).padStart(4, "0")}`,
  brand: index === 2000 ? "Z Final brand" : index < 1000 ? "A First brand" : "B Second brand",
}));
const finalPaint = catalog.at(-1)!;
const finalMini = { ...miniatures.scout, title: "Final project" };
const largeVault: State = {
  ...vault,
  catalog,
  miniatures: [miniatures.knight, finalMini],
  paintStates: Object.fromEntries(catalog.map((paint) => [paint.id, "WISHLIST"])),
  paintRecords: Object.fromEntries(
    catalog.map((paint) => [paint.id, { state: "WISHLIST", stockLevel: "FULL", quantity: 0 }]),
  ),
  requirements: [
    { ...requirements.black, paintId: catalog[0].id },
    { ...requirements.scarlet, miniatureId: finalMini.id, paintId: finalPaint.id },
  ],
  miniatureColorSchemes: [],
  paintSubstitutions: [],
  paintSubstitutionIngredients: [],
  miniaturePaintSubstitutions: [],
};

const meta = {
  title: "Pages/WishlistPage",
  decorators: [
    (Story, context) => {
      const fixture = useStoryFixture();
      return mockApi({}, { data: () => structuredClone(fixture.getSnapshot()) })(Story, context);
    },
    (Story) => (
      <VaultGraphQLProvider>
        <Story />
      </VaultGraphQLProvider>
    ),
  ],
  component: WishlistPage,
  args: { onBrowsePaints: fn() },
  parameters: { vault: largeVault },
} satisfies Meta<typeof WishlistPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LargeGroupedWishlist: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    window.scrollTo(0, 0);
    await expect(await canvas.findByRole("heading", { name: "A First brand 1,000" })).toBeVisible();
    await expect(canvasElement.querySelectorAll("li").length).toBeLessThan(80);
    window.scrollTo(0, document.body.scrollHeight);
    const finalAction = await canvas.findByRole("button", { name: `Mark ${finalPaint.name} as bought` });
    await expect(finalAction).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Z Final brand 1" })).toBeVisible();
    await expect(canvasElement.querySelectorAll("li").length).toBeLessThan(80);
    await userEvent.click(canvas.getByRole("button", { name: new RegExp(`^${finalPaint.name}`) }));
    const dialog = await within(document.body).findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByRole("heading", { name: finalPaint.name })).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).toBeNull());
  },
};

// Publish the updated story inventory after a purchase, without a server or persistent vault.
function PurchaseScenario() {
  const client = useStoryFixture();
  return (
    <>
      <WishlistPage />
      <Button
        onClick={() =>
          client.setState({
            ...client.getSnapshot(),
            paintStates: { ...client.getSnapshot().paintStates, [finalPaint.id]: "OWNED" },
            paintRecords: {
              ...client.getSnapshot().paintRecords,
              [finalPaint.id]: { state: "OWNED", stockLevel: "FULL", quantity: 1 },
            },
          })
        }
      >
        Sync final paint as bought
      </Button>
    </>
  );
}

export const ProjectFilterAndPurchaseRetention: Story = {
  render: () => <PurchaseScenario />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    window.scrollTo(0, 0);
    const picker = await canvas.findByRole("combobox", { name: "Miniature" });
    await userEvent.click(picker);
    await userEvent.type(picker, "Final");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(picker).toHaveValue("Final project");
    await expect(canvas.queryByRole("heading", { level: 3 })).toBeNull();
    await expect(canvas.getByRole("button", { name: `Mark ${finalPaint.name} as bought` })).toBeVisible();
    await expect(canvasElement.querySelectorAll("li")).toHaveLength(1);
    await userEvent.click(canvas.getByRole("button", { name: `Mark ${finalPaint.name} as bought` }));
    await userEvent.click(canvas.getByRole("button", { name: "Sync final paint as bought" }));
    await expect(await canvas.findByRole("textbox", { name: `${finalPaint.name} quantity` })).toHaveValue(
      "1",
    );
    await expect(canvas.getByRole("button", { name: "Share list" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: `Increase ${finalPaint.name} quantity` }));
    await expect(canvas.getByRole("textbox", { name: `${finalPaint.name} quantity` })).toHaveValue("2");
    await userEvent.click(canvas.getByRole("button", { name: "Used in 1 project" }));
    const dialog = await within(document.body).findByRole("dialog", {
      name: `Projects using ${finalPaint.name}`,
    });
    await waitFor(() => expect(within(dialog).getByText(finalMini.title)).toBeVisible());
    await userEvent.keyboard("{Escape}");
  },
};

export const AssociatedProjects: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    window.scrollTo(0, 0);
    const button = await canvas.findByRole("button", { name: "Used in 1 project" });
    await userEvent.click(button);
    const dialog = await within(document.body).findByRole("dialog", {
      name: `Projects using ${catalog[0].name}`,
    });
    await waitFor(() => expect(within(dialog).getByText(miniatures.knight.title)).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).toBeNull());
    await expect(button).toHaveFocus();
  },
};

const issueVault: State = {
  ...largeVault,
  catalog: [...catalog, paints.black, paints.gunmetal],
  paintRecords: {
    ...largeVault.paintRecords,
    [paints.black.id]: { state: "OWNED", stockLevel: "FULL", quantity: 1 },
  },
  requirements: [
    ...largeVault.requirements,
    { ...requirements.black, id: "issue-black", paintId: paints.black.id },
    { ...requirements.black, id: "issue-gunmetal", paintId: paints.gunmetal.id },
  ],
  paintSubstitutions: [
    { id: "empty-black", targetPaintId: paints.black.id, name: "Broken black mix", isDefault: true },
  ],
};

export const GlobalPaintIssues: Story = {
  parameters: { vault: issueVault },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    window.scrollTo(0, 0);
    const picker = await canvas.findByRole("combobox", { name: "Miniature" });
    await userEvent.click(picker);
    await userEvent.type(picker, "Final");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(picker).toHaveValue("Final project");
    await userEvent.click(canvas.getByRole("button", { expanded: false }));
    await expect(
      await canvas.findByRole("button", { name: `Fix substitution for ${paints.black.name}` }),
    ).toBeVisible();
    await expect(canvas.queryByRole("button", { name: `Add ${paints.black.name} to wishlist` })).toBeNull();
    await expect(
      canvas.getByRole("button", { name: `Add ${paints.gunmetal.name} to wishlist` }),
    ).toBeVisible();
    await expect(canvas.getByText("Broken substitution")).toBeVisible();
    await expect(canvas.getByRole("button", { name: `Mark ${finalPaint.name} as bought` })).toBeVisible();
  },
};

export const Empty: Story = {
  parameters: { vault: { ...largeVault, catalog: [], miniatures: [], requirements: [] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Nothing to buy")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Browse paints" })).toBeVisible();
  },
};

const retainedProjects = Array.from({ length: 5 }, (_, index) => ({
  ...miniatures.scout,
  id: `retained-project-${index}`,
  title: `Retained project ${index + 1}`,
}));
export const RetainedPurchaseBeyondProjectPreview: Story = {
  parameters: {
    vault: {
      ...largeVault,
      catalog: [finalPaint],
      miniatures: retainedProjects,
      requirements: retainedProjects.map((mini, index) => ({
        ...requirements.black,
        id: `retained-requirement-${index}`,
        miniatureId: mini.id,
        paintId: finalPaint.id,
      })),
    },
  },
  render: () => <PurchaseScenario />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: `Mark ${finalPaint.name} as bought` }));
    await userEvent.click(canvas.getByRole("button", { name: "Sync final paint as bought" }));
    const picker = await canvas.findByRole("combobox", { name: "Miniature" });
    await userEvent.click(picker);
    await userEvent.type(picker, "Retained project 5");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(picker).toHaveValue("Retained project 5");
    await expect(await canvas.findByRole("textbox", { name: `${finalPaint.name} quantity` })).toHaveValue(
      "1",
    );
    await expect(canvas.getByRole("button", { name: "Share list" })).toBeDisabled();
  },
};

export const Loading: Story = {
  render: (args) => (
    <WishlistFixtureContext.Provider value={null}>
      <StoryGraphQL
        delay={750}
        respond={(operation) => {
          const revision = { epoch: "wishlist-loading-story", seq: "1" };
          const pageInfo = { hasNextPage: false, endCursor: null };
          if (operation.operationName === "WishlistModelOptions")
            return { wishlistModelOptions: { revision, nodes: [], totalCount: 0, pageInfo } };
          if (operation.operationName !== "WishlistPage")
            throw new Error(`Unexpected wishlist loading operation ${operation.operationName}`);
          return {
            wishlist: {
              revision,
              counts: {
                shoppingPaints: 1,
                restockPaints: 0,
                missingPaints: 0,
                missingStock: 0,
                brokenSubstitution: 0,
                listedMissingStock: 0,
                projectCount: 0,
              },
              shopping: {
                nodes: [
                  {
                    __typename: "WishlistRow",
                    id: paints.gold.id,
                    paint: {
                      __typename: "Paint",
                      ...paints.gold,
                      sourceUrl: null,
                      sourceName: null,
                      sourceLogoUrl: null,
                      type: null,
                      discontinued: false,
                      inventory: { state: "WISHLIST", stockLevel: "FULL", quantity: 0 },
                      available: false,
                      activeSubstitution: null,
                      brokenSubstitution: false,
                      brokenReason: null,
                      missingStock: false,
                    },
                    brandGroup: paints.gold.brand,
                    restock: false,
                    missingStock: false,
                    brokenSubstitution: false,
                    projectCount: 0,
                    relatedProjectsPreview: [],
                    relatedProjectsTruncated: false,
                  },
                ],
                totalCount: 1,
                pageInfo,
              },
              missing: { nodes: [], totalCount: 0, pageInfo },
            },
          };
        }}
      >
        <WishlistPage {...args} />
      </StoryGraphQL>
    </WishlistFixtureContext.Provider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole("heading", { level: 2 });
    const search = canvas.getByRole("combobox", { name: "Miniature" });
    const shell = [title, search];
    const bounds = shell.map((element) => element.getBoundingClientRect());
    const skeleton = canvasElement.querySelector('[data-skeleton="wishlist"]');
    await expect(skeleton).toBeInTheDocument();
    await expect(skeleton?.closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    await expect(
      await canvas.findByRole("button", { name: `Mark ${paints.gold.name} as bought` }),
    ).toBeInTheDocument();
    await expect(canvasElement.querySelector("[data-skeleton]")).not.toBeInTheDocument();
    for (const [index, element] of shell.entries()) {
      const next = element.getBoundingClientRect();
      await expect(next.top).toBeCloseTo(bounds[index].top, 0);
      await expect(next.left).toBeCloseTo(bounds[index].left, 0);
      await expect(next.width).toBeCloseTo(bounds[index].width, 0);
      await expect(next.height).toBeCloseTo(bounds[index].height, 0);
    }
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};

const overflowPaints = Array.from({ length: 18 }, (_, index) => ({
  ...paints.gold,
  id: `overflow-wishlist-${index}`,
  name: `Paint ${index} ${"LongUnbrokenColorName".repeat(10)}`,
  brand: `${index % 2 ? "A" : "B"} ${"LongUnbrokenBrandName".repeat(10)}`,
  range: "LongUnbrokenRangeName".repeat(10),
}));
const overflowMissing = { ...overflowPaints[0], id: "overflow-missing" };
const overflowProject = { ...miniatures.knight, title: "LongUnbrokenProjectName".repeat(15) };
const overflowVault: State = {
  ...largeVault,
  catalog: [...overflowPaints, overflowMissing],
  miniatures: [overflowProject],
  paintStates: Object.fromEntries(overflowPaints.map((paint) => [paint.id, "WISHLIST"])),
  paintRecords: Object.fromEntries(
    overflowPaints.map((paint) => [paint.id, { state: "WISHLIST", stockLevel: "FULL", quantity: 0 }]),
  ),
  requirements: [...overflowPaints, overflowMissing].map((paint, index) => ({
    ...requirements.black,
    id: `overflow-requirement-${index}`,
    miniatureId: overflowProject.id,
    paintId: paint.id,
  })),
};

// Regression: groups, paint/range names, expanded project issues and project titles
// must shrink inside the page rather than widening the desktop document.
export const LongNamesGroupedIssuesAndProjectsNoOverflow: Story = {
  parameters: { vault: overflowVault },
  render: (args) => (
    <Box data-overflow-shelf sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      <WishlistPage {...args} />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const shelf = canvasElement.querySelector<HTMLElement>("[data-overflow-shelf]")!;
    window.scrollTo(0, 0);
    await canvas.findByRole("button", { name: `Mark ${overflowPaints[0].name} as bought` });
    await userEvent.click(canvas.getByRole("button", { expanded: false }));
    await canvas.findByRole("button", { name: `Add ${overflowMissing.name} to wishlist` });
    for (const width of [320, 360, 390, 768, 1024, 1280, 1440]) {
      shelf.style.width = `${width}px`;
      await waitFor(async () => {
        await expect(shelf.scrollWidth).toBeLessThanOrEqual(shelf.clientWidth + 1);
        await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      });
    }
    await userEvent.click(canvas.getAllByRole("button", { name: "Used in 1 project" })[0]);
    const dialog = await within(document.body).findByRole("dialog");
    await within(dialog).findByText(overflowProject.title);
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth + 1);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    await userEvent.keyboard("{Escape}");
  },
};
