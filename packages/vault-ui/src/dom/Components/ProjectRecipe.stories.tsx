import { Button } from "@mui/material";
import {
  isPaintAvailable,
  resolvePaintChoice,
  selectedSubstitution,
} from "@paintwarden/core/paint-substitutions";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { VaultGraphQLProvider } from "../graphql/provider";
import { i18n } from "../i18n";
import { column } from "../storybook/decorators";
import { miniatures, paints, vault } from "../storybook/fixtures";
import { mockApi } from "../storybook/mock-api";
import type { Paint } from "../types";
import { schemeOrderEntries } from "../utils/scheme-order";
import { attachedSchemes, resolvedPaintIds } from "../utils/vault-data";

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

const scanPhoto = new URL("../../../../../apps/paintwarden-web/public/icon-512.png", import.meta.url).href;

export const ScanPhotoInEditMode: Story = {
  args: { miniature: { ...knight, imageUrl: scanPhoto }, onScan: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: /Swatch Scan/ })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Edit recipe" }));
    const scan = canvas.getByRole("button", { name: /Swatch Scan.*Beta/ });
    await expect(scan).toBeEnabled();
    await expect(within(scan).getByText("Beta")).toBeVisible();
    await expect(scan).toHaveAccessibleName("Swatch Scan Beta Find paints from your miniature’s photo");
    // The edit row follows the recipe heading, before schemes and paint steps.
    const recipeHeading = canvas.getByRole("heading", { name: "Paint recipe" });
    const schemesHeading = canvas.getByRole("heading", { name: "Color schemes" });
    const paintsHeading = canvas.getByRole("heading", { name: "Paint steps" });
    await expect(
      Boolean(recipeHeading.compareDocumentPosition(scan) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    await expect(
      Boolean(scan.compareDocumentPosition(paintsHeading) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    await expect(
      Boolean(scan.compareDocumentPosition(schemesHeading) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    scan.focus();
    await userEvent.keyboard("[Enter]");
    await expect(args.onScan).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole("button", { name: "Done" }));
    await expect(canvas.queryByRole("button", { name: /Swatch Scan/ })).not.toBeInTheDocument();
  },
};

const emptyScanRecipe = { required: [], requirementRows: [], explicitSteps: [], schemes: [] };

async function zeroStateScan(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await expect(canvas.getByText(i18n.t("components:noPaintsAssignedYet"))).toBeVisible();
  await expect(canvas.getByRole("button", { name: i18n.t("components:editRecipe") })).toBeVisible();
  const scan = canvas.getByRole("button", { name: "Swatch Scan Beta" });
  const actions = within(scan.parentElement!).getAllByRole("button");
  await expect(actions).toHaveLength(3);
  await expect(actions[0]).toHaveAccessibleName(i18n.t("components:addAScheme"));
  await expect(actions[1]).toHaveAccessibleName(i18n.t("components:addAStep"));
  await expect(actions[2]).toBe(scan);
  await expect(scan).toHaveClass("MuiButton-outlined");
  await expect(within(scan).getByText("Beta")).toBeVisible();
  return { canvas, scan };
}

export const ScanEmptyRecipe: Story = {
  args: { ...emptyScanRecipe, miniature: { ...knight, imageUrl: scanPhoto }, onScan: fn() },
  play: async ({ canvasElement, args }) => {
    const { canvas, scan } = await zeroStateScan(canvasElement);
    await expect(scan).toBeEnabled();
    await userEvent.click(scan);
    await expect(args.onScan).toHaveBeenCalledTimes(1);
    // Opening the scan does not require or activate recipe editing.
    await expect(canvas.getByRole("button", { name: "Edit recipe" })).toBeVisible();
    await expect(args.setRecipe).not.toHaveBeenCalled();
    await expect(args.setRecipeSteps).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Edit recipe" }));
    await expect(canvas.getByRole("button", { name: /Swatch Scan.*Beta.*Find paints/ })).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: "Done" }));
    await expect(canvas.getByRole("button", { name: "Swatch Scan Beta" })).toBeEnabled();
  },
};

export const ScanEmptyRecipeWithoutPhoto: Story = {
  args: { ...emptyScanRecipe, miniature: { ...knight, imageUrl: null }, onScan: fn() },
  play: async ({ canvasElement, args }) => {
    const { canvas, scan } = await zeroStateScan(canvasElement);
    const hint = i18n.t("components:scanNoImage");
    await expect(scan).toBeDisabled();
    await expect(scan).toHaveAccessibleDescription(hint);
    await expect(canvas.getByText(hint)).toBeVisible();
    scan.click(); // Native disabled buttons must not dispatch onScan, even programmatically.
    await expect(args.onScan).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: i18n.t("components:editRecipe") }));
    await expect(canvas.queryByRole("button", { name: /Swatch Scan/ })).not.toBeInTheDocument();
    await expect(canvas.queryByText(hint)).not.toBeInTheDocument();
  },
};

export const ScanEmptyRecipeWithoutPhotoSpanish: Story = {
  ...ScanEmptyRecipeWithoutPhoto,
  parameters: { locale: "es" },
};

export const ScanEmptyRecipeExternalPhoto: Story = {
  args: {
    ...emptyScanRecipe,
    miniature: { ...knight, imageUrl: "https://example.com/miniature.jpg" },
    onScan: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const { canvas, scan } = await zeroStateScan(canvasElement);
    const hint = i18n.t("components:scanExternal");
    await expect(scan).toBeDisabled();
    await expect(scan).toHaveAccessibleDescription(hint);
    await expect(canvas.getByText(hint)).toBeVisible();
    scan.click(); // Native disabled buttons must not dispatch onScan, even programmatically.
    await expect(args.onScan).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Edit recipe" }));
    const row = canvas.getByRole("button", { name: /Swatch Scan.*Beta/ });
    await expect(row).toBeDisabled();
    await expect(row).toHaveAccessibleName(/Upload a photo to the vault to use Swatch Scan/);
  },
};

export const ScanWithoutPhoto: Story = {
  args: { miniature: { ...knight, imageUrl: null }, onScan: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Edit recipe" }));
    await expect(canvas.queryByRole("button", { name: /Swatch Scan/ })).not.toBeInTheDocument();
    await expect(args.onScan).not.toHaveBeenCalled();
  },
};

export const ScanExternalPhoto: Story = {
  args: { miniature: { ...knight, imageUrl: "https://example.com/miniature.jpg" }, onScan: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: /Swatch Scan/ })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Edit recipe" }));
    const scan = canvas.getByRole("button", { name: /Swatch Scan.*Beta/ });
    await expect(scan).toBeDisabled();
    await expect(scan).toHaveAccessibleName(/Upload a photo to the vault to use Swatch Scan/);
    await expect(args.onScan).not.toHaveBeenCalled();
  },
};
