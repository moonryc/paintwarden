import { ApolloLink, Observable } from "@apollo/client";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useLayoutEffect, type ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { PageLoadingStatus } from "../Components/PageLoadingStatus";
import { useVaultGraphQL } from "../graphql/provider";
import { miniatures, paints, vault } from "../storybook/fixtures";
import { MiniatureApolloFixture } from "../storybook/miniature-apollo-fixture";
import { MiniatureFixtureProvider } from "../storybook/miniature-fixtures";
import type { State } from "../types";
import { emptyState } from "../utils/constants";

import { Home } from "./Home";

const meta = {
  title: "Pages/Home",
  component: Home,
  args: { view: "dashboard" },
  decorators: [
    (Story) => (
      <MiniatureFixtureProvider>
        <PageLoadingStatus>
          <Story />
        </PageLoadingStatus>
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
    await expect(
      await canvas.findByRole("button", { name: /^(?!Actions for).*Synthetic Miniature 0999/ }),
    ).toBeInTheDocument();
    const readsBeforeScroll = miniatureReads;
    try {
      window.scrollTo(0, document.documentElement.scrollHeight);
      window.dispatchEvent(new Event("scroll"));
      await expect(
        await canvas.findByRole("button", { name: /^(?!Actions for).*Synthetic Miniature 0000/ }),
      ).toBeInTheDocument();
      await expect(miniatureReads).toBe(readsBeforeScroll);
      const search = canvas.getByRole("textbox", { name: /Search miniatures/ });
      await userEvent.type(search, "Synthetic Miniature 0999");
      await expect(
        await canvas.findByRole("button", { name: /^(?!Actions for).*Synthetic Miniature 0999/ }),
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
    await expect(
      canvas.queryByRole("button", { name: /^(?!Actions for).*Synthetic Miniature 0000/ }),
    ).not.toBeInTheDocument();
    await userEvent.type(
      canvas.getByRole("textbox", { name: /Search miniatures/ }),
      "Synthetic Miniature 0000",
    );
    await expect(
      await canvas.findByRole("button", { name: /^(?!Actions for).*Synthetic Miniature 0000/ }),
    ).toBeInTheDocument();
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
      const final = await canvas.findByRole("button", { name: /^(?!Actions for).*Synthetic Miniature 0000/ });
      final.focus();
      // Each tile is one tab stop; select checkboxes appear only in edit mode.
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

// Hold reads by event rather than timing; this tests the real shell while each data
// section is independently pending, including the summary arriving before the grid.
function HoldInitialMiniatures({ until, children }: { until: Promise<void>; children: ReactNode }) {
  const scope = useVaultGraphQL();
  useLayoutEffect(() => {
    if (!scope) return;
    const original = scope.client.link;
    const gate = new ApolloLink((operation, forward) => {
      if (operation.operationName !== "MiniatureList" || operation.variables.first === 1)
        return forward(operation);
      return new Observable((observer) => {
        let active = true;
        let cancel = () => {};
        void until.then(() => {
          if (!active) return;
          const subscription = forward(operation).subscribe(observer);
          cancel = () => subscription.unsubscribe();
        });
        return () => {
          active = false;
          cancel();
        };
      });
    });
    scope.client.setLink(ApolloLink.from([gate, original]));
    return () => scope.client.setLink(original);
  }, [scope, until]);
  return children;
}

const loadingStory = (folders = false): Story => ({
  parameters: apolloParameters,
  render: (args) => (
    <MiniatureApolloFixture data={apolloVault} pageDelay={500}>
      <Home {...args} />
    </MiniatureApolloFixture>
  ),
  play: async ({ mount, args, canvasElement }) => {
    const page = Promise.withResolvers<void>();
    if (folders) localStorage.setItem(`paintwarden.folders.${args.view}.flat`, "false");
    const canvas = await mount(
      <MiniatureApolloFixture
        data={apolloVault}
        folders={
          folders
            ? [
                {
                  id: "army",
                  name: "Long miniature folder name ".repeat(8),
                  parentId: null,
                  directCount: 120,
                  recursiveCount: 120,
                },
              ]
            : []
        }
      >
        <HoldInitialMiniatures until={page.promise}>
          <Home {...args} />
        </HoldInitialMiniatures>
      </MiniatureApolloFixture>,
    );
    try {
      const heading = canvas.getByRole("heading", {
        name: args.view === "dashboard" ? "Workbench" : "Miniatures",
      });
      const search = canvas.getByRole("textbox", { name: /Search miniatures/ });
      const filter = canvas.getByRole("combobox");
      const add = canvas.getByRole("button", { name: /Add miniature/ });
      const list = canvas.getByRole("list", { name: "Miniature shelf" });
      await expect(canvas.getAllByRole("status")).toHaveLength(1);
      await expect(canvas.getByRole("status")).toHaveAttribute("aria-live", "polite");
      await expect(list).toHaveAttribute("aria-busy", "true");
      await expect(list).toHaveAttribute("data-skeleton", "miniature-grid");
      const shell = [heading, search, filter, add];
      const positions = shell.map((node) => node.getBoundingClientRect().toJSON());
      const firstPlaceholder = list.querySelector<HTMLElement>('[data-mini-index="1"]')!;
      const tileGeometry = firstPlaceholder.getBoundingClientRect().toJSON();
      if (args.view === "dashboard") {
        const summary = canvas.getByRole("region", { name: "Workbench" });
        await waitFor(() => expect(summary).toHaveAttribute("aria-busy", "false"));
        // The summary is ready while the unrelated grid request is still held.
        await expect(summary).toHaveTextContent("120");
        await expect(list).toHaveAttribute("aria-busy", "true");
      }
      await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      page.resolve();
      await waitFor(() => expect(list).toHaveAttribute("aria-busy", "false"));
      await expect(canvasElement.querySelector("[data-skeleton]")).not.toBeInTheDocument();
      shell.forEach((node, index) => {
        expect(node.isConnected).toBe(true);
        const next = node.getBoundingClientRect();
        for (const key of ["x", "y", "width", "height"] as const)
          expect(next[key]).toBeCloseTo(positions[index][key], 0);
      });
      const loadedTile = list.querySelector<HTMLElement>('[data-mini-index="1"]')!.getBoundingClientRect();
      for (const key of ["x", "y", "width", "height"] as const)
        await expect(loadedTile[key]).toBeCloseTo(tileGeometry[key], 0);
      await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    } finally {
      page.resolve();
      if (folders) localStorage.removeItem(`paintwarden.folders.${args.view}.flat`);
    }
  },
});

export const ApolloLoading: Story = loadingStory();
export const ApolloMiniaturesLoading: Story = { ...loadingStory(), args: { view: "miniatures" } };
export const ApolloFolderLoading: Story = { ...loadingStory(true), args: { view: "miniatures" } };

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
    await expect(
      await canvas.findByRole("button", { name: /^(?!Actions for).*Synthetic Miniature 0119/ }),
    ).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  },
};

// Hold pagination requests, not a fixed number of milliseconds: both keyboard stories
// must exercise the pending-focus path even on a slow test runner. The real Apollo
// loader/cache and fixture still handle the request after the play function releases it.
function HoldMiniaturePages({ until, children }: { until: Promise<void>; children: ReactNode }) {
  const scope = useVaultGraphQL();
  useLayoutEffect(() => {
    if (!scope) return;
    const original = scope.client.link;
    const gate = new ApolloLink((operation, forward) => {
      if (operation.operationName !== "MiniatureList" || !operation.variables.after)
        return forward(operation);
      return new Observable((observer) => {
        let active = true;
        let cancel = () => {};
        void until.then(() => {
          if (!active) return;
          const subscription = forward(operation).subscribe(observer);
          cancel = () => subscription.unsubscribe();
        });
        return () => {
          active = false;
          cancel();
        };
      });
    });
    scope.client.setLink(ApolloLink.from([gate, original]));
    return () => scope.client.setLink(original);
  }, [scope, until]);
  return children;
}

export const ApolloKeyboardCrossesPageBoundary: Story = {
  args: { view: "miniatures" },
  parameters: apolloParameters,
  render: (args) => (
    <MiniatureApolloFixture data={apolloVault} pageDelay={300}>
      <Home {...args} />
    </MiniatureApolloFixture>
  ),
  play: async ({ mount, args }) => {
    const page = Promise.withResolvers<void>();
    const canvas = await mount(
      <MiniatureApolloFixture data={apolloVault}>
        <HoldMiniaturePages until={page.promise}>
          <Home {...args} />
        </HoldMiniaturePages>
      </MiniatureApolloFixture>,
    );
    try {
      const list = await canvas.findByRole("list", { name: "Miniature shelf" });
      await waitFor(() => expect(list).toHaveAttribute("data-loaded-count", "48"));
      window.scrollTo(0, document.documentElement.scrollHeight);
      const last = await canvas.findByRole("button", { name: /^(?!Actions for).*Synthetic Miniature 0072/ });
      // Outside edit mode the tile has exactly one control, not an action menu or
      // checkbox. One Tab must cross the page boundary; extra Tabs race the response.
      await expect(
        within(last.closest<HTMLElement>("[data-mini-index]")!).getAllByRole("button"),
      ).toHaveLength(1);
      last.focus();
      await userEvent.tab();
      await expect(last).toHaveFocus();
      await expect(list).toHaveAttribute("data-loaded-count", "48");
      page.resolve();
      await waitFor(() => expect(document.activeElement).toHaveAccessibleName(/Synthetic Miniature 0071/));
      await expect(document.activeElement?.tagName).toBe("BUTTON");
      await expect(list).toHaveAttribute("data-loaded-count", "96");
      // Once loaded, the same single-step traversal works in both directions.
      await userEvent.tab({ shift: true });
      await expect(last).toHaveFocus();
      await userEvent.tab();
      await expect(document.activeElement).toHaveAccessibleName(/Synthetic Miniature 0071/);
    } finally {
      page.resolve();
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
        await canvas.findByRole("button", { name: /^(?!Actions for).*Synthetic Miniature 0072/ }),
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
  play: async ({ mount, args }) => {
    const page = Promise.withResolvers<void>();
    const canvas = await mount(
      <MiniatureApolloFixture data={apolloVault}>
        <HoldMiniaturePages until={page.promise}>
          <Home {...args} />
        </HoldMiniaturePages>
      </MiniatureApolloFixture>,
    );
    try {
      const list = await canvas.findByRole("list", { name: "Miniature shelf" });
      await waitFor(() => expect(list).toHaveAttribute("data-loaded-count", "48"));
      window.scrollTo(0, document.documentElement.scrollHeight);
      const last = await canvas.findByRole("button", { name: /^(?!Actions for).*Synthetic Miniature 0072/ });
      last.focus();
      await userEvent.tab();
      await expect(last).toHaveFocus();
      const search = canvas.getByRole("textbox", { name: /Search miniatures/ });
      await userEvent.click(search);
      await expect(list).toHaveAttribute("data-loaded-count", "48");
      page.resolve();
      await waitFor(() => expect(list).toHaveAttribute("data-loaded-count", "96"));
      await expect(search).toHaveFocus();
    } finally {
      page.resolve();
      window.scrollTo(0, 0);
    }
  },
};

// Deliberately use the asynchronous Apollo path: the add tile is present immediately,
// and the grid sheds its placeholders after the accepted empty response.
// The tile is the single Add entry point; its dialog switches between a miniature and a folder.
const emptyShelf: Story = {
  beforeEach: ({ args }) => {
    localStorage.removeItem(`paintwarden.folders.${args.view}.flat`);
  },
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
    await expect(canvas.queryByRole("button", { name: /^Add$/ })).not.toBeInTheDocument();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    await userEvent.click(add);
    const body = within(document.body);
    // Wait for the lazily loaded form to replace its loading skeleton.
    await body.findByRole("textbox", { name: /Name/ });
    const miniature = within(body.getByRole("dialog", { name: "Add a miniature" }));
    await expect(
      miniature.queryByRole("group", { name: "What would you like to add?" }),
    ).not.toBeInTheDocument();
    await expect(miniature.getByRole("textbox", { name: /Name/ })).not.toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    try {
      await userEvent.click(canvas.getByRole("button", { name: "Folder view" }));
      await userEvent.click(add);
      const folder = within(await body.findByRole("dialog", { name: "Create folder" }));
      await expect(folder.getByRole("button", { name: "Folder" })).toHaveAttribute("aria-pressed", "true");
      await expect(folder.getByRole("textbox", { name: "Name" })).not.toHaveFocus();
      await userEvent.click(folder.getByRole("button", { name: "Miniature" }));
      const item = within(await body.findByRole("dialog", { name: "Add a miniature" }));
      await expect(item.getByRole("button", { name: "Miniature" })).toHaveFocus();
      await expect(body.getAllByRole("dialog")).toHaveLength(1);
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
      // Every fresh Add in folder view starts on Folder, even after choosing Miniature.
      await userEvent.click(add);
      const reopened = within(await body.findByRole("dialog", { name: "Create folder" }));
      await userEvent.click(reopened.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    } finally {
      await userEvent.click(canvas.getByRole("button", { name: "Flat view" }));
      localStorage.removeItem(`paintwarden.folders.${args.view}.flat`);
    }
  },
};

export const EmptyWorkbench: Story = { ...emptyShelf };
export const EmptyMiniatures: Story = { ...emptyShelf, args: { view: "miniatures" } };

export const MixedFolderAndMiniatureSearch: Story = {
  args: { view: "miniatures" },
  parameters: apolloParameters,
  render: (args) => (
    <MiniatureApolloFixture
      data={{ ...vault, miniatures: [{ ...miniatures.knight, title: "Knight" }] }}
      folders={[{ id: "army", name: "Knight project", parentId: null, directCount: 1, recursiveCount: 1 }]}
    >
      <Home {...args} />
    </MiniatureApolloFixture>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = await canvas.findByRole("textbox", { name: /Search miniatures/ });
    try {
      await userEvent.type(search, "Knight");
      await expect(await canvas.findByTitle("Open Knight project")).toBeInTheDocument();
      await expect(await canvas.findByRole("heading", { name: "Knight" })).toBeInTheDocument();
      await userEvent.click(canvas.getByTitle("Open Knight project"));
      await expect(search).toHaveValue("");
      await expect(await canvas.findByRole("navigation", { name: "Folder navigation" })).toHaveTextContent(
        "Knight project",
      );
    } finally {
      localStorage.removeItem("paintwarden.folders.miniatures.flat");
    }
  },
};
