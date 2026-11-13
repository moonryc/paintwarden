import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { PaintAutocomplete } from "../Components/PaintAutocomplete";
import { VaultGraphQLProvider } from "../graphql/provider";
import { ApolloSchemePickerDialog } from "../Modals/ApolloSchemePickerDialog";
import { SubstitutionDialog } from "../Modals/SubstitutionDialog";
import { paints, schemes } from "../storybook/fixtures";
import { LibraryFixtureProvider } from "../storybook/library-fixtures";
import { mockApi } from "../storybook/mock-api";

import { PaintLibrary } from "./PaintLibrary";
import { PaintComparison } from "./PaintTools/PaintComparison";
import { RecipeConverter } from "./PaintTools/RecipeConverter";
import { ColorSchemesPage } from "./Schemes/ColorSchemesPage";

const meta = {
  title: "Pages/FuzzySearch",
  decorators: [
    mockApi(),
    (Story) => (
      <VaultGraphQLProvider>
        <Story />
      </VaultGraphQLProvider>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function ExcludedPaintPicker() {
  const [query, setQuery] = useState("");
  return (
    <PaintAutocomplete
      excludedIds={[paints.royalBlue.id]}
      query={query}
      onQueryChange={setQuery}
      onChoose={fn()}
    />
  );
}

export const PaintPickerExcludesBeforeSearching: Story = {
  render: () => <ExcludedPaintPicker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await userEvent.type(canvas.getByRole("combobox", { name: "Add paint" }), "blue");
    await expect(await body.findByRole("option", { name: /Sky Blue/ })).toBeInTheDocument();
    await waitFor(() => expect(body.queryByRole("option", { name: /Abyss Black/ })).not.toBeInTheDocument());
    await expect(body.queryByRole("option", { name: /Royal Blue/ })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.tab();
  },
};

export const LibrarySearch: Story = {
  render: () => (
    <LibraryFixtureProvider>
      <PaintLibrary onAddPaint={fn()} />
    </LibraryFixtureProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Search brand, range, or paint…" });
    await userEvent.type(input, "Royal Blue");
    await waitFor(async () => {
      await expect(canvas.getByText("Royal Blue")).toBeInTheDocument();
      await expect(canvas.queryByText("Abyss Black")).not.toBeInTheDocument();
    });
    await userEvent.clear(input);
    await expect(await canvas.findByText("Abyss Black")).toBeInTheDocument();
  },
};

const apolloTools: Decorator[] = [
  mockApi(),
  (Story) => (
    <VaultGraphQLProvider>
      <Story />
    </VaultGraphQLProvider>
  ),
];

export const ComparisonLatestQueryWins: Story = {
  decorators: apolloTools,
  render: () => <PaintComparison onOpenPaint={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    const input = canvas.getByRole("combobox", { name: "Paint" });
    await userEvent.type(input, "royl blue");
    await expect(await body.findByRole("option", { name: /Royal Blue/ })).toBeInTheDocument();
    await waitFor(() => expect(body.queryByRole("option", { name: /Abyss Black/ })).not.toBeInTheDocument());
    await userEvent.clear(input);
    await userEvent.type(input, "Abyss Black");
    const black = await body.findByRole("option", { name: /Abyss Black/ });
    await waitFor(() => expect(body.queryByRole("option", { name: /Royal Blue/ })).not.toBeInTheDocument());
    await userEvent.click(black);
    await expect(input).toHaveValue("Abyss Black");
    await userEvent.tab();
  },
};

export const ConverterSourceAndReplacement: Story = {
  decorators: apolloTools,
  render: () => <RecipeConverter onOpenPaint={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await userEvent.type(canvas.getByRole("combobox", { name: "Source scheme" }), "crimsn armour");
    await expect(await body.findByRole("option", { name: "Crimson armour" })).toBeInTheDocument();
    await waitFor(() => expect(body.queryByRole("option", { name: "Ocean cloak" })).not.toBeInTheDocument());
    await userEvent.click(body.getByRole("option", { name: "Crimson armour" }));
    const replacement = await canvas.findByRole("combobox", { name: "Use paint" });
    await userEvent.clear(replacement);
    await userEvent.type(replacement, "bone white");
    await expect(await body.findByRole("option", { name: /Bone White/ })).toBeInTheDocument();
    await waitFor(() => expect(body.queryByRole("option", { name: /Abyss Black/ })).not.toBeInTheDocument());
    await userEvent.click(body.getByRole("option", { name: /Bone White/ }));
    await expect(replacement).toHaveValue("Bone White · Example Paints · Layer");
    await expect(canvas.getByText("Scarlet Layer")).toBeInTheDocument();
    await userEvent.click(canvas.getByText("Recipe converter"));
  },
};

export const SchemeSearchAndUsesPaints: Story = {
  decorators: apolloTools,
  render: () => <ColorSchemesPage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    const search = await canvas.findByRole("textbox", { name: "Search schemes…" });
    await userEvent.type(search, "ocean");
    await waitFor(async () => {
      await expect(canvas.getByText("Ocean cloak")).toBeInTheDocument();
      await expect(canvas.queryByText("Crimson armour")).not.toBeInTheDocument();
    });
    await userEvent.clear(search);
    const paintInput = canvas.getByRole("combobox", { name: "Uses paints" });
    await userEvent.type(paintInput, "scarlet");
    await userEvent.click(await body.findByRole("option", { name: /Scarlet Layer/ }));
    await waitFor(async () => {
      await expect(canvas.getByText("Crimson armour")).toBeInTheDocument();
      await expect(canvas.queryByText("Ocean cloak")).not.toBeInTheDocument();
    });
    await userEvent.click(paintInput);
    await waitFor(() =>
      expect(body.queryByRole("option", { name: /Scarlet Layer/ })).not.toBeInTheDocument(),
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.tab();
  },
};

export const SubstitutionIngredientExclusion: Story = {
  render: () => <SubstitutionDialog paint={paints.royalBlue} onClose={fn()} />,
  play: async () => {
    const body = within(document.body);
    const input = body.getByRole("combobox", { name: "Ingredient paint" });
    await userEvent.type(input, "blue");
    await expect(await body.findByRole("option", { name: /Sky Blue/ })).toBeInTheDocument();
    await waitFor(() => expect(body.queryByRole("option", { name: /Abyss Black/ })).not.toBeInTheDocument());
    await expect(body.queryByRole("option", { name: /Royal Blue/ })).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("option", { name: /Sky Blue/ }));
    await expect(body.queryByRole("option", { name: /Royal Blue/ })).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "Add" }));
    await userEvent.type(input, "sky blue");
    await waitFor(() => expect(body.queryByRole("option", { name: /Sky Blue/ })).not.toBeInTheDocument());
    await expect(body.getByText("Sky Blue", { exact: true })).toBeInTheDocument();
  },
};

export const SchemePickerExcludesAttached: Story = {
  render: () => (
    <ApolloSchemePickerDialog attachedIds={[schemes.crimsonArmour.id]} onSave={fn()} onClose={fn()} />
  ),
  play: async () => {
    const body = within(document.body);
    const search = body.getByRole("textbox", { name: "Search color schemes" });
    await userEvent.type(search, "crimson");
    await expect(await body.findByText("No schemes match “crimson”.")).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, "ocean");
    await userEvent.click(await body.findByRole("button", { name: "Ocean cloak" }));
    await expect(body.getByRole("button", { name: "Add scheme" })).toBeEnabled();
  },
};
