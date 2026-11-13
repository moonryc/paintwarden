import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { schemes, vault } from "../storybook/fixtures";
import type { State } from "../types";

import { SchemeSwatch } from "./SchemeSwatch";

const preview =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#0d407f"/><circle cx="4" cy="4" r="2.5" fill="#efe7d2"/></svg>',
  );

// The ocean scheme with a finished-model photo, which replaces the color gradient.
const withImage: State = {
  ...vault,
  colorSchemeImages: [
    {
      id: "user:scheme-image",
      schemeId: schemes.oceanCloak.id,
      imageUrl: preview,
      thumbnailUrl: null,
      imageType: null,
      method: null,
      sortOrder: 3,
    },
  ],
};

const meta = {
  title: "Components/SchemeSwatch",
  component: SchemeSwatch,
  args: { schemeId: schemes.crimsonArmour.id, size: "md" },
  argTypes: {
    size: { control: "inline-radio", options: ["xs", "sm", "md", "lg"] },
    schemeId: {
      control: "select",
      options: Object.values(schemes).map((scheme) => scheme.id),
    },
  },
} satisfies Meta<typeof SchemeSwatch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PaintGradient: Story = {};

export const WithImage: Story = {
  args: { schemeId: schemes.oceanCloak.id },
  parameters: { vault: withImage },
};

export const NoPaints: Story = { args: { schemeId: schemes.empty.id } };

export const Sizes: Story = {
  render: (args) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <SchemeSwatch key={size} schemeId={args.schemeId} size={size} />
      ))}
    </Box>
  ),
};
