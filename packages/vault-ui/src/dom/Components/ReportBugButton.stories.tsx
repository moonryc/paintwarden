import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { ReportBugButton } from "./ReportBugButton";

const meta = {
  title: "Components/ReportBugButton",
  component: ReportBugButton,
  args: { report: fn(async () => undefined) },
} satisfies Meta<typeof ReportBugButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Report a bug" }));
    await expect(args.report).toHaveBeenCalledWith("en");
  },
};
export const Failure: Story = {
  args: {
    report: fn(async () => {
      throw new Error("Private internal failure must not be displayed");
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Report a bug" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Could not complete this support action. Please try again.",
    );
    await expect(canvas.queryByText(/Private internal failure/)).not.toBeInTheDocument();
  },
};
