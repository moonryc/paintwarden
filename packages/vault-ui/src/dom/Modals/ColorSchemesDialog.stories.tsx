import { ApolloClient, ApolloLink } from "@apollo/client";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState, type ReactNode } from "react";
import { Observable } from "rxjs";
import { expect, fn, screen, waitFor } from "storybook/test";

import { createVaultCache } from "../graphql/cache";
import { VaultInvalidationController } from "../graphql/invalidation";
import { VaultGraphQLContext } from "../graphql/provider";
import { createVaultStore } from "../store/vault-store";
import { VaultStoreProvider } from "../store/VaultStoreProvider";
import { paints } from "../storybook/fixtures";
import type { Api } from "../types";
import { emptyState } from "../utils/constants";

import { ColorSchemesDialog } from "./ColorSchemesDialog";

const paint = {
  ...paints.skyBlue,
  __typename: "Paint",
  id: "projected-only-paint",
  name: "Projected-only sky blue",
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
const image =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='180'%3E%3Crect width='300' height='180' fill='%23223399'/%3E%3C/svg%3E";
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
const entries = [
  {
    ...baseEntry,
    id: "start",
    kind: "DIVIDER",
    sortOrder: 0,
    label: "Start",
    tone: "MILESTONE",
    role: "START",
  },
  { ...baseEntry, id: "step", kind: "DIVIDER", sortOrder: 1, label: "BASECOAT", tone: "SECTION" },
  { ...baseEntry, id: "paint", kind: "PAINT", sortOrder: 2, paint },
  {
    ...baseEntry,
    id: "legacy",
    kind: "DIVIDER",
    sortOrder: 3,
    label: "Legacy custom stage",
    tone: "SECTION",
  },
  {
    ...baseEntry,
    id: "image",
    kind: "IMAGE",
    sortOrder: 4,
    imageUrl: image,
    thumbnailUrl: image,
    imageType: "FINISHED",
    method: "BRUSH",
  },
  {
    ...baseEntry,
    id: "complete",
    kind: "DIVIDER",
    sortOrder: 5,
    label: "Complete",
    tone: "MILESTONE",
    role: "COMPLETE",
  },
];
const mutation = fn<(name: string, variables: Record<string, unknown>) => Promise<void>>(async () => {});
const rest = fn<Api>(async () => {
  throw new Error("Scheme dialogs must not request a snapshot or REST mutation");
});
type FixtureOptions = { readFailure?: boolean; system?: boolean; missing?: boolean };

function Connection({ children, options = {} }: { children: ReactNode; options?: FixtureOptions }) {
  const [store] = useState(() => createVaultStore({ api: rest, notify: fn() }));
  const [fixture] = useState(() => {
    const controller = new VaultInvalidationController();
    let seq = 1;
    let failed = !!options.readFailure;
    const revision = () => ({ epoch: "color-scheme-story", seq: String(seq) });
    const refresh = () => {
      seq += 1;
      failed = true;
      controller.committed(revision(), ["SCHEMES"]);
    };
    const client = new ApolloClient({
      cache: createVaultCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            const name = operation.operationName ?? "";
            if (name === "MiniatureSchemeDetails") {
              if (failed) {
                failed = false;
                observer.error(new Error("Scheme refresh interrupted"));
                return;
              }
              const after = !!operation.variables.after;
              observer.next({
                data: {
                  miniatureScheme: {
                    revision: revision(),
                    scheme: options.missing
                      ? null
                      : {
                          __typename: "MiniatureScheme",
                          id: "projected-scheme",
                          name: seq === 1 ? "Projected scheme" : "Background scheme name",
                          category: "BLUE",
                          isSystem: !!options.system,
                          sourceName: options.system ? "Example source" : null,
                          sourceLogoUrl: null,
                          paintCount: 1,
                          availableCount: 0,
                          previewSwatches: [{ paintId: paint.id, colorHex: paint.colorHex }],
                          previewSwatchesTruncated: false,
                          imageUrl: image,
                        },
                    entries: {
                      nodes: options.missing ? [] : entries.slice(after ? 3 : 0, after ? undefined : 3),
                      totalCount: options.missing ? 0 : entries.length,
                      pageInfo: {
                        hasNextPage: !options.missing && !after,
                        endCursor: !after ? "page-two" : null,
                      },
                    },
                  },
                },
              });
              observer.complete();
            } else if (name === "PaintPickerOptions") {
              observer.next({ data: { paintOptions: { revision: revision(), items: [paint] } } });
              observer.complete();
            } else if (["CreateColorScheme", "UpdateColorScheme", "DeleteColorScheme"].includes(name)) {
              void mutation(name, operation.variables).then(
                () => {
                  seq += 1;
                  const field =
                    name === "CreateColorScheme"
                      ? "createScheme"
                      : name === "UpdateColorScheme"
                        ? "updateScheme"
                        : "deleteScheme";
                  observer.next({
                    data: {
                      [field]: {
                        __typename: "SchemeMutationPayload",
                        schemeId: "projected-scheme",
                        revision: revision(),
                        invalidatedFamilies: ["SCHEMES"],
                        clientMutationId: operation.variables.clientMutationId,
                      },
                    },
                  });
                  observer.complete();
                },
                (error: unknown) => observer.error(error),
              );
            } else observer.error(new Error(`Unexpected operation ${name}`));
          }),
      ),
    });
    return { scope: { client, controller }, refresh };
  });
  useEffect(() => {
    window.addEventListener("color-scheme-background-refresh", fixture.refresh);
    return () => {
      window.removeEventListener("color-scheme-background-refresh", fixture.refresh);
      fixture.scope.client.stop();
      fixture.scope.controller.dispose();
    };
  }, [fixture]);
  return (
    <VaultGraphQLContext.Provider value={fixture.scope}>
      <VaultStoreProvider store={store}>{children}</VaultStoreProvider>
    </VaultGraphQLContext.Provider>
  );
}

const meta = {
  title: "Dialogs/ColorSchemesDialog",
  component: ColorSchemesDialog,
  args: { initialId: "projected-scheme", onClose: fn() },
  parameters: { vault: emptyState },
  decorators: [
    (Story, context) => (
      <Connection options={context.parameters.schemeFixture}>
        <Story />
      </Connection>
    ),
  ],
  beforeEach: () => {
    mutation.mockClear();
    rest.mockClear();
  },
} satisfies Meta<typeof ColorSchemesDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FullyPagedDraftSurvivesRefresh: Story = {
  play: async ({ args, userEvent }) => {
    await waitFor(() => expect(screen.getByText("Legacy custom stage")).toBeVisible());
    await expect(screen.getByText(paint.name)).toBeVisible();
    await expect(screen.getByRole("img", { name: "Projected scheme FINISHED example" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Edit scheme" }));
    const name = screen.getByRole("textbox", { name: "Scheme name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Unsaved projected draft");
    window.dispatchEvent(new Event("color-scheme-background-refresh"));
    await expect(await screen.findByRole("alert")).toHaveTextContent("Scheme refresh interrupted");
    await expect(name).toHaveValue("Unsaved projected draft");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    await expect(name).toHaveValue("Unsaved projected draft");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(args.onClose).toHaveBeenCalledOnce());
    await expect(mutation).toHaveBeenCalledWith(
      "UpdateColorScheme",
      expect.objectContaining({
        id: "projected-scheme",
        input: expect.objectContaining({
          name: "Unsaved projected draft",
          entries: expect.arrayContaining([
            expect.objectContaining({ id: "legacy", label: "Legacy custom stage" }),
            expect.objectContaining({
              id: "image",
              imageUrl: image,
              thumbnailUrl: image,
              imageType: "FINISHED",
              method: "BRUSH",
            }),
          ]),
        }),
      }),
    );
    await expect(rest).not.toHaveBeenCalled();
  },
};

export const ReadFailureAndRetry: Story = {
  parameters: { schemeFixture: { readFailure: true } },
  play: async ({ userEvent }) => {
    await expect(await screen.findByRole("alert")).toHaveTextContent("Scheme refresh interrupted");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText(paint.name)).toBeVisible());
    await waitFor(() => expect(screen.getByText("Legacy custom stage")).toBeVisible());
    await expect(rest).not.toHaveBeenCalled();
  },
};

export const CatalogReadOnly: Story = {
  parameters: { schemeFixture: { system: true } },
  play: async () => {
    await waitFor(() => expect(screen.getByText(paint.name)).toBeVisible());
    await expect(screen.getByText("Example source")).toBeVisible();
    await expect(screen.queryByRole("button", { name: "Edit scheme" })).not.toBeInTheDocument();
    await expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    await expect(mutation).not.toHaveBeenCalled();
  },
};

export const DeletedScheme: Story = {
  parameters: { schemeFixture: { missing: true } },
  play: async () => {
    await expect(await screen.findByRole("status")).toHaveTextContent(
      "This color scheme is no longer available.",
    );
    await expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  },
};

export const CreateWithoutSnapshot: Story = {
  args: { initialId: null },
  play: async ({ args, userEvent }) => {
    await expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Scheme name" }), "New Apollo palette");
    await userEvent.click(screen.getByRole("combobox", { name: "Color category" }));
    await userEvent.click(screen.getByRole("option", { name: "Blue" }));
    await userEvent.click(screen.getByRole("button", { name: "Step" }));
    await userEvent.click(screen.getByRole("button", { name: "Add step" }));
    await userEvent.click(screen.getByRole("button", { name: "Add paint" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Add paint" }), "Projected");
    await userEvent.click(await screen.findByRole("option", { name: /Projected-only sky blue/ }));
    await expect(screen.getByText(paint.name)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(args.onClose).toHaveBeenCalledOnce());
    await expect(mutation).toHaveBeenCalledWith(
      "CreateColorScheme",
      expect.objectContaining({
        input: expect.objectContaining({
          name: "New Apollo palette",
          category: "BLUE",
          entries: expect.arrayContaining([
            expect.objectContaining({ type: "PAINT", paintId: paint.id }),
            expect.objectContaining({ type: "DIVIDER", role: "START" }),
            expect.objectContaining({ type: "DIVIDER", role: "COMPLETE" }),
          ]),
        }),
      }),
    );
    await expect(rest).not.toHaveBeenCalled();
  },
};
