import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Observable } from "rxjs";
import { expect, fn, screen, waitFor } from "storybook/test";

import { VaultInvalidationController } from "../graphql/invalidation";
import { VaultGraphQLContext } from "../graphql/provider";
import { createVaultStore } from "../store/vault-store";
import { VaultStoreProvider } from "../store/VaultStoreProvider";
import { paints } from "../storybook/fixtures";
import type { SchemeOrderEntry } from "../types";
import { emptyState } from "../utils/constants";

import { ProjectSchemeEditor } from "./ProjectSchemeEditor";

const scheme = {
  id: "user:project-palette",
  name: "Project palette",
  category: "RED",
  isSystem: false,
} as const;
const entries: SchemeOrderEntry[] = [
  { type: "DIVIDER", id: "start", label: "START", tone: "MILESTONE", role: "START", sortOrder: 0 },
  { type: "DIVIDER", id: "step", label: "BASECOAT", tone: "SECTION", sortOrder: 1 },
  { type: "PAINT", id: "black", paintId: paints.black.id, sortOrder: 2 },
  { type: "PAINT", id: "crimson", paintId: paints.crimson.id, sortOrder: 3 },
  { type: "DIVIDER", id: "complete", label: "COMPLETE", tone: "MILESTONE", role: "COMPLETE", sortOrder: 4 },
];
type MutationVariables = { id?: string; input?: { name: string; category: string; entries: unknown[] } };
const saveMutation = fn<(variables: MutationVariables) => Promise<unknown>>(async () => ({}));
const deleteMutation = fn<(variables: MutationVariables) => Promise<unknown>>(async () => ({}));
const notify = fn();

function Actions({ children }: { children: ReactNode }) {
  const [store] = useState(() => createVaultStore({ notify }));
  const [scope] = useState(() => ({
    controller: new VaultInvalidationController(),
    client: new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            const remove = operation.operationName === "DeleteColorScheme";
            const field = remove
              ? "deleteScheme"
              : operation.operationName === "CreateColorScheme"
                ? "createScheme"
                : "updateScheme";
            void (remove ? deleteMutation : saveMutation)(operation.variables).then(
              () => {
                observer.next({
                  data: {
                    [field]: {
                      __typename: "SchemeMutationPayload",
                      schemeId: operation.variables.id ?? "created-scheme",
                      revision: { epoch: "storybook", seq: "2" },
                      invalidatedFamilies: ["SCHEMES"],
                      clientMutationId: operation.variables.clientMutationId,
                    },
                  },
                });
                observer.complete();
              },
              (error: unknown) => observer.error(error),
            );
          }),
      ),
    }),
  }));
  useEffect(
    () => () => {
      scope.client.stop();
      scope.controller.dispose();
    },
    [scope],
  );
  return (
    <VaultGraphQLContext.Provider value={scope}>
      <VaultStoreProvider store={store}>{children}</VaultStoreProvider>
    </VaultGraphQLContext.Provider>
  );
}

const meta = {
  title: "Dialogs/ProjectSchemeEditor",
  component: ProjectSchemeEditor,
  args: { scheme, entries, paints: [paints.black, paints.crimson], onClose: fn() },
  decorators: [
    (Story) => (
      <Actions>
        <Story />
      </Actions>
    ),
  ],
  argTypes: { scheme: { control: false }, entries: { control: false }, paints: { control: false } },
  // Deliberately no snapshot scheme/catalog: the supplied projection is authoritative.
  parameters: { vault: emptyState, docs: { story: { inline: false, iframeHeight: 760 } } },
} satisfies Meta<typeof ProjectSchemeEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EditAndSave: Story = {
  beforeEach: () => {
    saveMutation.mockReset().mockResolvedValue({});
    notify.mockClear();
  },
  play: async ({ args, userEvent }) => {
    await expect(screen.queryByRole("button", { name: "Reorder START" })).not.toBeInTheDocument();
    await expect(screen.queryByRole("button", { name: "Remove COMPLETE milestone" })).not.toBeInTheDocument();
    await expect(screen.getByRole("button", { name: "Remove BASECOAT step" })).toBeDisabled();
    const save = screen.getByRole("button", { name: "Save" });
    await userEvent.clear(screen.getByRole("textbox", { name: "Scheme name" }));
    await expect(save).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Scheme name" }), "Edited palette");
    await userEvent.click(screen.getByRole("combobox", { name: "Color category" }));
    await userEvent.click(screen.getByRole("option", { name: "Blue" }));
    // Non-text drag handles support keyboard reordering in both directions.
    const handle = screen.getByRole("button", { name: `Reorder ${paints.black.name}` });
    handle.focus();
    await userEvent.keyboard("[Space]");
    await userEvent.keyboard("[ArrowDown][ArrowDown]");
    await userEvent.keyboard("[Space]");
    await waitFor(() => expect(screen.getAllByRole("listitem")[2]).toHaveTextContent(paints.crimson.name));
    handle.focus();
    await userEvent.keyboard("[Space]");
    await userEvent.keyboard("[ArrowUp]");
    await userEvent.keyboard("[Space]");
    await waitFor(() => expect(screen.getAllByRole("listitem")[2]).toHaveTextContent(paints.black.name));
    await userEvent.click(save);
    await waitFor(() => expect(saveMutation).toHaveBeenCalledOnce());
    await expect(saveMutation.mock.calls[0][0]).toMatchObject({
      id: scheme.id,
      input: {
        name: "Edited palette",
        category: "BLUE",
        entries: entries.map((entry) =>
          entry.type === "PAINT"
            ? { type: "PAINT", paintId: entry.paintId }
            : entry.type === "DIVIDER"
              ? {
                  type: "DIVIDER",
                  id: entry.id,
                  label: entry.label,
                  tone: entry.tone,
                  role: entry.role ?? null,
                }
              : entry,
        ),
      },
    });
    await expect(notify).toHaveBeenCalledWith("Color scheme updated");
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

export const SaveErrorAndRetry: Story = {
  beforeEach: () => {
    saveMutation
      .mockReset()
      .mockRejectedValueOnce(new Error("Save failed; please retry"))
      .mockResolvedValue({});
  },
  play: async ({ args, userEvent }) => {
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await expect(await screen.findByRole("alert")).toHaveTextContent("Save failed; please retry");
    await expect(args.onClose).not.toHaveBeenCalled();
    await expect(screen.getByRole("textbox", { name: "Scheme name" })).toHaveValue(scheme.name);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(saveMutation).toHaveBeenCalledTimes(2));
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

export const DeleteErrorAndRetry: Story = {
  beforeEach: () => {
    deleteMutation
      .mockReset()
      .mockRejectedValueOnce(new Error("Delete failed; please retry"))
      .mockResolvedValue({});
    notify.mockClear();
  },
  play: async ({ args, userEvent }) => {
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await expect(deleteMutation).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    await expect(await screen.findByRole("alert")).toHaveTextContent("Delete failed; please retry");
    await expect(args.onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(deleteMutation).toHaveBeenCalledTimes(2));
    await expect(deleteMutation).toHaveBeenLastCalledWith(expect.objectContaining({ id: scheme.id }));
    await expect(notify).toHaveBeenCalledWith("Color scheme deleted");
    await expect(args.onClose).toHaveBeenCalledOnce();
    // Deleting closes the editor; it never changes into the legacy create-new flow.
    await expect(screen.getByRole("textbox", { name: "Scheme name" })).toHaveValue(scheme.name);
  },
};

function RefetchFixture(props: ComponentProps<typeof ProjectSchemeEditor>) {
  const [refetched, setRefetched] = useState(false);
  useEffect(() => {
    const refetch = () => setRefetched(true);
    window.addEventListener("project-scheme-refetch", refetch);
    return () => window.removeEventListener("project-scheme-refetch", refetch);
  }, []);
  return (
    <div data-testid="projection" data-refetched={refetched}>
      <ProjectSchemeEditor
        {...props}
        scheme={refetched ? { ...props.scheme, name: "Background name" } : props.scheme}
        entries={refetched ? [] : props.entries}
        paints={refetched ? [] : props.paints}
      />
    </div>
  );
}
export const PreserveDraft: Story = {
  render: (args) => <RefetchFixture {...args} />,
  play: async ({ userEvent }) => {
    await userEvent.clear(screen.getByRole("textbox", { name: "Scheme name" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Scheme name" }), "Unsaved draft");
    window.dispatchEvent(new Event("project-scheme-refetch"));
    await waitFor(() => expect(screen.getByTestId("projection")).toHaveAttribute("data-refetched", "true"));
    await expect(screen.getByRole("textbox", { name: "Scheme name" })).toHaveValue("Unsaved draft");
    await expect(screen.getByText(paints.black.name)).toBeVisible();
    await expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  },
};

const serverPaint = {
  ...paints.skyBlue,
  id: "server:paint",
  name: "Server-only sky blue",
  sourceName: null,
  sourceLogoUrl: null,
  inventory: null,
  available: true,
  hasActiveSubstitution: false,
  brokenReason: null,
  missingStock: false,
  brokenSubstitution: false,
  activeSubstitution: null,
};
function ApolloPicker({ children }: { children: ReactNode }) {
  const [scope] = useState(() => ({
    controller: new VaultInvalidationController(),
    client: new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            const excluded = operation.variables.excludeIds as string[];
            observer.next({
              data: {
                paintOptions: {
                  revision: { epoch: "storybook", seq: "1" },
                  items: excluded.includes(serverPaint.id) ? [] : [serverPaint],
                },
              },
            });
            observer.complete();
          }),
      ),
    }),
  }));
  useEffect(
    () => () => {
      scope.client.stop();
      scope.controller.dispose();
    },
    [scope],
  );
  return <VaultGraphQLContext.Provider value={scope}>{children}</VaultGraphQLContext.Provider>;
}
export const AddProjectedPaintAndItems: Story = {
  decorators: [
    (Story) => (
      <ApolloPicker>
        <Story />
      </ApolloPicker>
    ),
  ],
  play: async ({ userEvent }) => {
    await userEvent.click(screen.getByRole("button", { name: "Add paint" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Add paint" }), "Server");
    await userEvent.click(await screen.findByRole("option", { name: /Server-only sky blue/ }));
    await expect(screen.getByText(serverPaint.name)).toBeVisible();
    await expect(screen.queryByText("Paint unavailable")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Step" }));
    await userEvent.click(screen.getByRole("button", { name: "Add step" }));
    await expect(screen.getAllByRole("combobox", { name: "Paint step" })).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Milestone" }));
    await userEvent.click(screen.getByRole("button", { name: "Add milestone" }));
    await expect(screen.getByRole("combobox", { name: "Milestone" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Image" }));
    const url = screen.getByRole("textbox", { name: "Image URL" });
    await userEvent.type(url, "http://example.test/image.png");
    await expect(screen.getByRole("button", { name: "Add image" })).toBeDisabled();
    await userEvent.clear(url);
    await userEvent.type(url, "https://example.test/image.png");
    await userEvent.keyboard("[Enter]");
    await expect(screen.getByRole("img", { name: "Scheme example" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Remove scheme image" }));
    await expect(screen.queryByRole("img", { name: "Scheme example" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: `Remove ${serverPaint.name}` }));
    await expect(screen.queryByText(serverPaint.name)).not.toBeInTheDocument();
  },
};

export const SystemReadOnly: Story = {
  args: { scheme: { ...scheme, isSystem: true, sourceName: "Example source" } },
  play: async () => {
    await waitFor(() => expect(screen.getByText("Example source · read-only")).toBeVisible());
    await expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    await expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    await expect(screen.queryByRole("textbox", { name: "Scheme name" })).not.toBeInTheDocument();
  },
};

const legacyDivider = {
  type: "DIVIDER",
  id: "persisted:legacy-step",
  label: "Legacy custom stage",
  tone: "SECTION",
  role: null,
  sortOrder: 4,
} as const;
const legacyImage = {
  type: "IMAGE",
  id: "persisted:legacy-image",
  imageUrl: "/api/catalog-source-images/example",
  thumbnailUrl: "/api/catalog-source-images/example-thumbnail",
  imageType: "FINISHED",
  method: "BRUSH",
  sortOrder: 5,
} as const;
export const LegacyPayloadRoundtrip: Story = {
  args: { entries: [...entries.slice(0, -1), legacyDivider, legacyImage, entries[entries.length - 1]] },
  beforeEach: () => {
    saveMutation.mockReset().mockResolvedValue({});
  },
  play: async ({ userEvent }) => {
    await expect(screen.getAllByRole("combobox", { name: "Paint step" })[1]).toHaveTextContent(
      "Legacy custom stage",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveMutation).toHaveBeenCalledOnce());
    const payload = saveMutation.mock.calls[0][0].input!;
    await expect(payload.entries).toContainEqual({
      type: "DIVIDER",
      id: legacyDivider.id,
      label: legacyDivider.label,
      tone: "SECTION",
      role: null,
    });
    await expect(payload.entries).toContainEqual({
      type: "IMAGE",
      id: legacyImage.id,
      imageUrl: legacyImage.imageUrl,
      thumbnailUrl: legacyImage.thumbnailUrl,
      imageType: legacyImage.imageType,
      method: legacyImage.method,
    });
  },
};

export const CreateAndRetry: Story = {
  args: { mode: "create", scheme: { ...scheme, id: "", name: "" } },
  beforeEach: () => {
    saveMutation
      .mockReset()
      .mockRejectedValueOnce(new Error("Create failed; please retry"))
      .mockResolvedValue({});
    deleteMutation.mockClear();
  },
  play: async ({ args, userEvent }) => {
    await expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    await expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Scheme name" }), "New reusable palette");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await expect(await screen.findByRole("alert")).toHaveTextContent("Create failed; please retry");
    await expect(screen.getByRole("textbox", { name: "Scheme name" })).toHaveValue("New reusable palette");
    await expect(args.onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(saveMutation).toHaveBeenCalledTimes(2));
    await expect(saveMutation.mock.calls[1][0]).toMatchObject({ input: { name: "New reusable palette" } });
    await expect(saveMutation.mock.calls[1][0]).not.toHaveProperty("id");
    await waitFor(() => expect(args.onClose).toHaveBeenCalledOnce());
  },
};
