/* eslint-disable react/no-multi-comp -- Keep this integration fixture and its hook probes in one story file. */
import { ApolloClient, ApolloLink, Observable } from "@apollo/client";
import { Box, Button, Tab, Tabs, TextField, Typography } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useContext, useEffect, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { VaultStoreContext } from "../store/context";
import { useVaultStore } from "../store/hooks";
import type { Notify } from "../types";

import { createVaultCache } from "./cache";
import { PluginInstallProvider, PluginInstallStatus, usePluginInstall } from "./plugin-install-hooks";
import type { PluginInstallJob } from "./plugin-install-observer";

const running: PluginInstallJob = {
  id: "install /source?revision=one&two",
  stage: "READING",
  done: 1,
  total: 10,
  percent: 10,
  cancellable: true,
  error: null,
  errorCode: null,
  errorParameters: [],
};
const snapshot = (patch: Partial<PluginInstallJob>): PluginInstallJob => ({ ...running, ...patch });
const terminal = (stage: "SUCCEEDED" | "FAILED" | "CANCELLED") =>
  snapshot({
    stage,
    done: 10,
    percent: 100,
    cancellable: false,
    ...(stage === "FAILED"
      ? {
          error: "PRIVATE diagnostic: /srv/secrets/plugin.zip SQL failure",
          errorCode: "INVALID_SELECTION",
          errorParameters: [{ name: "value1", value: "paint" }],
        }
      : {}),
  });

// A real Apollo transport replays the latest snapshot, just like the server.
// No production provider/hook/status is mocked.
function createTransport() {
  let latest = running;
  const listeners = new Set<(job: PluginInstallJob) => void>();
  const operation = fn<(name: string) => void>();
  const detached = fn();
  const client = new ApolloClient({
    cache: createVaultCache(),
    link: new ApolloLink(
      (request) =>
        new Observable((observer) => {
          operation(request.operationName ?? "");
          if (request.operationName === "PluginInstallProgress") {
            const publish = (job: PluginInstallJob) =>
              observer.next({ data: { pluginInstallProgress: job } });
            listeners.add(publish);
            publish(latest);
            return () => {
              listeners.delete(publish);
              detached();
            };
          }
          observer.next({ data: { pluginInstallJob: latest } });
          observer.complete();
          return undefined;
        }),
    ),
  });
  return {
    client,
    operation,
    detached,
    emit(job: PluginInstallJob) {
      latest = job;
      listeners.forEach((publish) => publish(job));
    },
  };
}
type Fixture = ReturnType<typeof createTransport> & {
  notify: Notify;
  refresh: () => Promise<void>;
  deleteRequest: ReturnType<typeof fn<(input: RequestInfo | URL, init?: RequestInit) => void>>;
  acknowledge: (job: PluginInstallJob) => void;
};

function Workspace() {
  const tab = useVaultStore((store) => store.tab);
  const store = useContext(VaultStoreContext)!;
  const [note, setNote] = useState("");
  return (
    <>
      <Tabs
        textColor="inherit"
        sx={{ color: "var(--ink)", "& .MuiTab-root": { opacity: 1 } }}
        value={tab}
        onChange={(_event, value: unknown) => {
          if (value === "dashboard" || value === "paints") store.getState().go(value);
        }}
        aria-label="Workspace navigation"
      >
        <Tab value="dashboard" label="Projects" id="projects-tab" aria-controls="workspace-panel" />
        <Tab value="paints" label="Paints" id="paints-tab" aria-controls="workspace-panel" />
      </Tabs>
      <Box
        role="tabpanel"
        id="workspace-panel"
        aria-labelledby={tab === "paints" ? "paints-tab" : "projects-tab"}
      >
        <Typography component="h2" variant="h6">
          {tab === "paints" ? "Paint collection" : "Project notes"}
        </Typography>
        <TextField
          label="Arbitrary note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          fullWidth
        />
      </Box>
    </>
  );
}

function StatusPanels({ details }: { details: boolean }) {
  const { job, cancelling } = usePluginInstall();
  return (
    <>
      <Box data-testid="global-progress" data-stage={job?.stage} data-cancelling={String(cancelling)}>
        <PluginInstallStatus compact />
      </Box>
      {details && (
        <Box data-testid="plugin-details">
          <PluginInstallStatus />
        </Box>
      )}
    </>
  );
}

function InstallStory({
  onReady,
  details = false,
  enabled = true,
}: {
  onReady: (fixture: Fixture) => void;
  details?: boolean;
  enabled?: boolean;
}) {
  // Read the global decorator's store, including its existing notify/refresh spies.
  const store = useContext(VaultStoreContext)!;
  const [transport] = useState(createTransport);
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const originalToken = store.getState().token;
    store.setState({ token: "plugin-story-token" });
    let resolveDelete: ((response: Response) => void) | undefined;
    const deleteRequest = fn<(input: RequestInfo | URL, init?: RequestInit) => void>();
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith("/api/catalog-sources?") && init?.method === "DELETE") {
        deleteRequest(input, init);
        return new Promise<Response>((resolve) => {
          resolveDelete = resolve;
        });
      }
      return originalFetch(input, init);
    };
    onReady({
      ...transport,
      notify: store.getState().notify,
      // eslint-disable-next-line @typescript-eslint/unbound-method -- Preserve the decorator spy, a this-free Zustand action.
      refresh: store.getState().refresh,
      deleteRequest,
      acknowledge: (job) => resolveDelete?.(Response.json({ job })),
    });
    return () => {
      window.fetch = originalFetch;
      store.setState({ token: originalToken });
      transport.client.stop();
    };
  }, [onReady, store, transport]);
  return (
    <Box sx={{ maxWidth: 760, display: "grid", gap: 2 }}>
      <Typography component="h1" variant="h5">
        Background plugin workspace
      </Typography>
      <Button onClick={() => setMounted((value) => !value)}>
        {mounted ? "Unmount provider" : "Reload provider"}
      </Button>
      {mounted && (
        <PluginInstallProvider client={transport.client} enabled={enabled}>
          <StatusPanels details={details} />
        </PluginInstallProvider>
      )}
      <Workspace />
    </Box>
  );
}

const meta = {
  title: "GraphQL/Plugin installation",
  component: InstallStory,
  args: { onReady: fn<(fixture: Fixture) => void>() },
  parameters: { docs: { story: { inline: false, iframeHeight: 760 } } },
} satisfies Meta<typeof InstallStory>;
export default meta;
type Story = StoryObj<typeof meta>;

async function ready(args: { onReady: (fixture: Fixture) => void }) {
  await waitFor(() => expect(args.onReady).toHaveBeenCalled());
  // The callback only exposes controls and the decorator's spies, never an
  // alternative implementation of install state or notifications.
  return (args.onReady as ReturnType<typeof fn<(fixture: Fixture) => void>>).mock.calls.at(-1)![0];
}

export const RestoredJobDoesNotBlockEditing: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const fixture = await ready(args);
    const progress = within(canvas.getByTestId("global-progress"));
    await expect(await progress.findByRole("status")).toHaveTextContent("Reading · 1 / 10");
    await expect(progress.getByRole("status")).toHaveAttribute("aria-live", "polite");
    await expect(progress.getByRole("status")).toHaveAttribute("aria-atomic", "true");
    await expect(progress.getByRole("progressbar", { name: "Plugin installation" })).toHaveAttribute(
      "aria-valuenow",
      "10",
    );
    await expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument();
    await expect(fixture.operation).not.toHaveBeenCalledWith("LatestPluginInstallJob");
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Arbitrary note" }),
      "Keep painting while the plugin installs",
    );
    fixture.emit(snapshot({ stage: "CHECKING", done: 3, percent: 30 }));
    await waitFor(() => expect(progress.getByRole("status")).toHaveTextContent("Checking · 3 / 10"));
    await userEvent.click(canvas.getByRole("tab", { name: "Paints" }));
    await expect(canvas.getByRole("tab", { name: "Paints" })).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("heading", { name: "Paint collection" })).toBeVisible();
    fixture.emit(snapshot({ stage: "IMAGES", done: 7, percent: 70 }));
    await waitFor(() => expect(progress.getByRole("status")).toHaveTextContent("Images · 7 / 10"));
    await expect(progress.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");
    await userEvent.click(canvas.getByRole("tab", { name: "Projects" }));
    await expect(canvas.getByRole("textbox", { name: "Arbitrary note" })).toHaveValue(
      "Keep painting while the plugin installs",
    );
    await expect(fixture.notify).not.toHaveBeenCalled();
  },
};

function completionStory(stage: "SUCCEEDED" | "FAILED" | "CANCELLED"): Story {
  return {
    args: { details: true },
    play: async ({ args, canvasElement }) => {
      const canvas = within(canvasElement);
      const fixture = await ready(args);
      await within(canvas.getByTestId("global-progress")).findByRole("progressbar");
      const result = terminal(stage);
      fixture.emit(result);
      await waitFor(() => expect(fixture.notify).toHaveBeenCalledTimes(1));
      const message =
        stage === "SUCCEEDED"
          ? "Plugin installation finished"
          : stage === "CANCELLED"
            ? "Plugin installation cancelled"
            : "Plugin installation failed: Invalid paint selection";
      if (stage === "FAILED") await expect(fixture.notify).toHaveBeenCalledWith(message, "error");
      else await expect(fixture.notify).toHaveBeenCalledWith(message);
      // Duplicate stream delivery must not replay terminal notifications/refresh.
      fixture.emit({ ...result });
      await waitFor(() =>
        expect(
          within(canvas.getByTestId("global-progress")).queryByRole("progressbar"),
        ).not.toBeInTheDocument(),
      );
      await expect(fixture.notify).toHaveBeenCalledTimes(1);
      await expect(canvas.getByTestId("plugin-details")).toBeEmptyDOMElement();
      // A reload must not restore the panel or repeat even a failed result.
      await userEvent.click(canvas.getByRole("button", { name: "Unmount provider" }));
      await userEvent.click(canvas.getByRole("button", { name: "Reload provider" }));
      await waitFor(() => expect(fixture.operation).toHaveBeenCalledTimes(2));
      await expect(canvas.getByTestId("global-progress")).toHaveAttribute("data-stage", stage);
      await expect(canvas.queryByRole("progressbar")).not.toBeInTheDocument();
      await expect(canvas.getByTestId("plugin-details")).toBeEmptyDOMElement();
      await expect(fixture.notify).toHaveBeenCalledTimes(1);
      // The existing live invalidation subscription owns catalog publication;
      // progress notifications must not restart it via a global refresh.
      await expect(fixture.refresh).not.toHaveBeenCalled();
      await expect(canvasElement).not.toHaveTextContent("PRIVATE diagnostic");
      if (stage === "FAILED") {
        await expect(canvas.getByTestId("plugin-details")).toBeEmptyDOMElement();
        await expect(fixture.notify).not.toHaveBeenCalledWith(
          expect.stringContaining("PRIVATE diagnostic"),
          "error",
        );
      }
    },
  };
}
export const SuccessNotifiesOnce = completionStory("SUCCEEDED");
export const LocalizedFailureNotifiesOnce = completionStory("FAILED");
export const CancellationNotifiesOnce = completionStory("CANCELLED");

export const CancellationWaitsForAuthoritativeCommit: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const fixture = await ready(args);
    await userEvent.click(await canvas.findByRole("button", { name: "Cancel installation" }));
    await expect(canvas.getByRole("button", { name: "Cancelling…" })).toBeDisabled();
    await expect(canvas.getByRole("status")).toHaveTextContent("Reading");
    await expect(fixture.notify).not.toHaveBeenCalled();
    await expect(fixture.deleteRequest).toHaveBeenCalledTimes(1);
    await expect(fixture.deleteRequest).toHaveBeenCalledWith(
      `/api/catalog-sources?job=${encodeURIComponent(running.id)}`,
      { method: "DELETE", headers: { authorization: "Bearer plugin-story-token" } },
    );
    fixture.acknowledge(snapshot({ stage: "COMMITTING", cancellable: false, done: 9, percent: 90 }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Committing · 9 / 10"));
    await expect(
      canvas.queryByRole("button", { name: /Cancel installation|Cancelling/ }),
    ).not.toBeInTheDocument();
    await expect(fixture.notify).not.toHaveBeenCalled();
    fixture.emit(terminal("SUCCEEDED"));
    await waitFor(() => expect(fixture.notify).toHaveBeenCalledTimes(1));
    await expect(fixture.notify).toHaveBeenCalledWith("Plugin installation finished");
  },
};

export const ReloadReattachesLatestActiveJob: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const fixture = await ready(args);
    await canvas.findByRole("progressbar");
    await userEvent.click(canvas.getByRole("button", { name: "Unmount provider" }));
    await waitFor(() => expect(fixture.detached).toHaveBeenCalledTimes(1));
    await expect(canvas.queryByRole("progressbar")).not.toBeInTheDocument();
    fixture.emit(snapshot({ stage: "PREPARING", done: 8, percent: 80 }));
    await userEvent.click(canvas.getByRole("button", { name: "Reload provider" }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Preparing data · 8 / 10"));
    await expect(
      fixture.operation.mock.calls.filter(([name]) => name === "LatestPluginInstallJob"),
    ).toHaveLength(0);
    await expect(
      fixture.operation.mock.calls.filter(([name]) => name === "PluginInstallProgress"),
    ).toHaveLength(2);
    fixture.emit(snapshot({ stage: "IMAGES", done: 9, percent: 90 }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Images · 9 / 10"));
    await expect(fixture.notify).not.toHaveBeenCalled();
  },
};

export const LateRestAcceptanceCannotResurrectTerminalJob: Story = {
  args: { details: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const fixture = await ready(args);
    const compact = within(canvas.getByTestId("global-progress"));
    await userEvent.click(await compact.findByRole("button", { name: "Cancel installation" }));
    fixture.emit(terminal("CANCELLED"));
    await waitFor(() => expect(fixture.notify).toHaveBeenCalledTimes(1));
    await expect(fixture.notify).toHaveBeenCalledWith("Plugin installation cancelled");
    // The delayed DELETE response accepted an active job before the stream
    // finished. It must pass through acceptJob without resurrecting that job.
    fixture.acknowledge(running);
    // Exercise the still-usable workspace while the delayed response settles;
    // assertions below must observe its processed result, not the pre-response UI.
    await userEvent.type(canvas.getByRole("textbox", { name: "Arbitrary note" }), "Still cancelled");
    await expect(canvas.getByTestId("global-progress")).toHaveAttribute("data-stage", "CANCELLED");
    await expect(canvas.getByTestId("plugin-details")).toBeEmptyDOMElement();
    await expect(compact.queryByRole("progressbar")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Cancel installation" })).not.toBeInTheDocument();
    await expect(fixture.notify).toHaveBeenCalledTimes(1);
    await expect(fixture.refresh).not.toHaveBeenCalled();
  },
};

export const CancellationShowsPendingCleanup: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const fixture = await ready(args);
    await userEvent.click(await canvas.findByRole("button", { name: "Cancel installation" }));
    fixture.acknowledge(snapshot({ stage: "IMAGES", cancellable: false, done: 4, percent: 40 }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Images · 4 / 10"));
    await expect(canvas.getByRole("button", { name: "Cancelling…" })).toBeDisabled();
    await expect(fixture.notify).not.toHaveBeenCalled();
    fixture.emit(terminal("CANCELLED"));
    await waitFor(() => expect(fixture.notify).toHaveBeenCalledWith("Plugin installation cancelled"));
    await expect(canvas.queryByRole("progressbar")).not.toBeInTheDocument();
  },
};

export const HealthyFocusKeepsOneStream: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const fixture = await ready(args);
    await waitFor(() => expect(fixture.operation).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 12; i++) window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    await userEvent.type(canvas.getByRole("textbox", { name: "Arbitrary note" }), "Still editing");
    await expect(fixture.operation).toHaveBeenCalledTimes(1);
    await expect(fixture.detached).not.toHaveBeenCalled();
  },
};

export const UnavailableVaultDoesNotRequestProgress: Story = {
  args: { enabled: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const fixture = await ready(args);
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Arbitrary note" }),
      "No authorized session yet",
    );
    await expect(fixture.operation).not.toHaveBeenCalled();
    await expect(canvas.queryByRole("progressbar")).not.toBeInTheDocument();
  },
};
