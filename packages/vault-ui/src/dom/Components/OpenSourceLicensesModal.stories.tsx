import { Button } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import noticesText from "../../../../../THIRD_PARTY_NOTICES.txt?raw";

import { theme } from "../theme";

import { OpenSourceLicensesModal } from "./OpenSourceLicensesModal";

function Viewer() {
  const { t } = useTranslation("components");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("noticesRead")}</Button>
      {open && <OpenSourceLicensesModal onClose={() => setOpen(false)} />}
    </>
  );
}

const meta = {
  title: "Components/OpenSourceLicensesModal",
  component: OpenSourceLicensesModal,
  args: { onClose: fn() },
  render: () => <Viewer />,
} satisfies Meta<typeof OpenSourceLicensesModal>;
export default meta;
type Story = StoryObj<typeof meta>;

export const KeyboardAndScrolling: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Read open-source licenses" });
    await userEvent.click(trigger);
    const dialog = await within(document.body).findByRole("dialog", { name: "Open-source licenses" });
    const content = await within(dialog).findByRole(
      "region",
      { name: "Open-source licenses" },
      { timeout: 10000 },
    );
    const close = within(dialog).getByRole("button", { name: "Close" });
    await expect(content).toHaveAttribute("lang", "en");
    // Exact equality checks that the generated text is neither summarized nor truncated.
    await expect(content.textContent).toBe(noticesText);
    await expect(dialog).toHaveFocus();
    await userEvent.tab();
    await expect(close).toHaveFocus();
    await userEvent.tab();
    await expect(content).toHaveFocus();
    await expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
    // Storybook's synthetic key events do not invoke native browser scrolling.
    content.scrollTop = content.scrollHeight;
    await waitFor(() => expect(content.scrollTop).toBeGreaterThan(0));
    await expect(close).toBeVisible();
    // The final notice can be reached without moving the fixed header off screen.
    await waitFor(() =>
      expect(content.scrollTop + content.clientHeight).toBeGreaterThanOrEqual(content.scrollHeight - 2),
    );
    await userEvent.tab();
    await expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(content).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const reopened = await within(document.body).findByRole("dialog", { name: "Open-source licenses" });
    await userEvent.click(within(reopened).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).not.toBeInTheDocument());
  },
};

export const Japanese: Story = {
  parameters: { locale: "ja" },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "オープンソースライセンスを読む" }),
    );
    const dialog = await within(document.body).findByRole("dialog", { name: "オープンソースライセンス" });
    const content = await within(dialog).findByRole(
      "region",
      { name: "オープンソースライセンス" },
      { timeout: 10000 },
    );
    await expect(content).toHaveAttribute("lang", "en");
    await expect(content.textContent).toBe(noticesText);
    await userEvent.keyboard("{Escape}");
  },
};

// Exercise the phone branch even when the headless runner uses a wide viewport.
const phoneTheme = createTheme({
  ...theme,
  breakpoints: { values: { ...theme.breakpoints.values, sm: 10000 } },
});
export const Phone: Story = {
  ...KeyboardAndScrolling,
  decorators: [
    (Story) => (
      <ThemeProvider theme={phoneTheme}>
        <Story />
      </ThemeProvider>
    ),
  ],
};
