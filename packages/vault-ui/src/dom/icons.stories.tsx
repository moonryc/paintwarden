import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentType } from "react";

import * as icons from "./icons";
import type { AppIconProps } from "./icons";

// Everything icons.tsx exports except its icon factory is an icon component.
const { appIcon: _appIcon, ...iconComponents } = icons as typeof icons &
  Record<string, ComponentType<AppIconProps>>;

const tileSx = {
  display: "grid",
  justifyItems: "center",
  gap: 1,
  p: 1.5,
  borderRadius: 2,
  bgcolor: "var(--surface)",
  border: "1px solid var(--line)",
  fontSize: 12,
  color: "var(--ink-soft)",
} as const;

// Every icon the shared UI exports, at a chosen size.
function IconGallery({ size }: { size: number }) {
  const entries = Object.entries(iconComponents);
  return (
    <Box
      component="ul"
      sx={{
        listStyle: "none",
        m: 0,
        p: 0,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        gap: 1,
      }}
    >
      {entries.map(([name, Icon]) => (
        <Box component="li" key={name} sx={tileSx}>
          <Icon size={size} />
          {name}
        </Box>
      ))}
      <Box component="li" sx={tileSx}>
        <icons.Heart size={size} fill="currentColor" />
        Heart (filled)
      </Box>
    </Box>
  );
}

const meta = {
  title: "Foundations/Icons",
  component: IconGallery,
  args: { size: 24 },
  argTypes: { size: { control: { type: "range", min: 12, max: 48, step: 1 } } },
} satisfies Meta<typeof IconGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gallery: Story = {};
