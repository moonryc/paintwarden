import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { SourcesApolloFixture, type SourcesFixtureMode } from "../../storybook/sources-apollo-fixture";

import { PluginsModal } from "./PluginsModal";

function PluginsStory({
  mode,
  onClose,
  onOperation,
}: {
  mode: SourcesFixtureMode;
  onClose(): void;
  onOperation(name: string): void;
}) {
  return (
    <SourcesApolloFixture mode={mode} onOperation={onOperation}>
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
export const Loading: Story = { args: { mode: "loading" } };
export const ErrorAndRetry: Story = {
  args: { mode: "error" },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByText("Could not load fixture plugins")).toBeVisible());
    await userEvent.click(body.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(args.onOperation).toHaveBeenCalledTimes(2));
  },
};
export const DeferredCreateChoices: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByText("Example paint source")).toBeVisible());
    await expect(args.onOperation).not.toHaveBeenCalledWith("PluginShareable");
    await waitFor(() => expect(body.getByRole("button", { name: "Create plugin" })).toBeEnabled());
    await userEvent.click(body.getByRole("button", { name: "Create plugin" }));
    await waitFor(() => expect(body.getByLabelText("Search items to include")).toBeVisible());
    await expect(args.onOperation).toHaveBeenCalledWith("PluginShareable");
    await userEvent.type(body.getByLabelText("Search items to include"), "silver");
    await expect(body.getByText("Custom · Silver")).toBeVisible();
  },
};
