import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { SubstitutionDialog } from "../Modals/SubstitutionDialog";
import { column } from "../storybook/decorators";
import { paints, vault } from "../storybook/fixtures";
import type { Paint } from "../types";

import { MissingProjectPaints } from "./MissingProjectPaints";

const meta = {
  title: "Components/MissingProjectPaints",
  component: MissingProjectPaints,
  args: {
    items: [
      { paint: paints.gold, projectCount: 3 },
      { paint: paints.blackWash, projectCount: 2 },
      { paint: paints.gunmetal, projectCount: 1 },
    ],
    listedCount: 4,
    onAdd: fn(),
    onAddAll: fn(),
  },
  decorators: [column(720)],
} satisfies Meta<typeof MissingProjectPaints>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { expanded: false }));
    await expect(await within(canvasElement).findByText("Add all 3")).toBeVisible();
  },
};

export const OnePaint: Story = { args: { items: [{ paint: paints.gold, projectCount: 1 }], listedCount: 0 } };

// Renders nothing once every project paint is on the list.
export const NothingMissing: Story = { args: { items: [] } };

const largeItems = Array.from({ length: 5001 }, (_, index) => ({
  paint: {
    ...paints.gold,
    id: `missing-${index}`,
    name: `Missing paint ${String(index + 1).padStart(5, "0")}`,
  },
  projectCount: index === 0 ? 3 : 1,
}));

export const LargeList: Story = {
  args: { items: largeItems },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { expanded: false }));
    const list = await canvas.findByRole("list", { name: "Missing project paints" });
    const mountedRows = () => [...list.querySelectorAll<HTMLElement>("[data-checklist-index]")];
    await waitFor(() => expect(mountedRows().length).toBeGreaterThan(2));
    await expect(mountedRows().length).toBeLessThan(80);
    await userEvent.click(canvas.getByRole("button", { name: "Add all 5001" }));
    await expect(args.onAddAll).toHaveBeenCalled();

    // Tab through the end of the mounted window and back across its beginning.
    const lastRow = mountedRows().at(-1)!;
    const lastIndex = Number(lastRow.dataset.checklistIndex);
    lastRow.querySelectorAll<HTMLButtonElement>("button").item(1).focus({ preventScroll: true });
    await userEvent.tab();
    await waitFor(async () => {
      const focused = document.activeElement?.closest<HTMLElement>("[data-checklist-index]");
      await expect(Number(focused?.dataset.checklistIndex)).toBe(lastIndex + 1);
    });
    list.scrollTop = 10000;
    list.dispatchEvent(new Event("scroll"));
    await waitFor(() => expect(Number(mountedRows()[0].dataset.checklistIndex)).toBeGreaterThan(100));
    const firstRow = mountedRows()[0];
    const firstIndex = Number(firstRow.dataset.checklistIndex);
    firstRow.querySelector<HTMLButtonElement>("button")!.focus({ preventScroll: true });
    await userEvent.tab({ shift: true });
    await waitFor(async () => {
      const focused = document.activeElement?.closest<HTMLElement>("[data-checklist-index]");
      await expect(Number(focused?.dataset.checklistIndex)).toBe(firstIndex - 1);
    });

    // Keyboard scrolling reaches a partial final grid row without mounting the full list.
    list.focus();
    await userEvent.keyboard("{End}");
    const final = await canvas.findByRole("button", { name: "Add Missing paint 05001 to wishlist" });
    await expect(final).toBeVisible();
    await userEvent.click(final);
    await expect(args.onAdd).toHaveBeenCalledWith(largeItems.at(-1)!.paint);
    await expect(mountedRows().length).toBeLessThan(80);
    await expect(mountedRows().at(-1)).toHaveAttribute("aria-posinset", "5001");
    await expect(mountedRows().at(-1)).toHaveAttribute("aria-setsize", "5001");
    // Reflow from desktop columns to a phone-width single column, then reach the end again.
    const previousWidth = canvasElement.style.width;
    canvasElement.style.width = "320px";
    await waitFor(() => expect(list.clientWidth).toBeLessThanOrEqual(320));
    list.focus();
    await userEvent.keyboard("{End}");
    await expect(
      await canvas.findByRole("button", { name: "Add Missing paint 05001 to wishlist" }),
    ).toBeVisible();
    canvasElement.style.width = previousWidth;
    list.focus();
    await userEvent.keyboard("{Home}");
    await expect(await canvas.findByText("Missing paint 00001")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { expanded: true }));
    await waitFor(() => expect(canvas.queryByRole("list", { name: "Missing project paints" })).toBeNull());
  },
};

export const LargePhoneList: Story = {
  ...LargeList,
  decorators: [column(320)],
};

// The original bottle is owned, but its selected recipe is still broken.
export const BrokenOnly: Story = {
  args: {
    items: [{ paint: paints.black, projectCount: 1, reasons: ["brokenSubstitution"] }],
    onFix: fn(),
  },
  parameters: {
    vault: {
      ...vault,
      paintSubstitutions: [
        ...vault.paintSubstitutions,
        {
          id: "user:empty-black-mix",
          targetPaintId: paints.black.id,
          name: "Empty black mix",
          isDefault: true,
        },
      ],
    },
  },
  render: function Render(args) {
    const [fixing, setFixing] = useState<Paint | null>(null);
    return (
      <>
        <MissingProjectPaints
          {...args}
          onFix={(paint) => {
            args.onFix?.(paint);
            setFixing(paint);
          }}
        />
        {fixing && <SubstitutionDialog paint={fixing} onClose={() => setFixing(null)} />}
      </>
    );
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { expanded: false }));
    await expect(canvas.getByText("Broken substitution")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /Add/ })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: `Fix substitution for ${paints.black.name}` }));
    await expect(args.onFix).toHaveBeenCalledWith(paints.black);
    const dialog = await within(document.body).findByRole("dialog", {
      name: `Substitute ${paints.black.name}`,
    });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).toBeNull());
  },
};

export const MixedReasons: Story = {
  args: {
    items: [
      { paint: paints.black, projectCount: 3, reasons: ["brokenSubstitution"] },
      { paint: paints.gold, projectCount: 2, reasons: ["missingStock", "brokenSubstitution"] },
      { paint: paints.blackWash, projectCount: 1, reasons: ["missingStock"] },
    ],
    onFix: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { expanded: false }));
    await expect(canvas.queryByRole("button", { name: `Add ${paints.black.name} to wishlist` })).toBeNull();
    await expect(canvas.getByRole("button", { name: `Add ${paints.gold.name} to wishlist` })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: `Fix substitution for ${paints.gold.name}` }));
    await expect(args.onFix).toHaveBeenCalledWith(paints.gold);
    await userEvent.click(canvas.getByRole("button", { name: "Add all 2" }));
    await expect(args.onAddAll).toHaveBeenCalledWith([paints.gold, paints.blackWash]);
    await userEvent.click(canvas.getByRole("button", { name: `Add ${paints.gold.name} to wishlist` }));
    await expect(args.onAdd).toHaveBeenCalledWith(paints.gold);
  },
};
