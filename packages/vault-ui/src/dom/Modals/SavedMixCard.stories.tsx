import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { column } from "../storybook/decorators";
import { paints, vault } from "../storybook/fixtures";

import { SavedMixCard } from "./SavedMixCard";

const mix = vault.paintSubstitutions[0];
const meta = {
  title: "Modals/SavedMixCard",
  component: SavedMixCard,
  args: { projection: { mix, ingredients: [], brokenReason: null }, onToggleDefault: fn(), onDelete: fn() },
  decorators: [column(720)],
} satisfies Meta<typeof SavedMixCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// The production projection must render even when its paints are absent from the snapshot.
export const ServerProjection: Story = {
  args: {
    projection: {
      mix: { id: "server-mix", name: "Server mix", isDefault: false },
      ingredients: [
        {
          paint: { ...paints.skyBlue, id: "server-only", name: "Server-only paint" },
          parts: 3,
          sortOrder: 0,
        },
      ],
      brokenReason: null,
      hasMoreIngredients: true,
      onLoadMoreIngredients: fn(),
    },
  },
  parameters: { vault: { ...vault, catalog: [], paintSubstitutions: [], paintSubstitutionIngredients: [] } },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByText("3× Server-only paint")).toBeVisible();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Load more ingredients" }));
    if ("projection" in args) await expect(args.projection.onLoadMoreIngredients).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole("button", { name: "Make default" }));
    await expect(args.onToggleDefault).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole("button", { name: "Delete Server mix" }));
    await expect(args.onDelete).toHaveBeenCalledOnce();
  },
};

export const ServerBrokenProjection: Story = {
  args: {
    projection: {
      mix: { id: "broken-server-mix", name: "Broken server mix", isDefault: false },
      ingredients: [],
      brokenReason: "CYCLE",
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Broken substitution: circular recipe.");
    await expect(canvas.getByRole("button", { name: "Make default" })).toBeEnabled();
  },
};
