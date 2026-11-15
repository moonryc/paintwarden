import { ApolloClient, ApolloLink } from "@apollo/client";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { Observable } from "rxjs";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { createVaultCache } from "../graphql/cache";
import { VaultInvalidationController } from "../graphql/invalidation";
import { VaultGraphQLContext } from "../graphql/provider";

import { ApolloProjectSchemeDialog } from "./ApolloProjectSchemeDialog";
import { ApolloSchemePickerDialog } from "./ApolloSchemePickerDialog";
import { SchemePickerDialogView, type SchemePickerOption } from "./SchemePickerDialog";

const category = "BROWN";
const summary = (id: string, name: string) => ({
  __typename: "MiniatureScheme" as const,
  id,
  name,
  category,
  isSystem: false,
  sourceName: null,
  sourceLogoUrl: null,
  paintCount: 1,
  availableCount: 0,
  previewSwatches: [{ paintId: "projected-paint", colorHex: "#994422" }],
  previewSwatchesTruncated: false,
  imageUrl: null,
});
const first = summary("scheme-a", "Projected bronze armor");
const second = summary("scheme-b", "Projected blue cloth");
const third = summary("scheme-c", "Projected snow cloak");
const image =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='180'%3E%3Crect width='300' height='180' fill='%23994422'/%3E%3C/svg%3E";
const paint = {
  __typename: "Paint" as const,
  id: "projected-paint",
  name: "Projected copper",
  brand: "Example",
  range: "Base",
  colorHex: "#994422",
  sourceUrl: null,
  isCustom: false,
  sourceName: null,
  sourceLogoUrl: null,
  inventory: null,
  available: false,
  hasActiveSubstitution: false,
  brokenReason: null,
  missingStock: true,
  brokenSubstitution: false,
  activeSubstitution: null,
};
const baseEntry = {
  paint: null,
  label: null,
  tone: null,
  role: null,
  imageUrl: null,
  thumbnailUrl: null,
  imageType: null,
  method: null,
};

function SchemeConnection({ children }: { children: ReactNode }) {
  const [scope] = useState(() => ({
    controller: new VaultInvalidationController(),
    client: new ApolloClient({
      cache: createVaultCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            const revision = { epoch: "scheme-story", seq: "1" };
            if (operation.operationName === "SchemePickerOptions") {
              const search = String(operation.variables.search ?? "").toLowerCase();
              const searching = !!search;
              const after = operation.variables.after as unknown;
              observer.next({
                data: {
                  schemeOptions: {
                    revision,
                    nodes: searching
                      ? [third].filter((row) => row.name.toLowerCase().includes(search))
                      : after
                        ? [second]
                        : [first],
                    totalCount: searching ? 1 : 2,
                    // Server facet order is not the product's color-category order.
                    categoryCounts: [
                      { key: "BLUE", label: "Blue", count: 1 },
                      { key: "BROWN", label: "Brown", count: 1 },
                      { key: "RED", label: "Red", count: 1 },
                    ],
                    pageInfo: {
                      hasNextPage: !searching && !after,
                      endCursor: !searching && !after ? "next-page" : null,
                    },
                  },
                },
              });
            } else if (operation.operationName === "MiniatureSchemeDetails") {
              observer.next({
                data: {
                  miniatureScheme: {
                    revision,
                    scheme: first,
                    entries: {
                      nodes: [
                        {
                          ...baseEntry,
                          id: "start",
                          kind: "DIVIDER",
                          sortOrder: 0,
                          label: "Start",
                          tone: "MILESTONE",
                          role: "START",
                        },
                        {
                          ...baseEntry,
                          id: "legacy-divider",
                          kind: "DIVIDER",
                          sortOrder: 1,
                          label: "Legacy glaze",
                          tone: "SECTION",
                        },
                        { ...baseEntry, id: "paint-row", kind: "PAINT", sortOrder: 2, paint },
                        { ...baseEntry, id: "reference-image", kind: "IMAGE", sortOrder: 3, imageUrl: image },
                        {
                          ...baseEntry,
                          id: "complete",
                          kind: "DIVIDER",
                          sortOrder: 4,
                          label: "Complete",
                          tone: "MILESTONE",
                          role: "COMPLETE",
                        },
                      ],
                      totalCount: 5,
                      pageInfo: { hasNextPage: false, endCursor: null },
                    },
                  },
                },
              });
            } else {
              observer.error(new Error(`Unexpected operation ${operation.operationName}`));
              return;
            }
            observer.complete();
          }),
      ),
    }),
  }));
  return <VaultGraphQLContext.Provider value={scope}>{children}</VaultGraphQLContext.Provider>;
}

const meta = {
  title: "Modals/Apollo scheme dialogs",
  component: ApolloSchemePickerDialog,
  args: { attachedIds: ["already-attached"], onSave: fn(async () => undefined), onClose: fn() },
  decorators: [
    (Story) => (
      <SchemeConnection>
        <Story />
      </SchemeConnection>
    ),
  ],
} satisfies Meta<typeof ApolloSchemePickerDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const StageAcrossSearchAndPages: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(await screen.findByRole("button", { name: first.name }));
    const list = screen.getByRole("list", { name: "Color schemes" });
    list.scrollTop = list.scrollHeight;
    list.dispatchEvent(new Event("scroll", { bubbles: true }));
    await expect(screen.queryByRole("button", { name: "Load more schemes" })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: second.name }));
    await userEvent.type(screen.getByRole("textbox", { name: "Search color schemes" }), "snow");
    await userEvent.click(await screen.findByRole("button", { name: third.name }));
    await expect(screen.getByRole("list", { name: "Schemes to add" })).toHaveTextContent(first.name);
    await expect(screen.getByRole("list", { name: "Schemes to add" })).toHaveTextContent(second.name);
    await userEvent.clear(screen.getByRole("textbox", { name: "Search color schemes" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Filter schemes" }));
    await userEvent.click(screen.getByRole("option", { name: "Selected (3)" }));
    const selectedList = within(screen.getByRole("list", { name: "Color schemes" }));
    await expect(selectedList.getByRole("button", { name: first.name })).toBeVisible();
    await expect(selectedList.getByRole("button", { name: second.name })).toBeVisible();
    await expect(selectedList.getByRole("button", { name: third.name })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Add 3 schemes" }));
    await expect(args.onSave).toHaveBeenCalledWith(["already-attached", first.id, second.id, third.id]);
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const FiltersPreserveCategoryOrder: Story = {
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await screen.findByRole("button", { name: first.name });
    await userEvent.click(screen.getByRole("combobox", { name: "Filter schemes" }));
    await expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "All (3)",
      "Selected (0)",
      "Red (1)",
      "Blue (1)",
      "Brown (1)",
    ]);
    await userEvent.keyboard("{Escape}");
  },
};

export const AttachedSchemePreviewAndImages: Story = {
  render: () => <ApolloProjectSchemeDialog schemeId={first.id} onClose={fn()} />,
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(screen.getByText("Projected copper")).toBeVisible());
    await expect(screen.getByText("Legacy glaze")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: `View ${first.name} reference image` }));
    await userEvent.click(await screen.findByRole("button", { name: "Zoom in" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset image view" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Close image viewer" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Edit scheme" }));
    await expect(await screen.findByRole("textbox", { name: "Scheme name" })).toHaveValue(first.name);
    await waitFor(() => expect(screen.getByText("Legacy glaze (existing)")).toBeVisible());
  },
};

const options: SchemePickerOption[] = Array.from({ length: 150 }, (_, index) => ({
  id: `virtual-${index}`,
  name: `Virtual scheme ${String(index).padStart(3, "0")}`,
  category,
  paintCount: 3,
  availableCount: 2,
  colors: ["#994422", "#223399"],
}));
export const VirtualKeyboardSelection: Story = {
  render: (args) => <SchemePickerDialogView {...args} schemes={options} />,
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    const firstRow = await screen.findByRole("button", { name: "Virtual scheme 000" });
    firstRow.focus();
    for (let index = 0; index < 18; index += 1) await userEvent.tab();
    await expect(screen.getByRole("button", { name: "Virtual scheme 018" })).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect(screen.getByRole("list", { name: "Schemes to add" })).toHaveTextContent(
      "Virtual scheme 018",
    );
  },
};

export const Loading: Story = {
  render: (args) => <SchemePickerDialogView {...args} schemes={[]} loading />,
  play: async () => {
    const dialog = await within(document.body).findByRole("dialog", { name: "Color schemes" });
    const field = within(dialog).getByRole("combobox", { name: "Filter schemes" });
    await expect(field).toHaveAttribute("aria-disabled", "true");
    await expect(field).toHaveTextContent("Loading…");
    await expect(within(dialog).getAllByRole("status")).toHaveLength(1);
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
  },
};
export const RetryReadFailure: Story = {
  render: (args) => (
    <SchemePickerDialogView
      {...args}
      schemes={[]}
      error={new Error("Connection interrupted")}
      onRetry={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await expect(screen.getByRole("alert")).toHaveTextContent("Connection interrupted");
    await expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  },
};

const failedSave = fn(async () => undefined);
export const SaveFailureKeepsPicks: Story = {
  args: { onSave: failedSave },
  beforeEach: () => {
    failedSave
      .mockReset()
      .mockRejectedValueOnce(new Error("Could not save picks"))
      .mockResolvedValue(undefined);
  },
  render: (args) => <SchemePickerDialogView {...args} schemes={options.slice(0, 2)} />,
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(await screen.findByRole("button", { name: "Virtual scheme 000" }));
    await userEvent.click(screen.getByRole("button", { name: "Add scheme" }));
    await expect(await screen.findByRole("alert")).toHaveTextContent("Could not save picks");
    await expect(args.onClose).not.toHaveBeenCalled();
    await expect(screen.getByRole("list", { name: "Schemes to add" })).toHaveTextContent(
      "Virtual scheme 000",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add scheme" }));
    await expect(args.onSave).toHaveBeenCalledTimes(2);
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};
