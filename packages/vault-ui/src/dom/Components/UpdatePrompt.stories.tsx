import type { Meta, StoryObj } from "@storybook/react-vite";

import { desktopBridge } from "../storybook/decorators";

import { UpdatePrompt } from "./UpdatePrompt";

// The prompt only appears in the desktop app, once an update has downloaded. These stories
// supply a stand-in for the desktop bridge.
const meta = {
  title: "Components/UpdatePrompt",
  component: UpdatePrompt,
  // The bridge is global, so docs render each story in its own frame.
  parameters: { docs: { story: { inline: false, iframeHeight: 160 } } },
} satisfies Meta<typeof UpdatePrompt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadyToInstall: Story = {
  decorators: [
    desktopBridge({ status: "ready", currentVersion: "1.0.0", version: "1.1.0", progress: 100, error: null }),
  ],
};

// Nothing shows while the update is still downloading.
export const Downloading: Story = {
  decorators: [
    desktopBridge({
      status: "downloading",
      currentVersion: "1.0.0",
      version: "1.1.0",
      progress: 42,
      error: null,
    }),
  ],
};
