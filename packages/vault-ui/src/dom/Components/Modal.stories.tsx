import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { waitForDialogEntered } from "../storybook/dialog";
import { paintList } from "../storybook/fixtures";
import { theme } from "../theme";

import { Modal } from "./Modal";
import { PluginChip } from "./PluginChip";

const meta = {
  title: "Components/Modal",
  component: Modal,
  args: {
    title: "New color scheme",
    subtitle: "Group the paints you use together.",
    onClose: fn(),
    children: (
      <Box sx={{ display: "grid", gap: 2 }}>
        <TextField label="Name" placeholder="e.g. Crimson armour" fullWidth />
        <TextField label="Notes" multiline minRows={3} fullWidth />
      </Box>
    ),
  },
  argTypes: { children: { control: false }, footer: { control: false } },
  // The sheet is a dialog, so docs give each story its own frame. Phone widths show the
  // full-screen layout.
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {};

// Force each responsive branch independently of the Storybook/test runner viewport.
const phoneTheme = createTheme({
  ...theme,
  breakpoints: { values: { ...theme.breakpoints.values, sm: 10000 } },
});
const desktopTheme = createTheme({
  ...theme,
  breakpoints: { values: { ...theme.breakpoints.values, sm: 0 } },
});

export const PhoneDismissal: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider theme={phoneTheme}>
        <Story />
      </ThemeProvider>
    ),
  ],
  play: async ({ args, canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog");
    await expect(dialog).toHaveClass("MuiDialog-paperFullScreen");
    // The container is the backdrop-click target; phone forms deliberately ignore it.
    await userEvent.click(dialog.parentElement!);
    await expect(args.onClose).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("textbox", { name: "Name" }));
    await userEvent.keyboard("{Escape}");
    await expect(args.onClose).toHaveBeenCalledTimes(1);
  },
};

export const DesktopDismissal: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider theme={desktopTheme}>
        <Story />
      </ThemeProvider>
    ),
  ],
  play: async ({ args, canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog");
    await expect(dialog).not.toHaveClass("MuiDialog-paperFullScreen");
    await userEvent.click(dialog.parentElement!);
    await expect(args.onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(within(dialog).getByRole("textbox", { name: "Name" }));
    await userEvent.keyboard("{Escape}");
    await expect(args.onClose).toHaveBeenCalledTimes(2);
  },
};

export const WithFooter: Story = {
  args: {
    footer: (
      <>
        <Button variant="outlined">Cancel</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained">Save scheme</Button>
      </>
    ),
  },
};

export const WithBadge: Story = {
  args: {
    title: "Crimson armour",
    subtitle: "Color scheme",
    badge: <PluginChip name="Example paint source" />,
  },
};

// fillBody lets one long list take the remaining height and scroll on its own.
export const ScrollingList: Story = {
  args: {
    title: "Choose paints",
    subtitle: `${paintList.length * 4} paints`,
    fillBody: true,
    children: (
      <Box
        component="ul"
        tabIndex={0}
        sx={{ m: 0, p: 0, listStyle: "none", flex: 1, minHeight: 0, overflowY: "auto" }}
      >
        {Array.from({ length: 4 }, (_, round) =>
          paintList.map((paint) => (
            <Box
              component="li"
              key={`${round}-${paint.id}`}
              sx={{ py: 1, borderBottom: "1px solid var(--line)" }}
            >
              {paint.name}
            </Box>
          )),
        )}
      </Box>
    ),
  },
};

// A mounted dialog is not necessarily visible: hold the Fade at its opening
// opacity to deterministically reproduce the fast-query race without timing sleeps.
export const OpeningVisibility: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog");
    await waitForDialogEntered(dialog);
    const transition = dialog.closest<HTMLElement>(".MuiDialog-container")!;
    const originalStyle = transition.getAttribute("style");
    let entered = false;
    try {
      transition.style.transition = "none";
      transition.style.opacity = "0";
      await expect(within(dialog).getByRole("textbox", { name: "Name" })).toBeInTheDocument();
      await expect(dialog).not.toBeVisible();
      const ready = waitForDialogEntered(dialog).then(() => {
        entered = true;
      });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      await expect(entered).toBe(false);
      transition.style.opacity = "1";
      await ready;
      await expect(entered).toBe(true);
      await expect(dialog).toBeVisible();
    } finally {
      if (originalStyle === null) transition.removeAttribute("style");
      else transition.setAttribute("style", originalStyle);
    }
  },
};
