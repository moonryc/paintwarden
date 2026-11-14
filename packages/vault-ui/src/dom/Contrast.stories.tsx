import { Alert, Box, Button } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { expect, fn, userEvent, within } from "storybook/test";

import { i18n } from "./i18n";
import { LanguagePicker } from "./LanguagePicker";
import { NavPanel } from "./Layout/NavPanel";
import { computedContrast } from "./storybook/contrast";
import type { Tab } from "./types";

function ContrastStates() {
  const { t } = useTranslation("common");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [saved, setSaved] = useState(false);
  return (
    <Box component="main" sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
      <Box sx={{ width: 280, bgcolor: "var(--surface)" }}>
        <NavPanel
          tab={tab}
          go={setTab}
          counts={{ wishlist: 15 }}
          displayName="Sample owner"
          onAddMiniature={fn()}
          onAddPaint={fn()}
          onAddScheme={fn()}
          onAccount={fn()}
        />
      </Box>
      <Box sx={{ width: 320 }}>
        <LanguagePicker />
        <Button onClick={() => setSaved(true)}>{t("save")}</Button>
        {saved && (
          <Alert severity="success" variant="filled">
            {t("save")}
          </Alert>
        )}
      </Box>
    </Box>
  );
}

const meta = {
  title: "App/Contrast states",
  render: () => <ContrastStates />,
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const check: Story["play"] = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const badge = await canvas.findByText("15");
  const wishlist = badge.closest('[role="button"]')!;
  await expect(computedContrast(badge)).toBeGreaterThanOrEqual(4.5);
  await userEvent.hover(wishlist);
  await expect(computedContrast(badge)).toBeGreaterThanOrEqual(4.5);
  await userEvent.click(wishlist);
  await expect(wishlist).toHaveClass("Mui-selected");
  await expect(computedContrast(badge)).toBeGreaterThanOrEqual(4.5);
  await userEvent.unhover(wishlist);
  await expect(computedContrast(badge)).toBeGreaterThanOrEqual(4.5);

  // Keyboard focus, not a programmatic focus call on the select. Check the
  // floating label while focused, which steady-state axe scans otherwise miss.
  const language = canvas.getByRole("combobox");
  for (let count = 0; count < 30 && document.activeElement !== language; count++) await userEvent.tab();
  await expect(language).toHaveFocus();
  const label = canvasElement.querySelector(".MuiInputLabel-root")!;
  await expect(label).toHaveClass("Mui-focused");
  await expect(computedContrast(label)).toBeGreaterThanOrEqual(4.5);

  await userEvent.click(canvas.getByRole("button", { name: i18n.t("common:save") }));
  const alert = await canvas.findByRole("alert");
  await expect(computedContrast(alert)).toBeGreaterThanOrEqual(4.5);
  // Leave the interaction-state label focused for the story's axe scan.
  await userEvent.tab({ shift: true });
  await expect(language).toHaveFocus();
};

export const English: Story = { parameters: { locale: "en" }, play: check };
export const German: Story = { parameters: { locale: "de" }, play: check };
export const Japanese: Story = { parameters: { locale: "ja" }, play: check };
