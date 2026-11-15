import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

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

export const Desktop: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("macOS")).toBeInTheDocument();
    await expect(canvas.getByText("Stable", { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Save support bundle" }));
    const dialog = within(
      await within(document.body).findByRole("dialog", { name: "Review support bundle" }),
    );
    await expect(args.saveBundle).not.toHaveBeenCalled();
    await expect(dialog.getByText(/Nothing is uploaded automatically/)).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect(args.saveBundle).not.toHaveBeenCalled();
    await userEvent.click(await canvas.findByRole("button", { name: "Save support bundle" }));
    await userEvent.click(
      within(await within(document.body).findByRole("dialog")).getByRole("button", { name: "Save file" }),
    );
    await expect(args.saveBundle).toHaveBeenCalledWith("en");
    await expect(await canvas.findByText("Support bundle saved.")).toBeInTheDocument();
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
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Server version")).toBeInTheDocument();
    await expect(canvas.getByText(/Server logs are not available in this version/)).toBeInTheDocument();
  },
};
export const SummaryFailure: Story = {
  args: {
    loadSummary: fn(async () => {
      throw new Error("Private internal failure");
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Could not complete this support action.",
    );
    await expect(canvas.getByRole("button", { name: "Save support bundle" })).toBeDisabled();
    await expect(canvas.queryByText(/Private internal failure/)).not.toBeInTheDocument();
  },
};
export const SaveFailure: Story = {
  args: {
    saveBundle: fn(async () => {
      throw new Error("Private path /home/test/database.sqlite");
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("macOS")).toBeInTheDocument();
    await expect(canvas.getByText("Stable", { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Save support bundle" }));
    const dialog = within(await within(document.body).findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Save file" }));
    await expect(
      await dialog.findByText("Could not complete this support action. Please try again."),
    ).toBeInTheDocument();
    await expect(dialog.queryByText(/Private path/)).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
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
};
export const Pseudo: Story = { parameters: { locale: "en-XA" } };

export const License: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("License: PolyForm Noncommercial 1.0.0")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Read license" }));
    const dialog = within(
      await within(document.body).findByRole("dialog", { name: "License: PolyForm Noncommercial 1.0.0" }),
    );
    await expect(dialog.getByText(/Required Notice: Copyright \(c\) 2026 Ryan Moon/)).toHaveTextContent(
      "## Noncommercial Purposes",
    );
    await expect(dialog.getByText(/Required Notice: Copyright \(c\) 2026 Ryan Moon/)).toHaveAttribute(
      "lang",
      "en",
    );
    await userEvent.keyboard("{Escape}");
    await expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument();
  },
};
export const LicenseJapanese: Story = {
  parameters: { locale: "ja" },
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "ライセンスを読む" }));
    const dialog = within(
      await within(document.body).findByRole("dialog", { name: "ライセンス: PolyForm Noncommercial 1.0.0" }),
    );
    await expect(dialog.getByText(/Required Notice: Copyright \(c\) 2026 Ryan Moon/)).toHaveTextContent(
      "## Noncommercial Purposes",
    );
    await userEvent.keyboard("{Escape}");
  },
};

export const OpenSourceLicenses: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Open-source licenses")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Read open-source licenses" }));
    const dialog = within(await within(document.body).findByRole("dialog", { name: "Open-source licenses" }));
    await expect(
      await dialog.findByRole("region", { name: "Open-source licenses" }, { timeout: 10000 }),
    ).toHaveAttribute("lang", "en");
    await userEvent.keyboard("{Escape}");
    await expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument();
  },
};

export const BetaChannel: Story = {
  args: { loadSummary: fn(async () => ({ ...localSummary, version: "1.0.0-beta.1" })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Beta", { exact: true })).toBeVisible();
    await expect(canvas.queryByText("Stable", { exact: true })).not.toBeInTheDocument();
  },
};
