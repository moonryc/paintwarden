import { Button } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { column } from "../storybook/decorators";
import { miniatures, paints, vault } from "../storybook/fixtures";
import type { Paint } from "../types";
import { schemeOrderEntries } from "../utils/scheme-order";
import { attachedSchemes, resolvedPaintIds } from "../utils/vault-data";

import {
  isPaintAvailable,
  resolvePaintChoice,
  selectedSubstitution,
} from "@paintwarden/core/paint-substitutions";
import { VaultGraphQLProvider } from "../graphql/provider";
import { mockApi } from "../storybook/mock-api";
import { Modal } from "./Modal";
import { ProjectRecipeView } from "./ProjectRecipe";

const knight = miniatures.knight;
const required = resolvedPaintIds(vault, knight.id)
  .map((id) => vault.catalog.find((paint) => paint.id === id))
  .filter(Boolean) as Paint[];
const requirementRows = vault.requirements
  .filter((row) => row.miniatureId === knight.id)
  .sort((a, b) => a.sortOrder - b.sortOrder);
const schemes = attachedSchemes(vault, knight.id).map((scheme) => {
  const entries = schemeOrderEntries(vault, scheme.id);
  return {
    ...scheme,
    entries,
    paints: vault.catalog,
    paintCount: entries.filter((entry) => entry.type === "PAINT").length,
  };
});

const meta = {
  title: "Components/ProjectRecipe",
  component: ProjectRecipeView,
  args: {
    miniature: knight,
    required,
    requirementRows,
    catalog: vault.catalog,
    explicitSteps: [],
    schemes,
    paintStatus: (id) => ({
      available: isPaintAvailable(vault, vault.paintRecords, id),
      wished: vault.paintStates[id] === "WISHLIST",
      activeSubstitution: selectedSubstitution(vault, knight.id, id)
        ? {
            name: selectedSubstitution(vault, knight.id, id)!.name,
            broken: resolvePaintChoice(vault, knight.id, id).broken,
          }
        : null,
    }),
    onSetPaintState: fn(),
    setRecipe: fn(),
    setRecipeSteps: fn(),
    setAttached: fn(async () => undefined),
    renderSchemePicker: ({ onSave, onClose }) => (
      <Modal onClose={onClose} title="Choose schemes" subtitle="Stage changes before saving">
        <Button
          onClick={async () => {
            await onSave([...schemes.map((scheme) => scheme.id), "extra-scheme"]);
            onClose();
          }}
        >
          Add selected scheme
        </Button>
      </Modal>
    ),
    onOpenPaint: fn(),
    onOpenScheme: fn(),
  },
  // Vault data is too large to edit usefully in the controls panel.
  argTypes: {
    miniature: { control: false },
    required: { control: false },
    requirementRows: { control: false },
  },
  decorators: [
    column(720),
    mockApi(),
    (Story) => (
      <VaultGraphQLProvider>
        <Story />
      </VaultGraphQLProvider>
    ),
  ],
} satisfies Meta<typeof ProjectRecipeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoPaints: Story = {
  args: { miniature: miniatures.dragon, required: [], requirementRows: [], schemes: [] },
};

export const EditStepsAndPaints: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit recipe" }));
    await userEvent.click(canvas.getByRole("button", { name: `Remove ${paints.crimson.name} from recipe` }));
    await expect(args.setRecipe).toHaveBeenCalledWith(
      knight.id,
      expect.not.arrayContaining([expect.objectContaining({ paintId: paints.crimson.id })]),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Add a step" }));
    await userEvent.click(canvas.getByRole("button", { name: "Confirm" }));
    await expect(args.setRecipeSteps).toHaveBeenCalledWith(knight.id, ["PRIMER"]);
    await userEvent.click(canvas.getByRole("button", { name: "Add paint to Basecoat" }));
    const picker = canvas.getByRole("combobox", { name: "Add paint" });
    await userEvent.type(picker, paints.gold.name);
    await userEvent.click(
      await within(document.body).findByRole("option", { name: new RegExp(paints.gold.name) }),
    );
    await expect(args.setRecipe).toHaveBeenCalledWith(
      knight.id,
      expect.arrayContaining([expect.objectContaining({ paintId: paints.gold.id, step: "BASECOAT" })]),
    );
  },
};

export const AttachAndDetachSchemes: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit recipe" }));
    await userEvent.click(canvas.getByRole("button", { name: `Remove ${schemes[0].name} from miniature` }));
    await expect(args.setAttached).toHaveBeenCalledWith([]);
    await userEvent.click(canvas.getByRole("button", { name: "Add Scheme" }));
    await userEvent.click(await within(document.body).findByRole("button", { name: "Add selected scheme" }));
    await expect(args.setAttached).toHaveBeenCalledWith([schemes[0].id, "extra-scheme"]);
  },
};

export const MergedSchemePaints: Story = {
  args: {
    schemes: schemes.map((scheme) => ({
      ...scheme,
      entries: [
        { type: "DIVIDER", id: "basecoat", label: "Basecoat", tone: "SECTION", sortOrder: -1 },
        ...scheme.entries,
      ],
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("switch", { name: "Show scheme paints in steps" });
    if (!(toggle as HTMLInputElement).checked) await userEvent.click(toggle);
    await expect(canvas.getAllByText("Added to miniature")[0]).toBeVisible();
    await expect(canvas.getAllByText("From scheme").length).toBeGreaterThan(0);
    await userEvent.click(toggle);
  },
};

export const RemoveEmptyStep: Story = {
  args: { requirementRows: [], explicitSteps: ["BASECOAT"] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit recipe" }));
    await userEvent.click(canvas.getByRole("button", { name: "Remove empty Basecoat step" }));
    await expect(args.setRecipeSteps).toHaveBeenCalledWith(knight.id, []);
  },
};

export const KeyboardReorder: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit recipe" }));
    const handle = canvas.getByRole("button", { name: `Reorder ${paints.black.name}` });
    handle.focus();
    await userEvent.keyboard("[Space][ArrowDown][Space]");
    await expect(args.setRecipe).toHaveBeenCalledWith(
      knight.id,
      expect.arrayContaining([
        expect.objectContaining({ paintId: paints.black.id, sortOrder: 1 }),
        expect.objectContaining({ paintId: paints.crimson.id, sortOrder: 0 }),
      ]),
    );
  },
};
