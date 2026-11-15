import { Alert, Box, Button, Typography } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AppBanner } from "../Components/AppBanner";
import { ContentSnackbar } from "../Components/ContentSnackbar";
import { PluginInstallProgress } from "../Components/PluginInstallProgress";
import { UpdatePrompt } from "../Components/UpdatePrompt";
import { desktopBridge } from "../storybook/decorators";

import { AppContent } from "./AppContent";
import { NavPanel } from "./NavPanel";
import { VaultLayout } from "./VaultLayout";

const retry = fn();
const notices = (
  <>
    <AppBanner onRetry={retry}>Live updates disconnected. Your loaded work is still available.</AppBanner>
    <AppBanner severity="error" onRetry={retry}>
      Could not refresh your vault. Showing the last loaded data.
    </AppBanner>
    <Typography component="h2" variant="h4" sx={{ mt: 3, mb: 2 }}>
      Workbench
    </Typography>
    <Box sx={{ border: "1px solid var(--line)", borderRadius: 3, p: 3, minHeight: 200 }}>
      Your collection stays available while the connection recovers.
    </Box>
  </>
);
const meta = {
  title: "Layout/VaultLayout",
  component: VaultLayout,
  args: {
    title: "Workbench",
    navigation: (onClose) => (
      <NavPanel
        tab="dashboard"
        go={fn()}
        counts={{}}
        displayName="Sample owner"
        onAccount={fn()}
        onClose={onClose}
      />
    ),
    children: notices,
    status: (
      <AppContent compact>
        <PluginInstallProgress
          compact
          job={{ id: "sample", stage: "IMAGES", done: 7, total: 10, percent: 70, cancellable: true }}
          onCancel={fn()}
        />
        <AppBanner onRetry={retry}>Reconnecting to installation progress…</AppBanner>
      </AppContent>
    ),
  },
  parameters: { fullBleed: true },
} satisfies Meta<typeof VaultLayout>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AllNotices: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const main = canvas.getByRole("main");
    const buttons = within(main).getAllByRole("button", { name: "Retry" });
    await userEvent.click(buttons[0]);
    await expect(retry).toHaveBeenCalled();
    const banner = buttons[0].closest("[data-app-banner]") as HTMLElement;
    await userEvent.click(within(banner).getByRole("button", { name: "Close" }));
    await expect(banner).not.toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Workbench", level: 2 })).toBeVisible();
  },
};

// Models the renderer overlay of a macOS hidden-inset titlebar. Native-window
// verification is separate; these pixels prove notices clear the overlay.
export const HiddenInset: Story = {
  decorators: [
    (Story) => (
      <>
        <Box
          data-native-titlebar
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 32,
            zIndex: 1500,
            pointerEvents: "none",
            bgcolor: "#262626",
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
          }}
        >
          {["#ff6059", "#ffbd2e", "#28c840"].map((color) => (
            <Box key={color} sx={{ width: 12, height: 12, bgcolor: color, borderRadius: "50%" }} />
          ))}
        </Box>
        <Story />
      </>
    ),
  ],
};

export const Toast: Story = {
  args: {
    children: (
      <>
        {notices}
        <ContentSnackbar open>
          <Alert
            severity="error"
            onClose={fn()}
            action={
              <Button color="inherit" size="small">
                Retry
              </Button>
            }
          >
            Could not save the selected paint. Your changes have not been saved.
          </Alert>
        </ContentSnackbar>
      </>
    ),
  },
};

export const Update: Story = {
  decorators: [
    desktopBridge({ status: "ready", currentVersion: "1.0.0", version: "1.1.0", progress: 100, error: null }),
  ],
  args: {
    children: (
      <>
        {notices}
        <UpdatePrompt />
      </>
    ),
  },
};
