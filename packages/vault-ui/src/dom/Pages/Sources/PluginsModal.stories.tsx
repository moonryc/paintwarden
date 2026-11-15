import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { SourcesApolloFixture, type SourcesFixtureMode } from "../../storybook/sources-apollo-fixture";

import { PluginsModal } from "./PluginsModal";

function PluginsStory({
  mode,
  delay,
  onClose,
  onOperation,
}: {
  mode: SourcesFixtureMode;
  delay?: number;
  onClose(): void;
  onOperation(name: string): void;
}) {
  return (
    <SourcesApolloFixture mode={mode} delay={delay} onOperation={onOperation}>
      <PluginsModal onClose={onClose} />
    </SourcesApolloFixture>
  );
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
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByText("No plugins yet")).toBeVisible());
  },
};
export const Loading: Story = {
  args: { delay: 750 },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Plugins" });
    await expect(await within(dialog).findByRole("status")).toHaveAttribute("aria-live", "polite");
    const skeletons = canvasElement.ownerDocument.querySelectorAll("[data-skeleton]");
    await expect(skeletons).toHaveLength(1);
    await expect(skeletons[0]).toHaveAttribute("data-skeleton", "plugins");
    await expect(skeletons[0]).toHaveAttribute("aria-busy", "true");
    await expect(dialog).toContainElement(skeletons[0] as HTMLElement);
    await expect(body.queryByRole("textbox", { name: "GitHub repository" })).not.toBeInTheDocument();
    await expect(await body.findByText("Example paint source")).toBeVisible();
    await expect(canvasElement.ownerDocument.querySelector("[data-skeleton]")).not.toBeInTheDocument();
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
    // The mount-time background update check refreshes the list once, temporarily
    // disabling Create. Wait for its second versions read, not the brief enabled
    // state before that refresh (a physical click there can be dropped).
    await waitFor(
      () =>
        expect(
          args.onOperation.mock.calls.filter(([name]) => name === "PluginVersions").length,
        ).toBeGreaterThanOrEqual(2),
      { timeout: 5000 },
    );
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
