import { ApolloLink, Observable } from "@apollo/client";
import { Button } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { PluginInstallStatus } from "../../graphql/plugin-install-hooks";
import type { PluginInstallJob } from "../../graphql/plugin-install-observer";
import { useVaultGraphQL } from "../../graphql/provider";
import { waitForDialogEntered } from "../../storybook/dialog";
import { SourcesApolloFixture, type SourcesFixtureMode } from "../../storybook/sources-apollo-fixture";

import { PluginsModal } from "./PluginsModal";

function PluginsStory({
  mode,
  delay,
  onClose,
  onOperation,
  job,
  deferBackgroundResult,
  installedGate,
}: {
  mode: SourcesFixtureMode;
  delay?: number;
  onClose(): void;
  onOperation(name: string): void;
  job?: PluginInstallJob;
  deferBackgroundResult?: boolean;
  installedGate?: Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [background] = useState(() => {
    if (!deferBackgroundResult) return null;
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    return { promise, release };
  });
  return (
    <SourcesApolloFixture
      mode={mode}
      delay={delay}
      onOperation={onOperation}
      job={job}
      beforeBackgroundResult={background ? () => background.promise : undefined}
    >
      <HoldInstalledSources until={installedGate}>
        {background ? <Button onClick={background.release}>Release automatic update response</Button> : null}
        {open ? (
          <PluginsModal
            onClose={() => {
              onClose();
              setOpen(false);
            }}
          />
        ) : (
          <>
            <PluginInstallStatus compact />
            <Button onClick={() => setOpen(true)}>Open Plugins</Button>
          </>
        )}
      </HoldInstalledSources>
    </SourcesApolloFixture>
  );
}
// A deterministic list gate keeps form controls testable before the first accepted read.
function HoldInstalledSources({ until, children }: { until?: Promise<void>; children: ReactNode }) {
  const scope = useVaultGraphQL();
  useLayoutEffect(() => {
    if (!scope || !until) return;
    const original = scope.client.link;
    const gate = new ApolloLink((operation, forward) => {
      if (operation.operationName !== "InstalledSources") return forward(operation);
      return new Observable((observer) => {
        let active = true;
        let cancel = () => {};
        void until.then(() => {
          if (!active) return;
          const subscription = forward(operation).subscribe(observer);
          cancel = () => subscription.unsubscribe();
        });
        return () => {
          active = false;
          cancel();
        };
      });
    });
    scope.client.setLink(ApolloLink.from([gate, original]));
    return () => scope.client.setLink(original);
  }, [scope, until]);
  return children;
}

const meta = {
  title: "Dialogs/Plugins",
  component: PluginsStory,
  args: { mode: "installed", onClose: fn(), onOperation: fn() },
  parameters: { docs: { story: { inline: false, iframeHeight: 840 } } },
} satisfies Meta<typeof PluginsStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Installed: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByText("Example paint source")).toBeVisible());
    await expect(body.getByLabelText("GitHub repository")).toHaveValue("");
    await expect(body.getByRole("button", { name: "Add plugin" })).toBeDisabled();
    await expect(body.getByRole("button", { name: "Check for updates" })).toBeInTheDocument();
  },
};
export const Empty: Story = {
  args: { mode: "empty" },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByText("No plugins yet")).toBeVisible());
    await waitFor(() => expect(args.onOperation).toHaveBeenCalledWith("AutomaticUpdate"));
    const emptyCard = body.getByText("No plugins yet").parentElement!;
    await expect(within(emptyCard).getByTestId("ExtensionOutlinedIcon")).toBeInTheDocument();
    await expect(body.queryByRole("progressbar")).not.toBeInTheDocument();
    await expect(body.queryByRole("region", { name: "Plugin installation" })).not.toBeInTheDocument();
  },
};
export const Loading: Story = {
  args: { delay: 750 },
  play: async ({ mount, args, canvasElement }) => {
    const listRead = Promise.withResolvers<void>();
    await mount(<PluginsStory {...args} delay={0} installedGate={listRead.promise} />);
    const body = within(canvasElement.ownerDocument.body);
    try {
      const dialog = await body.findByRole("dialog", { name: "Plugins" });
      await waitForDialogEntered(dialog);
      await expect(within(dialog).getAllByRole("status")).toHaveLength(1);
      await expect(within(dialog).getByRole("status")).toHaveAttribute("aria-live", "polite");
      await waitFor(() => expect(within(dialog).getByRole("status")).toHaveTextContent("Loading"));
      const installed = within(dialog).getByRole("region", { name: "Installed" });
      await expect(installed).toHaveAttribute("aria-busy", "true");
      await expect(installed).toHaveAttribute("data-skeleton", "installed-plugins");
      const shell = [
        within(dialog).getByRole("heading", { name: "Plugins" }),
        within(dialog).getByRole("textbox", { name: "GitHub repository" }),
        within(dialog).getByRole("button", { name: "Add plugin" }),
        within(dialog).getByRole("button", { name: "Upload .zip" }),
        within(dialog).getByRole("heading", { name: "Installed" }),
        within(dialog).getByRole("button", { name: "Create plugin" }),
      ];
      shell.forEach((node) => expect(node).toBeVisible());
      const positions = shell.map((node) => node.getBoundingClientRect().toJSON());
      const placeholder = installed.querySelector(".MuiCard-root")!.getBoundingClientRect().toJSON();
      await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      listRead.resolve();
      await expect(await body.findByText("Example paint source")).toBeVisible();
      await waitFor(() => expect(installed).toHaveAttribute("aria-busy", "false"));
      await expect(dialog.querySelector("[data-skeleton]")).not.toBeInTheDocument();
      shell.forEach((node, index) => {
        expect(node.isConnected).toBe(true);
        const next = node.getBoundingClientRect();
        for (const key of ["x", "y", "width", "height"] as const)
          expect(next[key]).toBeCloseTo(positions[index][key], 0);
      });
      const card = body.getByText("Example paint source").closest(".MuiCard-root")!.getBoundingClientRect();
      for (const key of ["x", "y", "width", "height"] as const)
        await expect(card[key]).toBeCloseTo(placeholder[key], 0);
      await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    } finally {
      listRead.resolve();
    }
  },
};
export const ErrorAndRetry: Story = {
  args: { mode: "error" },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByText("Could not load fixture plugins")).toBeVisible());
    await userEvent.click(body.getByRole("button", { name: "Retry" }));
    // Versions are a separate mount-time operation; count only the list retry.
    const operations = args.onOperation;
    await waitFor(() =>
      expect(operations.mock.calls.filter(([name]) => name === "InstalledSources")).toHaveLength(2),
    );
  },
};
export const DeferredCreateChoices: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByText("Example paint source")).toBeVisible());
    await expect(args.onOperation).not.toHaveBeenCalledWith("PluginShareable");
    // Background jobs do not refresh catalog windows until commit. Create uses
    // an independent local query and stays available once the initial list loads.
    await waitFor(() => expect(body.getByRole("button", { name: "Create plugin" })).toBeEnabled());
    await userEvent.click(body.getByRole("button", { name: "Create plugin" }));
    await waitFor(() => expect(body.getByLabelText("Search items to include")).toBeVisible());
    await expect(args.onOperation).toHaveBeenCalledWith("PluginShareable");
    await userEvent.type(body.getByLabelText("Search items to include"), "silver");
    await expect(body.getByText("Custom · Silver")).toBeVisible();
  },
};

export const AddErrorsAreLocalized: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByText("Example paint source")).toBeVisible());
    const original = window.fetch;
    const submit = body.getByRole("button", { name: "Add plugin" });
    await userEvent.type(body.getByLabelText("GitHub repository"), "example/other");
    try {
      window.fetch = async (_input, init) => {
        if (init?.method === "POST") throw new TypeError("Failed to fetch private-host");
        return original(_input, init);
      };
      await userEvent.click(submit);
      await waitFor(() => expect(body.getByText("Could not install plugin")).toBeVisible());
      await expect(body.queryByText("Failed to fetch private-host")).not.toBeInTheDocument();
      window.fetch = async (_input, init) =>
        init?.method === "POST"
          ? Response.json({ error: "private legacy diagnostic" }, { status: 400 })
          : original(_input, init);
      await userEvent.click(submit);
      await waitFor(() =>
        expect(body.getByText("The request could not be completed. Please try again.")).toBeVisible(),
      );
      await expect(body.queryByText("private legacy diagnostic")).not.toBeInTheDocument();
      window.fetch = async (_input, init) =>
        init?.method === "POST"
          ? Response.json(
              {
                error: "private legacy diagnostic",
                errorCode: "INVALID_SELECTION",
                errorParameters: { value1: "paint" },
              },
              { status: 400 },
            )
          : original(_input, init);
      await userEvent.click(submit);
      await waitFor(() => expect(body.getByText("Invalid paint selection")).toBeVisible());
    } finally {
      window.fetch = original;
    }
  },
};

export const StartsInBackground: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByText("Example paint source")).toBeVisible());
    await userEvent.type(body.getByLabelText("GitHub repository"), "example/new-plugin");
    await userEvent.click(body.getByRole("button", { name: "Add plugin" }));
    await waitFor(() => expect(args.onClose).toHaveBeenCalledTimes(1));
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(body.getByRole("progressbar", { name: "Plugin installation" })).toBeVisible();
    await expect(body.getByRole("button", { name: "Cancel installation" })).toBeEnabled();
    await userEvent.click(body.getByRole("button", { name: "Open Plugins" }));
    await waitForDialogEntered(await body.findByRole("dialog", { name: "Plugins" }));
    await expect(body.getByText("An installation is already running.")).toBeVisible();
    await expect(body.getByRole("button", { name: "Add plugin" })).toBeDisabled();
  },
};

export const UploadStartsInBackground: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByText("Example paint source")).toBeVisible());
    const fileInput = canvasElement.ownerDocument.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("Missing plugin ZIP input");
    await userEvent.upload(fileInput, new File(["fixture"], "plugin.zip", { type: "application/zip" }));
    await waitFor(() => expect(args.onClose).toHaveBeenCalledTimes(1));
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(await body.findByRole("progressbar", { name: "Plugin installation" })).toBeVisible();
  },
};

export const ReloadedRunningJob: Story = {
  args: {
    job: {
      id: "running-job",
      stage: "IMAGES",
      done: 120,
      total: 450,
      percent: 42,
      cancellable: true,
      error: null,
      errorCode: null,
      errorParameters: [],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitForDialogEntered(await body.findByRole("dialog", { name: "Plugins" }));
    await waitFor(() =>
      expect(body.getByRole("progressbar", { name: "Plugin installation" })).toHaveAttribute(
        "aria-valuenow",
        "42",
      ),
    );
    await expect(body.getByText(/120 \/ 450/)).toBeVisible();
    await expect(body.getByRole("button", { name: "Add plugin" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(body.getByRole("progressbar", { name: "Plugin installation" })).toBeVisible();
  },
};

export const LateAutomaticUpdateResult: Story = {
  args: { deferBackgroundResult: true },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(args.onOperation).toHaveBeenCalledWith("BackgroundInstallDecodeStarted"));
    const fileInput = canvasElement.ownerDocument.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error("Missing plugin ZIP input");
    await userEvent.upload(fileInput, new File(["fixture"], "plugin.zip", { type: "application/zip" }));
    await waitFor(() => expect(args.onClose).toHaveBeenCalledTimes(1));
    await expect(await body.findByRole("progressbar", { name: "Plugin installation" })).toBeVisible();
    await userEvent.click(body.getByRole("button", { name: "Release automatic update response" }));
    await waitFor(() => expect(args.onOperation).toHaveBeenCalledWith("BackgroundInstallResult"));
    await userEvent.click(body.getByRole("button", { name: "Open Plugins" }));
    await waitForDialogEntered(await body.findByRole("dialog", { name: "Plugins" }));
    await expect(body.getByText("An installation is already running.")).toBeVisible();
    await expect(body.getByRole("button", { name: "Cancel installation" })).toBeEnabled();
    await expect(body.getByRole("button", { name: "Add plugin" })).toBeDisabled();
  },
};

export const ReplayedFinishedJob: Story = {
  args: {
    mode: "empty",
    job: {
      id: "old-completed-job",
      stage: "SUCCEEDED",
      done: 1,
      total: 1,
      percent: 100,
      cancellable: false,
      error: null,
      errorCode: null,
      errorParameters: [],
    },
  },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(args.onOperation).toHaveBeenCalledWith("AutomaticUpdate"));
    await waitForDialogEntered(await body.findByRole("dialog", { name: "Plugins" }));
    await expect(body.getByText("No plugins yet")).toBeVisible();
    await expect(body.queryByRole("progressbar")).not.toBeInTheDocument();
    await expect(body.queryByText("Plugin installation finished")).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(body.getByRole("button", { name: "Open Plugins" }));
    await waitForDialogEntered(await body.findByRole("dialog", { name: "Plugins" }));
    await expect(body.queryByRole("progressbar")).not.toBeInTheDocument();
    await expect(body.queryByText("Plugin installation finished")).not.toBeInTheDocument();
  },
};
