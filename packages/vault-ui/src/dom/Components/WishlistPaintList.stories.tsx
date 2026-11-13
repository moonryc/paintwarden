import { Button } from "@mui/material";
import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { paints } from "../storybook/fixtures";
import type { Paint } from "../types";

import { WishlistPaintList } from "./WishlistPaintList";
import { WishlistPaintRow } from "./WishlistPaintRow";

const onOpenPaint = fn();
const paintName = (index: number) => `Wishlist paint ${String(index).padStart(4, "0")}`;

function WishlistListExample({
  groupCount,
  paintsPerGroup,
  narrow = false,
  bought = false,
}: {
  groupCount: number;
  paintsPerGroup: number;
  narrow?: boolean;
  bought?: boolean;
}) {
  const [filtered, setFiltered] = useState(false);
  const [phoneWidth, setPhoneWidth] = useState(narrow);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    bought
      ? Object.fromEntries(
          Array.from({ length: groupCount * paintsPerGroup }, (_, index) => [`wishlist:${index}`, 1]),
        )
      : {},
  );
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const groups = useMemo(
    () =>
      Array.from({ length: groupCount }, (_, groupIndex) => {
        const brand = `Brand ${String(groupIndex).padStart(4, "0")}`;
        return [
          brand,
          Array.from({ length: paintsPerGroup }, (_, rowIndex) => {
            const index = groupIndex * paintsPerGroup + rowIndex;
            return {
              paint: {
                ...paints.gold,
                id: `wishlist:${index}`,
                brand,
                name: paintName(index),
              } satisfies Paint,
            };
          }),
        ] as const;
      }),
    [groupCount, paintsPerGroup],
  );
  const count = groupCount * paintsPerGroup;
  const visibleGroups = groups
    .map(
      ([brand, items]) =>
        [
          brand,
          items.filter(
            ({ paint }) =>
              !removed.has(paint.id) && (!filtered || Number(paint.id.split(":")[1]) >= count - 12),
          ),
        ] as const,
    )
    .filter(([, items]) => items.length);
  return (
    <Box sx={{ width: phoneWidth ? 320 : 760, maxWidth: "100%" }}>
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <Button onClick={() => setFiltered((value) => !value)}>
          {filtered ? "Show all paints" : "Show final twelve"}
        </Button>
        <Button onClick={() => setPhoneWidth((value) => !value)}>Change width</Button>
      </Box>
      <WishlistPaintList
        groups={visibleGroups}
        renderRow={({ paint }, listPosition) => (
          <WishlistPaintRow
            key={paint.id}
            paint={paint}
            listPosition={listPosition}
            restock={paint.id === "wishlist:0"}
            quantity={quantities[paint.id]}
            onBought={() => setQuantities((current) => ({ ...current, [paint.id]: 1 }))}
            onQuantityChange={(quantity) =>
              setQuantities((current) => ({ ...current, [paint.id]: quantity }))
            }
            onRemove={() => setRemoved((current) => new Set(current).add(paint.id))}
            onOpenPaint={() => {
              onOpenPaint(paint.id);
            }}
          />
        )}
      />
      <Button sx={{ mt: 2 }} onClick={fn()}>
        After wishlist
      </Button>
    </Box>
  );
}

function mountedRows(canvas: HTMLElement) {
  return [...canvas.querySelectorAll<HTMLElement>("section ul > li")];
}

function rowIndex(row: HTMLElement) {
  const list = row.parentElement;
  return Number(list?.dataset.wishlistStart) + [...(list?.children ?? [])].indexOf(row);
}

async function scrollToEnd(canvas: HTMLElement, count: number) {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
  await waitFor(async () => {
    await expect(
      within(canvas).getByRole("button", { name: `Remove ${paintName(count - 1)} from wishlist` }),
    ).toBeVisible();
  });
  await expect(mountedRows(canvas).length).toBeLessThan(50);
  const finalRow = mountedRows(canvas).at(-1)!;
  await expect(finalRow).toHaveAttribute("aria-posinset", finalRow.getAttribute("aria-setsize"));
}

async function checkKeyboardBoundaries(canvas: HTMLElement) {
  const forwardRow = mountedRows(canvas).at(-1)!;
  const nextIndex = rowIndex(forwardRow) + 1;
  const lastControl = forwardRow.querySelectorAll<HTMLButtonElement>("button").item(2);
  if (lastControl.tabIndex < 0) {
    // Enter the editable quantity through normal Tab, never programmatic text focus. Restore the
    // scroll position afterward so this remains the last mounted row and exercises the handoff.
    const scrollY = window.scrollY;
    forwardRow.querySelector<HTMLButtonElement>("button")!.focus({ preventScroll: true });
    await userEvent.tab();
    await expect(document.activeElement).toBe(forwardRow.querySelector("input"));
    window.scrollTo({ top: scrollY, behavior: "instant" });
    await waitFor(async () => await expect(rowIndex(mountedRows(canvas).at(-1)!)).toBe(nextIndex - 1));
  } else lastControl.focus({ preventScroll: true });
  await userEvent.tab();
  await waitFor(async () => {
    const focused = document.activeElement;
    await expect(focused).toBeInstanceOf(HTMLButtonElement);
    await expect(focused?.closest("li")).toHaveTextContent(paintName(nextIndex));
    await expect(focused).toBe(focused?.closest("li")?.querySelector("button"));
  });

  const reverseRow = mountedRows(canvas)[0];
  const previousIndex = rowIndex(reverseRow) - 1;
  await expect(previousIndex).toBeGreaterThanOrEqual(0);
  reverseRow.querySelector<HTMLButtonElement>("button")!.focus({ preventScroll: true });
  await userEvent.tab({ shift: true });
  await waitFor(async () => {
    await expect(document.activeElement?.closest("li")).toHaveTextContent(paintName(previousIndex));
    await expect(document.activeElement).toBe(
      document.activeElement?.closest("li")?.querySelectorAll("button").item(2),
    );
  });
}

const meta = {
  title: "Components/WishlistPaintList",
  component: WishlistListExample,
  args: { groupCount: 2, paintsPerGroup: 3 },
  beforeEach: () => {
    window.scrollTo({ top: 0, behavior: "instant" });
  },
} satisfies Meta<typeof WishlistListExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("heading", { level: 3 })).toHaveLength(2);
    await expect(canvas.getAllByRole("list")).toHaveLength(2);
    await expect(canvas.getAllByRole("listitem")).toHaveLength(6);
    await expect(canvas.getByText("Restock")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: new RegExp(`^${paintName(0)}`) }));
    await expect(onOpenPaint).toHaveBeenCalledWith("wishlist:0");
    await userEvent.click(canvas.getByRole("button", { name: `Mark ${paintName(0)} as bought` }));
    await expect(canvas.getByRole("textbox", { name: `${paintName(0)} quantity` })).toHaveValue("1");
    await userEvent.click(canvas.getByRole("button", { name: `Increase ${paintName(0)} quantity` }));
    await expect(canvas.getByRole("textbox", { name: `${paintName(0)} quantity` })).toHaveValue("2");
    await userEvent.click(canvas.getByRole("button", { name: `Remove ${paintName(1)} from wishlist` }));
    await expect(
      canvas.queryByRole("button", { name: `Remove ${paintName(1)} from wishlist` }),
    ).not.toBeInTheDocument();
  },
};

export const LargeSingleBrand: Story = {
  args: { groupCount: 1, paintsPerGroup: 2000 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryAllByRole("heading")).toHaveLength(0);
    await expect(mountedRows(canvasElement).length).toBeLessThan(50);
    await checkKeyboardBoundaries(canvasElement);
    await scrollToEnd(canvasElement, 2000);
    const canvas = within(canvasElement);
    canvas.getByRole("button", { name: `Remove ${paintName(1999)} from wishlist` }).focus();
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "After wishlist" })).toHaveFocus();
  },
};

export const ManyBrands: Story = {
  args: { groupCount: 1000, paintsPerGroup: 1 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("section").length).toBeLessThan(35);
    await checkKeyboardBoundaries(canvasElement);
    await scrollToEnd(canvasElement, 1000);
    await expect(within(canvasElement).getByRole("heading", { name: "Brand 0999 1" })).toBeVisible();
    await expect(canvasElement.querySelectorAll("section").length).toBeLessThan(35);
  },
};

export const PhoneAndFiltering: Story = {
  args: { groupCount: 120, paintsPerGroup: 4, narrow: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await scrollToEnd(canvasElement, 480);
    await userEvent.click(canvas.getByRole("button", { name: "Show final twelve" }));
    await waitFor(async () => await expect(canvas.getAllByRole("listitem")).toHaveLength(12));
    await scrollToEnd(canvasElement, 480);
    await userEvent.click(canvas.getByRole("button", { name: "Change width" }));
    await scrollToEnd(canvasElement, 480);
    await userEvent.click(canvas.getByRole("button", { name: "Show all paints" }));
    await scrollToEnd(canvasElement, 480);
    const finalRow = canvas
      .getByRole("button", { name: `Remove ${paintName(479)} from wishlist` })
      .closest("li")!;
    await expect(finalRow.getBoundingClientRect().height).toBe(66);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};

export const BoughtKeyboardBoundaries: Story = {
  args: { groupCount: 1, paintsPerGroup: 2000, bought: true },
  play: async ({ canvasElement }) => {
    await checkKeyboardBoundaries(canvasElement);
  },
};
