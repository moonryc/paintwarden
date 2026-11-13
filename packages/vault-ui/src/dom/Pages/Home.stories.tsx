import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { miniatures, paints, vault } from "../storybook/fixtures";
import type { State } from "../types";

import { Home } from "./Home";

const meta = {
  title: "Pages/Home",
  component: Home,
  args: { view: "dashboard", onAdd: fn() },
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
