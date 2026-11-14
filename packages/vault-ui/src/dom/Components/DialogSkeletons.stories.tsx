import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { expect, fn, userEvent, within } from "storybook/test";

import { ColorSchemesDialog } from "../Modals/ColorSchemesDialog";
import { MiniatureForm } from "../Modals/MiniatureForm";
import { PaintForm } from "../Modals/PaintForm";
import { StoryGraphQL } from "../storybook/graphql";

import { DialogSkeleton } from "./DialogSkeletons";

const meta = {
  title: "Components/DialogSkeletons",
  component: DialogSkeleton,
  args: { kind: "paint", title: "Add paint", onClose: fn() },
  parameters: { docs: { story: { inline: false, iframeHeight: 800 } } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const status = await body.findByRole("status");
    await expect(status).toHaveAttribute("aria-live", "polite");
    await expect(body.getAllByRole("status")).toHaveLength(1);
    await expect(body.getAllByRole("button")).toHaveLength(1);
  },
} satisfies Meta<typeof DialogSkeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Paint: Story = {};
export const Miniature: Story = { args: { kind: "miniature", title: "Add a miniature" } };
export const Schemes: Story = { args: { kind: "schemes", title: "Color schemes" } };
export const Plugins: Story = { args: { kind: "plugins", title: "Plugins" } };
export const Project: Story = { args: { kind: "project", title: "Miniature" } };

function FrameParity({ kind }: { kind: "paint" | "miniature" | "schemes" }) {
  const [pending, setPending] = useState(false);
  const { t } = useTranslation("components");
  const title =
    kind === "paint" ? t("addPaint") : kind === "miniature" ? t("addAMiniature") : t("colorSchemes");
  const close = () => setPending(true);
  if (pending) return <DialogSkeleton kind={kind} title={title} onClose={() => undefined} />;
  if (kind === "paint") return <PaintForm onClose={close} onSave={async () => undefined} />;
  if (kind === "miniature") return <MiniatureForm onClose={close} onSubmit={async () => undefined} />;
  return (
    <StoryGraphQL respond={() => ({})}>
      <ColorSchemesDialog initialId={null} onClose={close} />
    </StoryGraphQL>
  );
}

const parityPlay: Story["play"] = async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body);
  const loaded = await body.findByRole("dialog");
  const before = loaded.getBoundingClientRect();
  await userEvent.click(within(loaded).getByRole("button", { name: "Close" }));
  await body.findByRole("status");
  const after = body.getByRole("dialog").getBoundingClientRect();
  await expect(Math.abs(before.width - after.width)).toBeLessThanOrEqual(2);
  await expect(
    Math.abs(before.height - after.height),
    `loaded ${before.height}, skeleton ${after.height}`,
  ).toBeLessThanOrEqual(2);
};
export const PaintFrameParity: Story = { render: () => <FrameParity kind="paint" />, play: parityPlay };
export const MiniatureFrameParity: Story = {
  render: () => <FrameParity kind="miniature" />,
  play: parityPlay,
};
export const SchemeFrameParity: Story = { render: () => <FrameParity kind="schemes" />, play: parityPlay };

export const ReducedMotion: Story = {
  beforeEach: () => {
    const original = window.matchMedia;
    window.matchMedia = (query) => {
      const result = original.call(window, query);
      if (query === "(prefers-reduced-motion: reduce)")
        Object.defineProperty(result, "matches", { value: true });
      return result;
    };
    return () => {
      window.matchMedia = original;
    };
  },
  play: async ({ canvasElement }) => {
    const shapes = canvasElement.ownerDocument.querySelectorAll(".MuiSkeleton-root");
    await expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      await expect(shape).toHaveAttribute("aria-hidden", "true");
      await expect(getComputedStyle(shape).animationName).toBe("none");
    }
  },
};
