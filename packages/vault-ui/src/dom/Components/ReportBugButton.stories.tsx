import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { waitForDialogEntered } from "../storybook/dialog";

import { ReportBugButton } from "./ReportBugButton";

const meta = {
  title: "Components/ReportBugButton",
  component: ReportBugButton,
  args: { report: fn(async () => undefined) },
} satisfies Meta<typeof ReportBugButton>;
export default meta;
type Story = StoryObj<typeof meta>;

async function openReport(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole("button", { name: "Report a bug" }));
  const dialog = await within(document.body).findByRole("dialog", { name: "Report a bug" });
  await waitForDialogEntered(dialog);
  return within(dialog);
}

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await openReport(canvasElement);
    // Opening the modal must not launch the browser or create a report.
    await expect(args.report).not.toHaveBeenCalled();
    await expect(
      dialog.getByText("Opens a GitHub issue in your browser with safe app details."),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save support bundle" })).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "Report a bug" }));
    await expect(args.report).toHaveBeenCalledWith("en");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
    await expect(within(canvasElement).getByRole("button", { name: "Report a bug" })).toHaveFocus();
  },
};

export const CancelWithoutReporting: Story = {
  play: async ({ canvasElement, args }) => {
    const dialog = await openReport(canvasElement);
    await userEvent.click(dialog.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.report).not.toHaveBeenCalled();
    await expect(within(canvasElement).getByRole("button", { name: "Report a bug" })).toHaveFocus();
  },
};

export const Failure: Story = {
  args: {
    report: fn(async () => {
      throw new Error("Private internal failure must not be displayed");
    }),
  },
  play: async ({ canvasElement, args }) => {
    const dialog = await openReport(canvasElement);
    await expect(args.report).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole("button", { name: "Report a bug" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Could not complete this support action. Please try again.",
    );
    await expect(dialog.queryByText(/Private internal failure/)).not.toBeInTheDocument();
    await expect(within(canvasElement).queryByRole("alert")).not.toBeInTheDocument();
    await expect(dialog.getByRole("button", { name: "Report a bug" })).toBeEnabled();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
  },
};

export const Retry: Story = {
  args: {
    report: fn(async () => undefined),
  },
  play: async ({ canvasElement, args }) => {
    args.report!.mockRejectedValueOnce(new Error("Private failure"));
    const dialog = await openReport(canvasElement);
    await userEvent.click(dialog.getByRole("button", { name: "Report a bug" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Could not complete this support action.",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Report a bug" }));
    await expect(args.report).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(dialog.queryByRole("alert")).not.toBeInTheDocument());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
  },
};

export const NoInlineHint: Story = {
  args: { showHint: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/Opens a GitHub issue/)).not.toBeInTheDocument();
    const dialog = await openReport(canvasElement);
    await expect(dialog.getByText(/Opens a GitHub issue/)).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
  },
};
