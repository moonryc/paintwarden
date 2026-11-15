import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { waitForDialogEntered } from "../storybook/dialog";
import { theme } from "../theme";
import type { SupportSummary } from "../utils/support";

import { HelpAbout } from "./HelpAbout";

const localSummary: SupportSummary = {
  version: "1.0.0",
  os: "macOS",
  mode: "local" as const,
  language: "en",
  migrationState: "ready",
};
const meta = {
  title: "Components/HelpAbout",
  component: HelpAbout,
  args: {
    loadSummary: fn(async () => localSummary),
    saveBundle: fn(async () => true),
    report: fn(async () => undefined),
    desktop: true,
  },
} satisfies Meta<typeof HelpAbout>;
export default meta;
type Story = StoryObj<typeof meta>;

function rowName(title: string) {
  return new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`);
}

async function openDialog(canvasElement: HTMLElement, title: string, row = title) {
  await userEvent.click(await within(canvasElement).findByRole("button", { name: rowName(row) }));
  const dialog = await within(document.body).findByRole("dialog", { name: title });
  await waitForDialogEntered(dialog);
  return dialog;
}

async function dismissDialog() {
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
}

export const Desktop: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const titles = [
      "About Paintwarden",
      "Report a bug",
      "Save support bundle",
      "Privacy",
      "License: PolyForm Noncommercial 1.0.0",
      "Open-source licenses",
      "Trademarks & non-affiliation",
    ];
    await expect(canvas.getAllByRole("button")).toHaveLength(7);
    for (const name of titles) {
      await expect(canvas.getByRole("button", { name: rowName(name) })).toBeVisible();
    }
    await expect(canvas.getByText("Version, channel and system information")).toBeVisible();
    await expect(canvas.queryByText("macOS")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Stable", { exact: true })).not.toBeInTheDocument();
    await expect(
      canvas.queryByText(/Free for personal and other non-commercial use/),
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText(/Support bundles are optional local exports/)).not.toBeInTheDocument();
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
    await expect(args.loadSummary).not.toHaveBeenCalled();
    await expect(args.report).not.toHaveBeenCalled();
    const trigger = canvas.getByRole("button", { name: rowName("About Paintwarden") });
    const about = within(await openDialog(canvasElement, "About Paintwarden"));
    await expect(await about.findByText("macOS")).toBeVisible();
    await expect(about.getByText("Stable", { exact: true })).toBeVisible();
    await expect(about.getByRole("link", { name: "Beta tester guide (English)" })).toHaveAttribute(
      "href",
      "https://github.com/moonryc/paintwarden/blob/main/docs/beta-testers.md",
    );
    await dismissDialog();
    await expect(trigger).toHaveFocus();
    const preview = within(await openDialog(canvasElement, "Review support bundle", "Save support bundle"));
    await expect(args.saveBundle).not.toHaveBeenCalled();
    await expect(preview.getByText(/Nothing is uploaded automatically/)).toBeVisible();
    await expect(await preview.findByText(/"migrationState": "ready"/)).toBeVisible();
    await userEvent.click(preview.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.saveBundle).not.toHaveBeenCalled();
    const reopened = within(await openDialog(canvasElement, "Review support bundle", "Save support bundle"));
    await userEvent.click(await reopened.findByRole("button", { name: "Save file" }));
    await expect(args.saveBundle).toHaveBeenCalledWith("en");
    await expect(await reopened.findByText("Support bundle saved.")).toBeVisible();
    await dismissDialog();
    await expect(canvas.getByRole("button", { name: rowName("Save support bundle") })).toHaveFocus();
  },
};

export const RemoteBrowser: Story = {
  args: {
    desktop: false,
    loadSummary: fn(async () => ({
      ...localSummary,
      mode: "remote" as const,
      os: "Linux",
      serverVersion: "1.0.0",
    })),
  },
  play: async ({ canvasElement }) => {
    const about = within(await openDialog(canvasElement, "About Paintwarden"));
    await expect(await about.findByText("Server version")).toBeVisible();
    await expect(about.getByText("Linux")).toBeVisible();
    await dismissDialog();
    const preview = within(await openDialog(canvasElement, "Review support bundle", "Save support bundle"));
    await expect(await preview.findByText(/"serverVersion": "1.0.0"/)).toBeVisible();
    await expect(preview.getByText(/Server logs are not available in this version/)).toBeVisible();
    await dismissDialog();
  },
};

export const SummaryFailure: Story = {
  args: {
    loadSummary: fn(async () => {
      throw new Error("Private internal failure");
    }),
  },
  play: async ({ canvasElement, args }) => {
    const dialog = within(await openDialog(canvasElement, "Review support bundle", "Save support bundle"));
    await expect(
      await dialog.findByText("Could not complete this support action. Please try again."),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save file" })).toBeDisabled();
    await expect(dialog.queryByText(/Private internal failure/)).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(args.loadSummary).toHaveBeenCalledTimes(2));
    await expect(args.saveBundle).not.toHaveBeenCalled();
    await dismissDialog();
  },
};

export const SummaryRetry: Story = {
  args: {
    loadSummary: fn(async () => localSummary),
  },
  play: async ({ canvasElement, args }) => {
    args.loadSummary!.mockRejectedValueOnce(new Error("Private failure"));
    const dialog = within(await openDialog(canvasElement, "Review support bundle", "Save support bundle"));
    await expect(
      await dialog.findByText("Could not complete this support action. Please try again."),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save file" })).toBeDisabled();
    await userEvent.click(dialog.getByRole("button", { name: "Try again" }));
    await expect(await dialog.findByText(/"migrationState": "ready"/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save file" })).toBeEnabled();
    await expect(dialog.queryByText(/Private failure/)).not.toBeInTheDocument();
    await expect(args.loadSummary).toHaveBeenCalledTimes(2);
    await dismissDialog();
  },
};

export const SaveFailure: Story = {
  args: {
    saveBundle: fn(async () => {
      throw new Error("Private path /home/test/database.sqlite");
    }),
  },
  play: async ({ canvasElement, args }) => {
    const dialog = within(await openDialog(canvasElement, "Review support bundle", "Save support bundle"));
    await expect(await dialog.findByText(/"migrationState": "ready"/)).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "Save file" }));
    await expect(
      await dialog.findByText("Could not complete this support action. Please try again."),
    ).toBeVisible();
    await expect(dialog.queryByText(/Private path/)).not.toBeInTheDocument();
    await expect(dialog.getByRole("button", { name: "Save file" })).toBeEnabled();
    await expect(args.saveBundle).toHaveBeenCalledWith("en");
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
  },
};

export const CancelledDownload: Story = {
  args: { saveBundle: fn(async () => false) },
  play: async ({ canvasElement, args }) => {
    const dialog = within(await openDialog(canvasElement, "Review support bundle", "Save support bundle"));
    await expect(await dialog.findByText(/"migrationState": "ready"/)).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "Save file" }));
    await expect(args.saveBundle).toHaveBeenCalledWith("en");
    await expect(dialog.queryByText("Support bundle saved.")).not.toBeInTheDocument();
    await expect(dialog.getByRole("button", { name: "Save file" })).toBeEnabled();
    await dismissDialog();
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("button")).toHaveLength(7);
    const list = canvasElement.firstElementChild!;
    await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
  },
};
export const Pseudo: Story = { parameters: { locale: "en-XA" } };

const phoneTheme = createTheme({
  ...theme,
  breakpoints: { values: { ...theme.breakpoints.values, sm: 10000 } },
});
export const Phone: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider theme={phoneTheme}>
        <Story />
      </ThemeProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const dialog = await openDialog(canvasElement, "About Paintwarden");
    await expect(dialog).toHaveClass("MuiDialog-paperFullScreen");
    await expect(await within(dialog).findByText("macOS")).toBeVisible();
    await userEvent.click(dialog.parentElement!);
    await expect(dialog).toBeVisible();
    await dismissDialog();
    await expect(
      within(canvasElement).getByRole("button", { name: rowName("About Paintwarden") }),
    ).toHaveFocus();
  },
};

export const License: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(await openDialog(canvasElement, "License: PolyForm Noncommercial 1.0.0"));
    await expect(dialog.getByText(/Required Notice: Copyright \(c\) 2026 Ryan Moon/)).toHaveTextContent(
      "## Noncommercial Purposes",
    );
    await expect(dialog.getByText(/Required Notice: Copyright \(c\) 2026 Ryan Moon/)).toHaveAttribute(
      "lang",
      "en",
    );
    await dismissDialog();
    await expect(
      within(canvasElement).getByRole("button", {
        name: rowName("License: PolyForm Noncommercial 1.0.0"),
      }),
    ).toHaveFocus();
  },
};
export const LicenseJapanese: Story = {
  parameters: { locale: "ja" },
  play: async ({ canvasElement }) => {
    const dialog = within(await openDialog(canvasElement, "ライセンス: PolyForm Noncommercial 1.0.0"));
    await expect(dialog.getByText(/Required Notice: Copyright \(c\) 2026 Ryan Moon/)).toHaveTextContent(
      "## Noncommercial Purposes",
    );
    await dismissDialog();
  },
};

export const OpenSourceLicenses: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(await openDialog(canvasElement, "Open-source licenses"));
    await expect(
      await dialog.findByRole("region", { name: "Open-source licenses" }, { timeout: 10000 }),
    ).toHaveAttribute("lang", "en");
    await dismissDialog();
    await expect(
      within(canvasElement).getByRole("button", { name: rowName("Open-source licenses") }),
    ).toHaveFocus();
  },
};

export const BetaChannel: Story = {
  args: { loadSummary: fn(async () => ({ ...localSummary, version: "1.0.0-beta.1" })) },
  play: async ({ canvasElement }) => {
    const about = within(await openDialog(canvasElement, "About Paintwarden"));
    await expect(await about.findByText("Beta", { exact: true })).toBeVisible();
    await expect(about.queryByText("Stable", { exact: true })).not.toBeInTheDocument();
    await dismissDialog();
  },
};

export const PolicyLinks: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/Paintwarden is independent/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/Support bundles are optional local exports/)).not.toBeInTheDocument();
    const privacy = within(await openDialog(canvasElement, "Privacy"));
    await expect(privacy.getByText(/Support bundles are optional local exports/)).toBeVisible();
    await expect(
      privacy.getByRole("link", { name: "Privacy and network activity (English)" }),
    ).toHaveAttribute("href", "https://github.com/moonryc/paintwarden/blob/main/docs/privacy.md");
    await expect(
      privacy.getByRole("link", { name: "Report a security vulnerability (English)" }),
    ).toHaveAttribute("href", "https://github.com/moonryc/paintwarden/security/policy");
    await dismissDialog();
    const trademarks = within(await openDialog(canvasElement, "Trademarks & non-affiliation"));
    await expect(trademarks.getByText(/Paintwarden is independent/)).toBeVisible();
    await dismissDialog();
  },
};

export const Report: Story = {
  play: async ({ canvasElement, args }) => {
    const report = within(await openDialog(canvasElement, "Report a bug"));
    await expect(args.report).not.toHaveBeenCalled();
    await expect(
      report.getByText("Opens a GitHub issue in your browser with safe app details."),
    ).toBeVisible();
    await userEvent.click(report.getByRole("button", { name: "Report a bug" }));
    await expect(args.report).toHaveBeenCalledWith("en");
    await userEvent.click(report.getByRole("button", { name: "Save support bundle" }));
    const previewElement = await within(document.body).findByRole("dialog", {
      name: "Review support bundle",
    });
    await waitForDialogEntered(previewElement);
    const preview = within(previewElement);
    await expect(await preview.findByText(/"migrationState": "ready"/)).toBeVisible();
    await expect(args.saveBundle).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        within(document.body).queryByRole("dialog", { name: "Review support bundle" }),
      ).not.toBeInTheDocument(),
    );
    await expect(await within(document.body).findByRole("dialog", { name: "Report a bug" })).toBeVisible();
    await expect(report.getByRole("button", { name: "Save support bundle" })).toHaveFocus();
    await dismissDialog();
    await expect(within(canvasElement).getByRole("button", { name: rowName("Report a bug") })).toHaveFocus();
  },
};
