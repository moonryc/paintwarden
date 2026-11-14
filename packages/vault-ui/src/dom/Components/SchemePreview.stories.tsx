import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { schemes, vault } from "../storybook/fixtures";
import type { ColorScheme } from "../types";
import { schemeOrderEntries } from "../utils/scheme-order";

import { SchemePreview } from "./SchemePreview";

const scheme = (id: string) => vault.colorSchemes.find((item) => item.id === id) as ColorScheme;

const meta = {
  title: "Components/SchemePreview",
  component: SchemePreview,
  args: {
    active: scheme(schemes.crimsonArmour.id),
    entries: schemeOrderEntries(vault, schemes.crimsonArmour.id),
    projections: vault.catalog.map((paint) => ({
      paint,
      record: vault.paintRecords[paint.id],
      available: true,
      substitution: null,
      broken: false,
    })),
    availableCount: 1,
    paintCount: 2,
    onEdit: fn(),
    onClose: fn(),
  },
  // Vault data is too large to edit usefully in the controls panel.
  argTypes: { active: { control: false }, entries: { control: false } },
} satisfies Meta<typeof SchemePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { active: scheme(schemes.empty.id), entries: [], projections: [], availableCount: 0, paintCount: 0 },
};

export const LocalThumbnailAndOriginalLightbox: Story = {
  args: {
    entries: [
      {
        id: "reference",
        type: "IMAGE",
        sortOrder: 0,
        imageUrl: "/api/catalog-source-images/original.webp",
        thumbnailUrl: "/api/catalog-source-images/preview.webp",
        imageType: null,
        method: null,
      },
    ],
  },
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body);
    const preview = screen.getByRole("img", { name: `${args.active.name} recipe example` });
    await expect(preview).toHaveAttribute("src", "/api/catalog-source-images/preview.webp?w=320");
    await expect(preview).toHaveAttribute(
      "srcset",
      [160, 320, 640]
        .map((width) => `/api/catalog-source-images/preview.webp?w=${width} ${width}w`)
        .join(", "),
    );
    await expect(preview).toHaveAttribute("sizes");
    await expect(preview).toHaveAttribute("loading", "lazy");
    await expect(preview).toHaveAttribute("decoding", "async");
    await expect(preview).toHaveStyle({ aspectRatio: "4 / 3" });
    await userEvent.click(screen.getByRole("button", { name: `View ${args.active.name} reference image` }));
    const viewer = screen
      .getAllByRole("img", { name: `${args.active.name} recipe example` })
      .find((image) => image.getAttribute("src") === "/api/catalog-source-images/original.webp");
    await waitFor(() => expect(viewer).toBeVisible());
    await expect(viewer).not.toHaveAttribute("srcset");
    await userEvent.click(screen.getAllByRole("button", { name: "Close image viewer" })[0]);
  },
};
