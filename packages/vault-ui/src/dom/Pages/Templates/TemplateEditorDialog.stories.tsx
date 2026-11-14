import type { Operation } from "@apollo/client";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { MiniatureFixtureContext } from "../../graphql/miniature-list-hooks";
import { useVaultGraphQL } from "../../graphql/provider";
import { miniatures, paints, schemes, vault } from "../../storybook/fixtures";
import { StoryGraphQL } from "../../storybook/graphql";
import { fixtureMiniatureResponse } from "../../storybook/miniature-api-fixtures";
import { fixtureTemplateResponse } from "../../storybook/template-api-fixtures";
import type { MiniatureTemplate } from "../../types";

import { TemplateEditorDialog } from "./TemplateEditorDialog";

const template: MiniatureTemplate = {
  id: "user:fixture-template",
  name: "Reusable knight",
  manufacturer: "Fixture",
  faction: "Order",
  imageUrl: "",
  categories: ["My templates"],
  schemeCount: 1,
  paintCount: 1,
  kind: "user",
};
const revision = { epoch: "editor-story", seq: "1" };
const pageInfo = { hasNextPage: false, endCursor: null };
type FixtureOptions = {
  currentManufacturer?: string;
  repeatPaint?: boolean;
  failRecipeOnce?: boolean;
  failRefreshOnce?: boolean;
  failSaveOnce?: boolean;
  failSourceOnce?: boolean;
  paginatedMiniatures?: boolean;
  mutation?: ReturnType<typeof fn>;
  request?: ReturnType<typeof fn>;
};

function editorResponse(options: FixtureOptions = {}) {
  let recipeFailed = false;
  let recipeReads = 0;
  let saveFailed = false;
  let sourceFailed = false;
  const data = options.paginatedMiniatures
    ? {
        ...vault,
        miniatures: Array.from({ length: 49 }, (_, index) => ({
          ...miniatures.knight,
          id: `user:copy-${index}`,
          title: `Copy model ${String(index).padStart(2, "0")}`,
        })),
      }
    : vault;
  return (operation: Operation): Record<string, unknown> => {
    options.request?.(operation.operationName, operation.variables);
    if (operation.operationName === "TemplateSummaries")
      return fixtureTemplateResponse(data, operation.operationName, operation.variables, revision, [
        { ...template, manufacturer: options.currentManufacturer ?? template.manufacturer },
      ])!;
    if (operation.operationName === "SelectedTemplateRecipe") {
      recipeReads += 1;
      if ((options.failRecipeOnce || (options.failRefreshOnce && recipeReads > 1)) && !recipeFailed) {
        recipeFailed = true;
        throw new Error("Template recipe temporarily unavailable");
      }
      return {
        templateRecipe: {
          revision,
          templateId: template.id,
          schemes: {
            nodes: [{ schemeId: schemes.crimsonArmour.id, name: schemes.crimsonArmour.name }],
            pageInfo,
          },
          paints: {
            nodes: [
              {
                paintId: paints.crimson.id,
                paintName: paints.crimson.name,
                paintBrand: paints.crimson.brand,
                step: "BASECOAT",
                notes: "Preserved recipe notes",
                sortOrder: 0,
              },
              ...(options.repeatPaint
                ? [
                    {
                      paintId: paints.crimson.id,
                      paintName: paints.crimson.name,
                      paintBrand: paints.crimson.brand,
                      step: "HIGHLIGHT",
                      notes: "Separate highlight notes",
                      sortOrder: 1,
                    },
                  ]
                : []),
            ],
            pageInfo,
          },
        },
      };
    }
    if (operation.operationName === "TemplateSourceMiniature") {
      if (options.failSourceOnce && !sourceFailed) {
        sourceFailed = true;
        throw new Error("Source recipe temporarily unavailable");
      }
      return {
        miniature: {
          revision,
          miniature: data.miniatures.find((mini) => mini.id === operation.variables.id) ?? null,
          recipe: {
            nodes: [{ paint: paints.crimson, step: "BASECOAT", notes: "Source notes", sortOrder: 0 }],
            pageInfo,
          },
          schemes: { nodes: [{ scheme: schemes.crimsonArmour }], pageInfo },
        },
      };
    }
    if (operation.operationName === "PaintPickerOptions") {
      const search = String(operation.variables.search).toLowerCase();
      const excluded = operation.variables.excludeIds as string[];
      return {
        paintOptions: {
          revision,
          items: vault.catalog
            .filter(
              (paint) =>
                !excluded.includes(paint.id) && `${paint.brand} ${paint.name}`.toLowerCase().includes(search),
            )
            .map((paint) => ({
              ...paint,
              sourceName: paint.sourceName ?? null,
              sourceLogoUrl: null,
              inventory: null,
              available: false,
              hasActiveSubstitution: false,
              brokenReason: null,
              missingStock: true,
              brokenSubstitution: false,
              activeSubstitution: null,
            })),
        },
      };
    }
    if (
      operation.operationName === "CreateReusableTemplate" ||
      operation.operationName === "UpdateReusableTemplate"
    ) {
      options.mutation?.(operation.operationName, operation.variables);
      if (options.failSaveOnce && !saveFailed) {
        saveFailed = true;
        throw new Error("Template could not be saved");
      }
      const field =
        operation.operationName === "CreateReusableTemplate" ? "createTemplate" : "updateTemplate";
      return {
        [field]: {
          __typename: "TemplateMutationPayload",
          revision,
          templateId: template.id,
          clientMutationId: operation.variables.clientMutationId,
          invalidatedFamilies: ["TEMPLATES"],
        },
      };
    }
    const response = fixtureMiniatureResponse(data, operation.operationName, operation.variables, revision);
    if (!response) throw new Error(`Unexpected editor operation: ${operation.operationName}`);
    return response;
  };
}

function BackgroundInvalidationProbe() {
  const scope = useVaultGraphQL();
  useEffect(() => {
    const refresh = () => scope?.controller.refresh();
    document.addEventListener("template-editor-story-refresh", refresh);
    return () => document.removeEventListener("template-editor-story-refresh", refresh);
  }, [scope]);
  return null;
}

const meta = {
  title: "Templates/Editor",
  component: TemplateEditorDialog,
  args: { template, onSaved: fn(async () => undefined), onClose: fn() },
  decorators: [
    (Story, { parameters }) => (
      <MiniatureFixtureContext.Provider value={null}>
        <StoryGraphQL respond={editorResponse(parameters.editorFixture as FixtureOptions | undefined)}>
          <BackgroundInvalidationProbe />
          <Story />
        </StoryGraphQL>
      </MiniatureFixtureContext.Provider>
    ),
  ],
} satisfies Meta<typeof TemplateEditorDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LoadsSelectedRecipe: Story = {
  parameters: { editorFixture: { mutation: fn() } },
  play: async ({ args, parameters }) => {
    await within(document.body).findByDisplayValue("Preserved recipe notes");
    const dialog = within(await within(document.body).findByRole("dialog", { name: "Edit template" }));
    await expect(dialog.getByText(schemes.crimsonArmour.name)).toBeInTheDocument();
    await expect(dialog.getByRole("combobox", { name: "Step" })).toHaveTextContent("Basecoat");
    await userEvent.clear(dialog.getByLabelText("Name", { exact: false }));
    await userEvent.type(dialog.getByLabelText("Name", { exact: false }), "Edited knight");
    await userEvent.click(dialog.getByRole("button", { name: "Save template" }));
    await waitFor(() => expect(args.onSaved).toHaveBeenCalled());
    const fixture = parameters.editorFixture as FixtureOptions;
    await expect(fixture.mutation).toHaveBeenCalledWith(
      "UpdateReusableTemplate",
      expect.objectContaining({
        id: template.id,
        input: expect.objectContaining({
          name: "Edited knight",
          schemeIds: [schemes.crimsonArmour.id],
          paints: [
            { paintId: paints.crimson.id, step: "BASECOAT", notes: "Preserved recipe notes", sortOrder: 0 },
          ],
        }),
      }),
    );
  },
};

export const RecipeFailureRetry: Story = {
  parameters: { editorFixture: { failRecipeOnce: true } },
  play: async () => {
    const body = within(document.body);
    await waitFor(() => expect(body.getByText("Template recipe temporarily unavailable")).toBeVisible());
    await userEvent.click(body.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(body.getByDisplayValue("Preserved recipe notes")).toBeVisible());
  },
};

export const SaveFailureKeepsEdits: Story = {
  parameters: { editorFixture: { failSaveOnce: true } },
  play: async ({ args }) => {
    const body = within(document.body);
    await body.findByDisplayValue("Preserved recipe notes");
    await userEvent.type(body.getByLabelText(paints.crimson.name), " plus edits");
    await userEvent.click(body.getByRole("button", { name: "Save template" }));
    await expect(await body.findByText("Template could not be saved")).toBeVisible();
    await expect(body.getByDisplayValue("Preserved recipe notes plus edits")).toBeVisible();
    await userEvent.click(body.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(args.onSaved).toHaveBeenCalled());
  },
};

export const FromScratchSearchesOptions: Story = {
  args: { template: null },
  parameters: { editorFixture: { mutation: fn(), request: fn() } },
  play: async ({ args, parameters }) => {
    const body = within(document.body);
    await userEvent.type(body.getByLabelText("Name", { exact: false }), "Scratch setup");
    await userEvent.type(body.getByRole("combobox", { name: "Schemes" }), "ocean");
    await userEvent.click(await body.findByRole("option", { name: schemes.oceanCloak.name }));
    await userEvent.type(body.getByRole("combobox", { name: "Required paints" }), "gold");
    await userEvent.click(
      await body.findByRole("option", { name: `${paints.gold.brand} · ${paints.gold.name}` }),
    );
    await userEvent.type(body.getByLabelText(paints.gold.name), "Gold trim");
    await userEvent.click(body.getByRole("button", { name: "Save template" }));
    await waitFor(() => expect(args.onSaved).toHaveBeenCalled());
    const fixture = parameters.editorFixture as FixtureOptions;
    await expect(fixture.mutation).toHaveBeenCalledWith(
      "CreateReusableTemplate",
      expect.objectContaining({
        input: expect.objectContaining({
          name: "Scratch setup",
          schemeIds: [schemes.oceanCloak.id],
          paints: [{ paintId: paints.gold.id, step: "OTHER", notes: "Gold trim", sortOrder: 0 }],
        }),
      }),
    );
    await expect(fixture.request).not.toHaveBeenCalledWith("TemplateSourceMiniature", expect.anything());
  },
};

export const CopyMiniatureOnDemandAndReset: Story = {
  args: { template: null },
  parameters: { editorFixture: { failSourceOnce: true, mutation: fn(), request: fn() } },
  play: async ({ args, parameters }) => {
    const body = within(document.body);
    const fixture = parameters.editorFixture as FixtureOptions;
    await expect(fixture.request).not.toHaveBeenCalledWith("TemplateSourceMiniature", expect.anything());
    const picker = body.getByRole("combobox", { name: "Start from miniature" });
    await userEvent.type(picker, "knight");
    await userEvent.click(await body.findByRole("option", { name: miniatures.knight.title }));
    await expect(await body.findByText("Source recipe temporarily unavailable")).toBeVisible();
    await expect(body.getByRole("button", { name: "Save template" })).toBeDisabled();
    await userEvent.click(body.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(body.getByRole("textbox", { name: "Name" })).toHaveValue(miniatures.knight.title),
    );
    await expect(await body.findByDisplayValue(miniatures.knight.manufacturer)).toBeVisible();
    await expect(body.getByDisplayValue(miniatures.knight.faction)).toBeVisible();
    await expect(body.queryByRole("combobox", { name: "Required paints" })).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "Start from scratch" }));
    await expect(await body.findByRole("combobox", { name: "Required paints" })).toBeVisible();
    await userEvent.type(picker, "knight");
    await userEvent.click(await body.findByRole("option", { name: miniatures.knight.title }));
    await expect(await body.findByText(/Copies 1 scheme and 1 paint step/)).toBeVisible();
    await userEvent.click(body.getByRole("button", { name: "Save template" }));
    await waitFor(() => expect(args.onSaved).toHaveBeenCalled());
    await expect(fixture.mutation).toHaveBeenCalledWith(
      "CreateReusableTemplate",
      expect.objectContaining({
        input: expect.objectContaining({
          name: miniatures.knight.title,
          sourceMiniatureId: miniatures.knight.id,
        }),
      }),
    );
  },
};

export const PaginatedCopySearch: Story = {
  args: { template: null },
  parameters: { editorFixture: { paginatedMiniatures: true, request: fn() } },
  play: async ({ parameters }) => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole("button", { name: "Load more miniatures" }));
    await userEvent.click(body.getByRole("combobox", { name: "Start from miniature" }));
    await userEvent.click(await body.findByRole("option", { name: "Copy model 48" }));
    await expect(await body.findByDisplayValue(miniatures.knight.manufacturer)).toBeVisible();
    const fixture = parameters.editorFixture as FixtureOptions;
    await expect(fixture.request).toHaveBeenCalledWith(
      "MiniatureList",
      expect.objectContaining({ after: "48" }),
    );
    await expect(fixture.request).toHaveBeenCalledWith(
      "TemplateSourceMiniature",
      expect.objectContaining({ id: "user:copy-48" }),
    );
  },
};

export const BackgroundRefreshKeepsUnsavedRecipe: Story = {
  parameters: { editorFixture: { failRefreshOnce: true, request: fn() } },
  play: async () => {
    const body = within(document.body);
    await body.findByDisplayValue("Preserved recipe notes");
    await userEvent.type(body.getByRole("textbox", { name: "Name" }), " unsaved");
    await userEvent.type(body.getByLabelText(paints.crimson.name), " unsaved");
    document.dispatchEvent(new Event("template-editor-story-refresh"));
    await waitFor(() => expect(body.getByText("Template recipe temporarily unavailable")).toBeVisible());
    await expect(body.getByRole("textbox", { name: "Name" })).toHaveValue("Reusable knight unsaved");
    await expect(body.getByDisplayValue("Preserved recipe notes unsaved")).toBeVisible();
    await userEvent.click(body.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(body.queryByText("Template recipe temporarily unavailable")).not.toBeInTheDocument(),
    );
    await expect(body.getByRole("textbox", { name: "Name" })).toHaveValue("Reusable knight unsaved");
    await expect(body.getByDisplayValue("Preserved recipe notes unsaved")).toBeVisible();
  },
};

export const RepeatedPaintSteps: Story = {
  parameters: { editorFixture: { repeatPaint: true, mutation: fn() } },
  play: async ({ parameters, args }) => {
    const body = within(document.body);
    await body.findByDisplayValue("Separate highlight notes");
    await expect(body.getByDisplayValue("Preserved recipe notes")).toBeInTheDocument();
    await expect(body.getAllByRole("combobox", { name: "Step" })).toHaveLength(2);
    await userEvent.click(body.getByRole("button", { name: "Save template" }));
    await waitFor(() => expect(args.onSaved).toHaveBeenCalled());
    const fixture = parameters.editorFixture as FixtureOptions;
    await expect(fixture.mutation).toHaveBeenCalledWith(
      "UpdateReusableTemplate",
      expect.objectContaining({
        input: expect.objectContaining({
          paints: [
            { paintId: paints.crimson.id, step: "BASECOAT", notes: "Preserved recipe notes", sortOrder: 0 },
            {
              paintId: paints.crimson.id,
              step: "HIGHLIGHT",
              notes: "Separate highlight notes",
              sortOrder: 1,
            },
          ],
        }),
      }),
    );
  },
};

export const StaleCardMetadataNeverInitializesFields: Story = {
  args: { template: { ...template, manufacturer: "Stale card manufacturer" } },
  parameters: { editorFixture: { currentManufacturer: "Latest committed manufacturer" } },
  play: async () => {
    const body = within(document.body);
    await waitFor(() => expect(body.getByDisplayValue("Latest committed manufacturer")).toBeVisible());
    await expect(body.queryByDisplayValue("Stale card manufacturer")).not.toBeInTheDocument();
  },
};
