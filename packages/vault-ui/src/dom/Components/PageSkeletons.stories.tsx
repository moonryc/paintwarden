import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { PaintToolsPage } from "../Pages/PaintTools/PaintToolsPage";
import { StoryGraphQL } from "../storybook/graphql";

import { PageSkeleton } from "./PageSkeletons";

const meta = {
  title: "Components/PageSkeletons",
  component: PageSkeleton,
  args: { page: "home" },
  render: (args) => (
    <Box sx={{ maxWidth: args.page.endsWith("detail") || args.page === "plugins" ? 720 : 1180, mx: "auto" }}>
      <PageSkeleton {...args} />
    </Box>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const markers = canvasElement.querySelectorAll("[data-skeleton]");
    await expect(markers).toHaveLength(1);
    await expect(markers[0]).toHaveAttribute("data-skeleton", args.page);
    await expect(markers[0]).toHaveAttribute("aria-busy", "true");
    const statuses = canvas.getAllByRole("status");
    await expect(statuses).toHaveLength(1);
    await expect(statuses[0]).toHaveAttribute("aria-live", "polite");
    const title = {
      home: "Workbench",
      miniatures: "Miniatures",
      paints: "Paints",
      wishlist: "Wishlist",
      schemes: "Schemes",
      templates: "Miniature templates",
      settings: "Data & settings",
      plugins: "Plugins",
      "paint-tools": "Paint Tools",
      "miniature-detail": "Miniature details",
      "paint-detail": "Paint details",
    }[args.page];
    await expect(statuses[0]).toHaveTextContent(`Loading ${title}…`);
    await expect(statuses[0].closest('[aria-hidden="true"]')).toBeNull();
    const shapes = [...canvasElement.querySelectorAll<HTMLElement>(".MuiSkeleton-root")];
    await expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      await expect(shape).toHaveAttribute("aria-hidden", "true");
      await expect(shape.closest('[aria-hidden="true"]')).not.toBeNull();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        await expect(getComputedStyle(shape).animationName).toBe("none");
      }
    }
    const root = markers[0] as HTMLElement;
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    // Placeholders must not put fake controls in the keyboard/accessibility tree.
    await expect(canvas.queryAllByRole("button")).toHaveLength(0);
    await expect(canvas.queryAllByRole("textbox")).toHaveLength(0);
  },
} satisfies Meta<typeof PageSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Home: Story = { args: { page: "home" } };
export const Miniatures: Story = { args: { page: "miniatures" } };
export const Paints: Story = { args: { page: "paints" } };
export const Wishlist: Story = { args: { page: "wishlist" } };
export const Schemes: Story = { args: { page: "schemes" } };
export const Templates: Story = { args: { page: "templates" } };
export const Settings: Story = { args: { page: "settings" } };
export const Plugins: Story = { args: { page: "plugins" } };
export const PaintTools: Story = { args: { page: "paint-tools" } };
export const MiniatureDetail: Story = { args: { page: "miniature-detail" } };
export const PaintDetail: Story = { args: { page: "paint-detail" } };

export const ReducedMotion: Story = {
  args: { page: "home" },
  beforeEach: () => {
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const media = matchMedia.call(window, query);
      if (query === "(prefers-reduced-motion: reduce)") {
        Object.defineProperty(media, "matches", { value: true });
      }
      return media;
    };
    return () => {
      window.matchMedia = matchMedia;
    };
  },
};

export const NarrowWishlist: Story = {
  args: { page: "wishlist" },
  render: (args) => (
    <Box sx={{ width: 320, maxWidth: "100%", mx: "auto" }}>
      <PageSkeleton {...args} />
    </Box>
  ),
};

export const NarrowMiniatures: Story = { ...NarrowWishlist, args: { page: "miniatures" } };
export const NarrowSchemes: Story = { ...NarrowWishlist, args: { page: "schemes" } };

// The lazy-page shell and query-pending page reserve exactly the same beta title geometry.
export const PaintToolsHeaderParity: Story = {
  args: { page: "paint-tools" },
  render: () => (
    <StoryGraphQL pending respond={() => ({})}>
      <Box sx={{ minWidth: 0 }}>
        <PageSkeleton page="paint-tools" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <PaintToolsPage />
      </Box>
    </StoryGraphQL>
  ),
  play: async ({ canvasElement }) => {
    const headers = canvasElement.querySelectorAll<HTMLElement>("[data-page-header]");
    await expect(headers).toHaveLength(2);
    for (const selector of [":scope", "h2", "p:last-child", ".MuiChip-root"]) {
      const elements = [...headers].map((header) =>
        selector === ":scope" ? header : header.querySelector<HTMLElement>(selector)!,
      );
      const rects = elements.map((element, index) => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y - headers[index].getBoundingClientRect().y,
          width: rect.width,
          height: rect.height,
        };
      });
      await expect(rects[0]).toEqual(rects[1]);
    }
    await expect(within(canvasElement).getByRole("heading", { name: "Paint Tools Beta" })).toBeVisible();
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
