import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { miniatures, paints, vault } from "../storybook/fixtures";
import { MiniatureApolloFixture } from "../storybook/miniature-apollo-fixture";
import { MiniatureFixtureProvider } from "../storybook/miniature-fixtures";
import type { State } from "../types";
import { emptyState } from "../utils/constants";

import { Home } from "./Home";

const meta = {
  title: "Pages/Home",
  component: Home,
  args: { view: "dashboard", onAdd: fn() },
  decorators: [
    (Story) => (
      <MiniatureFixtureProvider>
        <Story />
      </MiniatureFixtureProvider>
    ),
  ],
} satisfies Meta<typeof Home>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Workbench: Story = {};
export const Collection: Story = { args: { view: "miniatures" } };

const syntheticMiniatures = Array.from({ length: 1000 }, (_, index) => ({
  ...miniatures.knight,
  id: `synthetic:${index}`,
  title: `Synthetic Miniature ${String(index).padStart(4, "0")}`,
  createdAt: index,
}));
let miniatureReads = 0;
const largeVault: State = {
  ...vault,
  get miniatures() {
    miniatureReads++;
    return syntheticMiniatures;
  },
  requirements: syntheticMiniatures.map((mini) => ({
    id: `recipe:${mini.id}`,
    miniatureId: mini.id,
    paintId: paints.black.id,
    notes: "",
    sortOrder: 0,
    step: "OTHER",
  })),
  miniatureColorSchemes: [],
};

// The accessor observes real Home derivations without test hooks in production code. Scroll
// must mount the final virtualized tile without rereading/rederiving the project collection.
export const LargeShelfScroll: Story = {
  parameters: { vault: largeVault },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: /Synthetic Miniature 0999/ })).toBeInTheDocument();
    const readsBeforeScroll = miniatureReads;
    try {
      window.scrollTo(0, document.documentElement.scrollHeight);
      window.dispatchEvent(new Event("scroll"));
      await expect(
        await canvas.findByRole("button", { name: /Synthetic Miniature 0000/ }),
      ).toBeInTheDocument();
      await expect(miniatureReads).toBe(readsBeforeScroll);
      const search = canvas.getByRole("textbox", { name: /Search miniatures/ });
      await userEvent.type(search, "Synthetic Miniature 0999");
      await expect(
        await canvas.findByRole("button", { name: /Synthetic Miniature 0999/ }),
      ).toBeInTheDocument();
      await expect(miniatureReads).toBe(readsBeforeScroll);
    } finally {
      window.scrollTo(0, 0);
    }
  },
};

// No legacy collection/catalog is available to these stories. The Apollo link alone
// supplies the list projection, readiness counts, and server-side search results.
const apolloVault: State = {
  ...largeVault,
  miniatures: syntheticMiniatures.slice(0, 120),
};
const apolloParameters = { vault: emptyState };

export const ApolloWorkbench: Story = {
  parameters: apolloParameters,
  render: (args) => (
    <MiniatureApolloFixture data={apolloVault}>
      <Home {...args} />
    </MiniatureApolloFixture>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = await canvas.findByRole("list", { name: "Miniature shelf" });
    await waitFor(() => expect(Number(list.getAttribute("data-loaded-count"))).toBeGreaterThan(0));
    await expect(list).toHaveAttribute("data-total-count", "120");
    await expect(canvas.queryByText(/Your paint library is empty/)).not.toBeInTheDocument();
  },
};

export const ApolloSearchFindsUnloadedMiniature: Story = {
  args: { view: "miniatures" },
  parameters: apolloParameters,
  render: (args) => (
    <MiniatureApolloFixture data={apolloVault}>
      <Home {...args} />
    </MiniatureApolloFixture>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = await canvas.findByRole("list", { name: "Miniature shelf" });
    await waitFor(() => expect(list).toHaveAttribute("data-loaded-count", "48"));
    // Ascending fixture index 0 is the last server result, outside the first page.
    await expect(canvas.queryByRole("button", { name: /Synthetic Miniature 0000/ })).not.toBeInTheDocument();
    await userEvent.type(
      canvas.getByRole("textbox", { name: /Search miniatures/ }),
      "Synthetic Miniature 0000",
    );
    await expect(await canvas.findByRole("button", { name: /Synthetic Miniature 0000/ })).toBeInTheDocument();
  },
};

export const ApolloPagingReachesFinalMiniature: Story = {
  args: { view: "miniatures" },
  parameters: apolloParameters,
  render: (args) => (
    <MiniatureApolloFixture data={apolloVault}>
      <Home {...args} />
    </MiniatureApolloFixture>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = await canvas.findByRole("list", { name: "Miniature shelf" });
    const loaded = () => Number(list.getAttribute("data-loaded-count"));
    try {
      await waitFor(() => expect(loaded()).toBeGreaterThan(0));
      while (loaded() < 120) {
        const before = loaded();
        window.scrollTo(0, document.documentElement.scrollHeight);
        await waitFor(() => expect(loaded()).toBeGreaterThan(before));
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
      const final = await canvas.findByRole("button", { name: /Synthetic Miniature 0000/ });
      final.focus();
      await userEvent.tab({ shift: true });
      await expect(document.activeElement).toHaveAccessibleName(/Synthetic Miniature 0001/);
      await userEvent.tab();
      await expect(final).toHaveFocus();
      await expect(list.querySelectorAll("[data-mini-index]").length).toBeLessThan(120);
      await expect(canvas.queryByRole("button", { name: "Load more miniatures" })).not.toBeInTheDocument();
    } finally {
      window.scrollTo(0, 0);
    }
  },
};

export const ApolloLoading: Story = {
  parameters: apolloParameters,
  render: (args) => (
    <MiniatureApolloFixture data={apolloVault} pageDelay={500}>
      <Home {...args} />
    </MiniatureApolloFixture>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Loading miniatures…")).toBeInTheDocument();
    await expect(await canvas.findByRole("button", { name: /Synthetic Miniature 0119/ })).toBeInTheDocument();
  },
};

export const ApolloErrorRetry: Story = {
  args: { view: "miniatures" },
  parameters: apolloParameters,
  render: (args) => (
    <MiniatureApolloFixture data={apolloVault} failOnce>
      <Home {...args} />
    </MiniatureApolloFixture>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Retry" }));
    await expect(await canvas.findByRole("button", { name: /Synthetic Miniature 0119/ })).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  },
};

export const ApolloKeyboardCrossesPageBoundary: Story = {
  args: { view: "miniatures" },
  parameters: apolloParameters,
  render: (args) => (
    <MiniatureApolloFixture data={apolloVault} pageDelay={300}>
      <Home {...args} />
    </MiniatureApolloFixture>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    try {
      const list = await canvas.findByRole("list", { name: "Miniature shelf" });
      await waitFor(() => expect(list).toHaveAttribute("data-loaded-count", "48"));
      window.scrollTo(0, document.documentElement.scrollHeight);
      const last = await canvas.findByRole("button", { name: /Synthetic Miniature 0072/ });
      last.focus();
      await userEvent.tab();
      await waitFor(() => expect(document.activeElement).toHaveAccessibleName(/Synthetic Miniature 0071/));
      await expect(document.activeElement?.tagName).toBe("BUTTON");
    } finally {
      window.scrollTo(0, 0);
    }
  },
};

export const ApolloPageErrorRetainsRows: Story = {
  args: { view: "miniatures" },
  parameters: apolloParameters,
  render: (args) => (
    <MiniatureApolloFixture data={apolloVault} failOnce failAfter="48">
      <Home {...args} />
    </MiniatureApolloFixture>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    try {
      const list = await canvas.findByRole("list", { name: "Miniature shelf" });
      await waitFor(() => expect(list).toHaveAttribute("data-loaded-count", "48"));
      window.scrollTo(0, document.documentElement.scrollHeight);
      const retry = await canvas.findByRole("button", { name: "Retry" });
      await expect(list).toHaveAttribute("data-loaded-count", "48");
      await expect(
        await canvas.findByRole("button", { name: /Synthetic Miniature 0072/ }),
      ).toBeInTheDocument();
      await userEvent.click(retry);
      await waitFor(() => expect(canvas.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument());
      window.scrollTo(0, document.documentElement.scrollHeight);
      await waitFor(() => expect(Number(list.getAttribute("data-loaded-count"))).toBeGreaterThan(48));
    } finally {
      window.scrollTo(0, 0);
    }
  },
};

export const ApolloDelayedHandoffDoesNotStealFocus: Story = {
  args: { view: "miniatures" },
  parameters: apolloParameters,
  render: (args) => (
    <MiniatureApolloFixture data={apolloVault} pageDelay={500}>
      <Home {...args} />
    </MiniatureApolloFixture>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    try {
      const list = await canvas.findByRole("list", { name: "Miniature shelf" });
      await waitFor(() => expect(list).toHaveAttribute("data-loaded-count", "48"));
      window.scrollTo(0, document.documentElement.scrollHeight);
      const last = await canvas.findByRole("button", { name: /Synthetic Miniature 0072/ });
      last.focus();
      await userEvent.tab();
      const search = canvas.getByRole("textbox", { name: /Search miniatures/ });
      await userEvent.click(search);
      await waitFor(() => expect(Number(list.getAttribute("data-loaded-count"))).toBeGreaterThan(48));
      await expect(search).toHaveFocus();
    } finally {
      window.scrollTo(0, 0);
    }
  },
};

// Deliberately use the asynchronous Apollo path: the shelf is absent during loading,
// but its item count is one (the add tile) both before and after the empty response.
const emptyShelf: Story = {
  parameters: { vault: emptyState },
  render: (args) => (
    <MiniatureApolloFixture data={emptyState} pageDelay={100}>
      <Home {...args} />
    </MiniatureApolloFixture>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const shelf = await canvas.findByRole("list", { name: "Miniature shelf" });
    const add = canvas.getByRole("button", { name: /Add miniature/ });
    await waitFor(() => {
      const width = shelf.clientWidth;
      const columns = width >= 1100 ? 5 : width >= 840 ? 4 : width >= 600 ? 3 : 2;
      const gap = width >= 600 ? 16 : 12;
      const tileWidth = (width - (columns - 1) * gap) / columns;
      expect(add.getBoundingClientRect().width).toBeCloseTo(tileWidth, 0);
      expect(add.getBoundingClientRect().height).toBeCloseTo(tileWidth * 1.25 + 4, 0);
      expect(shelf.getBoundingClientRect().height).toBeCloseTo(tileWidth * 1.25 + 4, 0);
    });
    await expect(shelf).toHaveAttribute("data-loaded-count", "0");
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    await userEvent.click(add);
    await expect(args.onAdd).toHaveBeenCalled();
  },
};

export const EmptyWorkbench: Story = { ...emptyShelf };
export const EmptyMiniatures: Story = { ...emptyShelf, args: { view: "miniatures" } };
