import { Box, Button, Stack, Typography } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StrictMode, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { VaultLayout } from "../Layout/VaultLayout";

import { AppBanner } from "./AppBanner";
import { Modal } from "./Modal";
import {
  ConnectionLostContext,
  ErrorSurface,
  PageErrorSuppressedContext,
  QueryErrorNotice,
} from "./QueryErrorNotice";

const meta = {
  title: "Components/QueryErrorNotice",
  component: QueryErrorNotice,
  args: { error: "Some content could not be refreshed. Your loaded work is still available.", onRetry: fn() },
} satisfies Meta<typeof QueryErrorNotice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const StandaloneFallback: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("alert")).toHaveLength(1);
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

const secondRetry = fn();
export const MultipleQueriesOnePage: Story = {
  render: (args) => (
    <StrictMode>
      <VaultLayout
        title="My miniatures"
        navigation={() => (
          <Box component="nav" aria-label="App navigation">
            Paintwarden
          </Box>
        )}
      >
        <QueryErrorNotice {...args} />
        <QueryErrorNotice error="Folder navigation could not be refreshed." onRetry={secondRetry} />
        <Typography component="h2" variant="h5">
          My miniatures
        </Typography>
        <Typography>Previously loaded miniature and folder content stays available.</Typography>
      </VaultLayout>
    </StrictMode>
  ),
  beforeEach: () => {
    secondRetry.mockClear();
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getAllByRole("alert")).toHaveLength(1));
    await expect(canvas.getByText(/Previously loaded/)).toBeVisible();
    await expect(canvas.getByRole("alert")).toHaveTextContent("Folder navigation could not be refreshed.");
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      typeof args.error === "string" ? args.error : (args.error?.message ?? ""),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
    await expect(secondRetry).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await expect(canvas.getByText(/Previously loaded/)).toBeVisible();
  },
};

function ModalOverPageExample() {
  const [open, setOpen] = useState(true);
  return (
    <Box data-testid="page-errors">
      <ErrorSurface>
        <QueryErrorNotice error="The page could not be refreshed." />
        <QueryErrorNotice error="Folder navigation could not be refreshed." />
        <Typography component="h2" variant="h5">
          Miniature collection
        </Typography>
        <Button onClick={() => setOpen(true)}>Open project</Button>
        {open && (
          <Modal
            title="Project details"
            subtitle="Loaded work is kept while retrying"
            onClose={() => setOpen(false)}
          >
            <QueryErrorNotice error="Project details could not be refreshed." />
            <QueryErrorNotice error="Project recipe could not be refreshed." />
            <Typography>Previously loaded project notes</Typography>
          </Modal>
        )}
      </ErrorSurface>
    </Box>
  );
}

export const ModalOverPageOneEach: Story = {
  render: () => <ModalOverPageExample />,
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelectorAll("[data-query-error-banner]")).toHaveLength(1));
    await expect(canvasElement.querySelectorAll("[data-query-error-banner]")).toHaveLength(1);
    await expect(canvasElement.ownerDocument.querySelectorAll("[data-query-error-banner]")).toHaveLength(2);
    await userEvent.click(within(within(dialog).getByRole("alert")).getByRole("button", { name: "Close" }));
    await expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    // Dismissing the modal's notice does not dismiss the page's notice.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(within(canvasElement).getAllByRole("alert")).toHaveLength(1);
  },
};

function ConnectionExample() {
  const [lost, setLost] = useState(true);
  const [failed, setFailed] = useState(true);
  return (
    <ConnectionLostContext.Provider value={lost}>
      {lost && <AppBanner>Connection lost. Reconnecting…</AppBanner>}
      <ErrorSurface>
        <QueryErrorNotice error={failed ? "The page could not be refreshed." : null} />
        <Typography>Previously loaded collection</Typography>
        <Modal
          title="Project details"
          subtitle="Connection recovery does not discard drafts"
          onClose={() => undefined}
        >
          <QueryErrorNotice error={failed ? "Project details could not be refreshed." : null} />
          <QueryErrorNotice error={failed ? "Project recipe could not be refreshed." : null} />
          <Typography>Unsaved project notes</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button onClick={() => setLost((value) => !value)}>Toggle connection</Button>
            <Button onClick={() => setFailed(false)}>Finish query recovery</Button>
          </Stack>
        </Modal>
      </ErrorSurface>
    </ConnectionLostContext.Provider>
  );
}

export const ConnectionSuppressionAndRecovery: Story = {
  render: () => <ConnectionExample />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const dialog = within(await within(doc.body).findByRole("dialog"));
    await expect(doc.querySelectorAll("[data-query-error-banner]")).toHaveLength(0);
    await expect(doc.querySelectorAll("[data-app-banner]")).toHaveLength(2);
    await expect(dialog.getByRole("status")).toHaveTextContent("Connection lost. Reconnecting");
    await userEvent.click(dialog.getByRole("button", { name: "Toggle connection" }));
    await waitFor(() => expect(doc.querySelectorAll("[data-query-error-banner]")).toHaveLength(2));
    await expect(doc.querySelectorAll("[data-app-banner]")).toHaveLength(2);
    await waitFor(() => expect(dialog.getByText("Unsaved project notes")).toBeVisible());
    await userEvent.click(dialog.getByRole("button", { name: "Finish query recovery" }));
    await waitFor(() => expect(doc.querySelectorAll("[data-app-banner]")).toHaveLength(0));
    await waitFor(() => expect(dialog.getByText("Unsaved project notes")).toBeVisible());
  },
};

function LifecycleExample() {
  const [first, setFirst] = useState(true);
  const [second, setSecond] = useState(true);
  return (
    <ErrorSurface>
      <QueryErrorNotice error={first ? "Collection refresh failed." : null} />
      {second && <QueryErrorNotice error="Folder refresh failed." />}
      <Stack direction="row" spacing={1}>
        <Button onClick={() => setFirst((value) => !value)}>Toggle collection failure</Button>
        <Button onClick={() => setSecond((value) => !value)}>Toggle folder section</Button>
      </Stack>
    </ErrorSurface>
  );
}

export const RecoveryUnmountAndNewEpisode: Story = {
  render: () => <LifecycleExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Collection refresh failed.");
    await userEvent.click(canvas.getByRole("button", { name: "Toggle collection failure" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Folder refresh failed.");
    await userEvent.click(canvas.getByRole("button", { name: "Toggle folder section" }));
    await waitFor(() => expect(canvas.queryByRole("alert")).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "Toggle collection failure" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Collection refresh failed.");
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Toggle collection failure" }));
    await userEvent.click(canvas.getByRole("button", { name: "Toggle collection failure" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Collection refresh failed.");
  },
};

// A server/access failure already shown by the shell is not a lost connection.
export const GlobalFailureSuppressesPageOnly: Story = {
  render: () => (
    <PageErrorSuppressedContext.Provider value>
      <ErrorSurface>
        <QueryErrorNotice error="Page refresh failed." />
        <Modal
          title="Project details"
          subtitle="Specific dialog errors stay visible"
          onClose={() => undefined}
        >
          <QueryErrorNotice error="Project recipe refresh failed." />
          <Typography>Unsaved project notes</Typography>
        </Modal>
      </ErrorSurface>
    </PageErrorSuppressedContext.Provider>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const dialog = await within(doc.body).findByRole("dialog");
    await waitFor(() => expect(doc.querySelectorAll("[data-query-error-banner]")).toHaveLength(1));
    await expect(canvasElement.querySelectorAll("[data-query-error-banner]")).toHaveLength(0);
    await expect(within(dialog).getByRole("alert")).toHaveTextContent("Project recipe refresh failed.");
    await expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
  },
};
