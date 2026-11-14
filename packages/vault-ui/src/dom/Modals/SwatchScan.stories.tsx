import { ApolloClient, ApolloLink } from "@apollo/client";
import { Box, Button, GlobalStyles } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState, type ReactNode } from "react";
import { Observable } from "rxjs";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { createVaultCache } from "../graphql/cache";
import type {
  MiniatureRecipeEntryInput,
  SetProjectRecipeMutationVariables,
  SetProjectSchemesMutationVariables,
} from "../graphql/generated/graphql";
import { VaultInvalidationController } from "../graphql/invalidation";
import { VaultGraphQLContext } from "../graphql/provider";
import { i18n } from "../i18n";

import { SwatchScan } from "./SwatchScan";

type RecipeVariables = Omit<SetProjectRecipeMutationVariables, "entries" | "steps"> & {
  entries: MiniatureRecipeEntryInput[];
  steps: string[];
};
type SchemesVariables = Omit<SetProjectSchemesMutationVariables, "schemeIds"> & { schemeIds: string[] };

const photo = new URL("../../../../../apps/paintwarden-web/public/icon-512.png", import.meta.url).href;
const pageInfo = { hasNextPage: false, endCursor: null };
const paints = [
  { id: "blue", name: "Library blue", brand: "Example", hex: "#2266AA", owned: false, available: true },
  { id: "white", name: "Owned white", brand: "Example", hex: "#FFFFFF", owned: true, available: true },
  { id: "black", name: "Library black", brand: "Example", hex: "#000000", owned: false, available: false },
  { id: "red", name: "Owned red", brand: "Example", hex: "#AA3322", owned: true, available: true },
];
const detailPaint = (paint = paints[0]) => ({
  __typename: "Paint",
  ...paint,
  range: "Standard",
  colorHex: paint.hex,
  sourceUrl: null,
  isCustom: false,
  sourceName: null,
  sourceLogoUrl: null,
  inventory: paint.owned ? { state: "OWNED", stockLevel: "FULL", quantity: 1 } : null,
  hasActiveSubstitution: false,
  brokenReason: null,
  missingStock: !paint.available,
  brokenSubstitution: false,
  activeSubstitution: null,
});
const initialRecipe = [
  {
    id: "existing-base",
    paintId: "red",
    step: "BASECOAT",
    notes: "Preserve the original base notes",
    sortOrder: 0,
  },
  {
    id: "existing-detail",
    paintId: "black",
    step: "DETAIL",
    notes: "Preserve the detail notes",
    sortOrder: 1,
  },
];
const summary = (id: string) => ({
  __typename: "MiniatureScheme",
  id,
  name: id === "attached" ? "Existing scheme" : "Matched scheme",
  category: "BLUE",
  isSystem: false,
  sourceName: null,
  sourceLogoUrl: null,
  paintCount: 1,
  availableCount: 1,
  previewSwatches: [{ paintId: "blue", colorHex: "#2266AA" }],
  previewSwatchesTruncated: false,
  imageUrl: null,
  thumbnailUrl: null,
});
const windowOf = <T,>(nodes: T[]) => ({ nodes, totalCount: nodes.length, pageInfo });
function Connection({
  children,
  external = false,
  delay = 0,
  fail = false,
  empty = false,
  longNames = false,
}: {
  children: ReactNode;
  external?: boolean;
  delay?: number;
  fail?: boolean;
  empty?: boolean;
  longNames?: boolean;
}) {
  const [savedRecipe, setSavedRecipe] = useState<RecipeVariables | null>(null);
  const [savedSchemes, setSavedSchemes] = useState<SchemesVariables | null>(null);
  const [scope] = useState(() => {
    let seq = 1;
    let failed = false;
    let recipe = initialRecipe;
    let recipeSteps = ["BASECOAT", "DETAIL"];
    let schemeIds = ["attached"];
    const controller = new VaultInvalidationController();
    const client = new ApolloClient({
      cache: createVaultCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            const respond = () => {
              const revision = { epoch: "scan-story", seq: String(seq) };
              if (operation.operationName === "ColorToolIndex") {
                if (fail && !failed) {
                  failed = true;
                  observer.error(new Error("Color connection interrupted"));
                  return;
                }
                observer.next({
                  data: {
                    colorIndex: {
                      revision,
                      nodes: empty
                        ? []
                        : paints.map((paint) => ({
                            ...paint,
                            name: longNames
                              ? `${paint.name} — An exceptionally long miniature color name repeated for a narrow screen`
                              : paint.name,
                          })),
                      pageInfo,
                    },
                  },
                });
              } else if (operation.operationName === "ProjectMiniatureDetails") {
                observer.next({
                  data: {
                    miniature: {
                      revision,
                      miniature: {
                        id: "mini",
                        title: "Paintwarden sample miniature",
                        status: "OWNED",
                        paintingStatus: "IN_PROGRESS",
                        imageUrl: external ? "https://example.invalid/photo.jpg" : photo,
                        createdAt: 1,
                        notes: "Original miniature",
                        manufacturer: null,
                        faction: null,
                        scale: null,
                      },
                      recipeSteps,
                      recipe: windowOf(
                        recipe.map((row) => ({
                          ...row,
                          paint: detailPaint(paints.find((paint) => paint.id === row.paintId)),
                        })),
                      ),
                      schemes: windowOf(
                        schemeIds.map((id, sortOrder) => ({
                          id: `link-${id}`,
                          sortOrder,
                          scheme: summary(id),
                        })),
                      ),
                      required: windowOf([]),
                      missing: windowOf([]),
                    },
                  },
                });
              } else if (operation.operationName === "MiniatureSchemeDetails") {
                observer.next({
                  data: {
                    miniatureScheme: {
                      revision,
                      scheme: summary(String(operation.variables.id)),
                      entries: windowOf([]),
                    },
                  },
                });
              } else if (operation.operationName === "SchemesPage") {
                observer.next({
                  data: {
                    schemes: {
                      revision,
                      nodes: [
                        {
                          ...summary("matched"),
                          sourceId: null,
                          paintNames: "Library blue",
                          usageCount: 0,
                          gradient: "linear-gradient(#2266AA,#FFFFFF)",
                          previewMoreCount: 0,
                        },
                      ],
                      totalCount: 1,
                      pageInfo,
                      facets: { categories: [], sources: [], readiness: [] },
                    },
                  },
                });
              } else if (operation.operationName === "SetProjectRecipe") {
                const variables = operation.variables as RecipeVariables;
                setSavedRecipe(variables);
                recipe = variables.entries.map((entry) => ({
                  id: String(entry.id),
                  paintId: String(entry.paintId),
                  step: entry.step ?? "OTHER",
                  notes: entry.notes ?? "",
                  sortOrder: entry.sortOrder ?? 0,
                }));
                recipeSteps = variables.steps ?? [];
                seq++;
                observer.next({
                  data: {
                    setMiniatureRecipe: {
                      miniatureId: "mini",
                      revision: { ...revision, seq: String(seq) },
                      invalidatedFamilies: ["MINIATURES", "SCHEMES"],
                      clientMutationId: variables.clientMutationId,
                    },
                  },
                });
              } else if (operation.operationName === "SetProjectSchemes") {
                const variables = operation.variables as SchemesVariables;
                setSavedSchemes(variables);
                schemeIds = variables.schemeIds.map(String);
                seq++;
                observer.next({
                  data: {
                    setMiniatureSchemes: {
                      miniatureId: "mini",
                      revision: { ...revision, seq: String(seq) },
                      invalidatedFamilies: ["MINIATURES", "SCHEMES"],
                      clientMutationId: variables.clientMutationId,
                    },
                  },
                });
              } else {
                observer.error(new Error(`Unexpected operation ${operation.operationName}`));
                return;
              }
              observer.complete();
            };
            const timer = setTimeout(
              respond,
              operation.operationName === "ColorToolIndex" ||
                operation.operationName === "ProjectMiniatureDetails"
                ? delay
                : 0,
            );
            return () => clearTimeout(timer);
          }),
      ),
    });
    return {
      client,
      controller,
      dispose() {
        controller.dispose();
        client.stop();
      },
    };
  });
  useEffect(() => () => scope.dispose(), [scope]);
  return (
    <VaultGraphQLContext.Provider value={scope}>
      {children}
      {savedRecipe && <Box data-testid="saved-recipe">{JSON.stringify(savedRecipe)}</Box>}
      {savedSchemes && <Box data-testid="saved-schemes">{JSON.stringify(savedSchemes)}</Box>}
    </VaultGraphQLContext.Provider>
  );
}
function Example() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open scan</Button>
      {open && <SwatchScan miniatureId="mini" onClose={() => setOpen(false)} />}
    </>
  );
}
const meta = {
  title: "Color tools/Swatch Scan",
  component: SwatchScan,
  args: { miniatureId: "mini", onClose: () => {} },
  render: () => <Example />,
  decorators: [
    (Story, context) => (
      <Connection
        external={Boolean(context.parameters.external)}
        delay={Number(context.parameters.queryDelay ?? 0)}
        fail={Boolean(context.parameters.fail)}
        empty={Boolean(context.parameters.empty)}
        longNames={Boolean(context.parameters.longNames)}
      >
        <Story />
      </Connection>
    ),
  ],
} satisfies Meta<typeof SwatchScan>;
export default meta;
type Story = StoryObj<typeof meta>;
function body(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}
async function sample(canvasElement: HTMLElement) {
  const screen = body(canvasElement);
  const sampleButton = await screen.findByRole("button", { name: i18n.t("components:scanSampleCursor") });
  await waitFor(() => expect(sampleButton).toBeEnabled());
  await userEvent.click(sampleButton);
  return screen;
}
export const PinsModesAndClear: Story = {
  play: async ({ canvasElement }) => {
    const screen = await sample(canvasElement);
    const pins = screen.getByRole("list", { name: "Sample pins" });
    await expect(within(pins).getAllByRole("button")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Sample at crosshair" }));
    await expect(within(pins).getAllByRole("button")).toHaveLength(2);
    await userEvent.click(within(pins).getAllByRole("button")[0]);
    await expect(within(pins).getAllByRole("button")[0]).toHaveAttribute("aria-pressed", "true");
    await expect(screen.getByRole("list", { name: "Closest paint matches" })).toBeInTheDocument();
    await expect(screen.getByText("Library black")).toBeInTheDocument();
    await expect(screen.getByText("Not owned")).toBeInTheDocument();
    await expect(screen.getByText("Available via substitution")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "By scheme" }));
    await expect(await screen.findByText("Matched scheme")).toBeInTheDocument();
    await expect(screen.queryByRole("list", { name: "Closest paint matches" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "By paint" }));
    await expect(screen.getByRole("list", { name: "Closest paint matches" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear pins" }));
    await expect(within(pins).queryAllByRole("button")).toHaveLength(0);
    await expect(screen.getByRole("button", { name: "Clear pins" })).toBeDisabled();
  },
};
async function openAssign(canvasElement: HTMLElement) {
  const screen = await sample(canvasElement);
  const list = screen.getByRole("list", { name: i18n.t("components:scanMatches") });
  const first = within(list).getByText("Library blue").closest("li")!;
  const name = first.querySelector("p")?.textContent;
  await userEvent.click(within(first).getByRole("button", { name: i18n.t("components:scanAssign") }));
  return {
    screen,
    name,
    assign: within(await screen.findByRole("dialog", { name: i18n.t("components:scanAssignTitle") })),
  };
}
export const AssignExistingStepPreservesRecipe: Story = {
  play: async ({ canvasElement }) => {
    const { assign, screen } = await openAssign(canvasElement);
    await expect(assign.getByRole("combobox", { name: "Recipe step" })).toHaveTextContent("Basecoat");
    await userEvent.click(assign.getByRole("button", { name: "Assign" }));
    const saved = JSON.parse(
      (await screen.findByTestId("saved-recipe")).textContent ?? "{}",
    ) as RecipeVariables;
    await expect(saved.id).toBe("mini");
    await expect(saved.entries.slice(0, 2)).toEqual(initialRecipe);
    await expect(saved.entries).toHaveLength(3);
    await expect(saved.entries[2].step).toBe("BASECOAT");
    await expect(saved.steps).toEqual(["BASECOAT", "DETAIL"]);
  },
};
export const AssignNewStagePreservesRecipe: Story = {
  play: async ({ canvasElement }) => {
    const { assign, screen } = await openAssign(canvasElement);
    await userEvent.click(assign.getByRole("combobox", { name: "Recipe step" }));
    await userEvent.click(await screen.findByRole("option", { name: "New step" }));
    await userEvent.click(assign.getByRole("combobox", { name: "Stage" }));
    await userEvent.click(await screen.findByRole("option", { name: "Highlight" }));
    await userEvent.click(assign.getByRole("button", { name: "Assign" }));
    const saved = JSON.parse(
      (await screen.findByTestId("saved-recipe")).textContent ?? "{}",
    ) as RecipeVariables;
    await expect(saved.entries.slice(0, 2)).toEqual(initialRecipe);
    await expect(saved.entries[2].step).toBe("HIGHLIGHT");
    await expect(saved.steps).toEqual(["BASECOAT", "DETAIL", "HIGHLIGHT"]);
  },
};
export const AttachSchemePreservesExisting: Story = {
  play: async ({ canvasElement }) => {
    const screen = await sample(canvasElement);
    await userEvent.click(screen.getByRole("button", { name: "By scheme" }));
    await userEvent.click(await screen.findByRole("button", { name: "Attach scheme" }));
    const saved = JSON.parse(
      (await screen.findByTestId("saved-schemes")).textContent ?? "{}",
    ) as SchemesVariables;
    await expect(saved.id).toBe("mini");
    await expect(saved.schemeIds).toEqual(["attached", "matched"]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Attach scheme" })).toBeDisabled());
  },
};
export const Loading: Story = {
  parameters: { queryDelay: 750 },
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    await expect(await screen.findByRole("status", { name: "Loading paint colors" })).toBeInTheDocument();
    await expect(
      await screen.findByRole("img", { name: "Paintwarden sample miniature" }),
    ).toBeInTheDocument();
  },
};
export const ReadFailureRetry: Story = {
  parameters: { fail: true },
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    await expect(await screen.findByText("Color connection interrupted")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await sample(canvasElement);
    await expect(screen.getByRole("list", { name: "Closest paint matches" })).toBeInTheDocument();
  },
};
export const ExternalImage: Story = {
  parameters: { external: true },
  play: async ({ canvasElement }) => {
    const screen = body(canvasElement);
    await expect(await screen.findByText(/This photo is hosted outside the vault/)).toBeInTheDocument();
    await expect(screen.getByRole("button", { name: "Sample at crosshair" })).toBeDisabled();
  },
};
export const EmptyColorIndex: Story = {
  parameters: { empty: true },
  play: async ({ canvasElement }) => {
    const screen = await sample(canvasElement);
    await expect(await screen.findByText("No paints with a usable color are available.")).toBeInTheDocument();
  },
};
export const GermanAssignment: Story = {
  parameters: { locale: "de" },
  play: async ({ canvasElement }) => {
    const { assign } = await openAssign(canvasElement);
    await expect(
      assign.getByRole("combobox", { name: i18n.t("components:scanRecipeStep") }),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
  },
};

async function narrowLayout(canvasElement: HTMLElement) {
  const screen = await sample(canvasElement);
  await expect(screen.getByRole("list", { name: i18n.t("components:scanMatches") })).toBeInTheDocument();
  const dialog = screen.getByRole("dialog", { name: "Swatch Scan" });
  await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
  await userEvent.click(screen.getByRole("button", { name: i18n.t("components:scanByScheme") }));
  await expect(await screen.findByText("Matched scheme")).toBeInTheDocument();
  await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
}
const narrow: Story["decorators"] = [
  (Story) => (
    <>
      <GlobalStyles styles={{ ".MuiDialog-paper": { maxWidth: 390 } }} />
      <Story />
    </>
  ),
];
export const GermanNarrow: Story = {
  parameters: { locale: "de" },
  decorators: narrow,
  play: ({ canvasElement }) => narrowLayout(canvasElement),
};
export const JapaneseNarrow: Story = {
  parameters: { locale: "ja" },
  decorators: narrow,
  play: ({ canvasElement }) => narrowLayout(canvasElement),
};
export const LongPaintNameNarrow: Story = {
  parameters: { longNames: true },
  decorators: narrow,
  play: ({ canvasElement }) => narrowLayout(canvasElement),
};
