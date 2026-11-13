import { Button } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { useVaultStore } from "../store/hooks";
import { miniatures, paints, requirements, vault } from "../storybook/fixtures";
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
    await expect(await canvas.findByRole("heading", { name: "A First brand 1000" })).toBeVisible();
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

// Simulate the inventory delta arriving after a purchase, without a server or persistent vault.
function PurchaseScenario() {
  const updateVault = useVaultStore((store) => store.updateVault);
  return (
    <>
      <WishlistPage />
      <Button
        onClick={() =>
          updateVault((current) => ({
            ...current,
            paintStates: { ...current.paintStates, [finalPaint.id]: "OWNED" },
            paintRecords: {
              ...current.paintRecords,
              [finalPaint.id]: { state: "OWNED", stockLevel: "FULL", quantity: 1 },
            },
          }))
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
    await userEvent.click(canvas.getByRole("combobox", { name: "Miniature" }));
    await userEvent.click(await within(document.body).findByRole("option", { name: "Final project (1)" }));
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
  },
};

export const Empty: Story = {
  parameters: { vault: { ...largeVault, catalog: [], miniatures: [], requirements: [] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Nothing to buy")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Browse paints" })).toBeVisible();
  },
};
