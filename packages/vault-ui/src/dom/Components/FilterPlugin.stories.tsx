import Box from "@mui/material/Box";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { paintList } from "../storybook/fixtures";

import { FilterPluginSelect, useFilterPlugin } from "./FilterPlugin";

type Item = { name: string; sourceName?: string };

const items: Item[] = [
  ...paintList.map((paint) => ({ name: paint.name, sourceName: paint.sourceName })),
  { name: "Weathering Powder", sourceName: "Another source" },
];

// Shows the select with the items it lets through, since the hook holds the selection.
function FilterPluginDemo({ items, onChange }: { items: Item[]; onChange: () => void }) {
  const filter = useFilterPlugin(items);
  const shown = items.filter(filter.matches);
  return (
    <Box sx={{ maxWidth: 320 }}>
      <FilterPluginSelect filter={filter} onChange={onChange} />
      <Box sx={{ mt: 2, fontSize: 13, color: "var(--ink-faint)" }}>
        {shown.length} item{shown.length === 1 ? "" : "s"}
        {filter.description ? ` ${filter.description}` : ""}
      </Box>
      <Box component="ul" sx={{ mt: 1, pl: 2.5, fontSize: 13 }}>
        {shown.map((item) => (
          <li key={item.name}>{item.name}</li>
        ))}
      </Box>
    </Box>
  );
}

const meta = {
  title: "Components/FilterPlugin",
  component: FilterPluginDemo,
  args: { items, onChange: fn() },
} satisfies Meta<typeof FilterPluginDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// The select hides itself until some item comes from a plugin.
export const NoPluginItems: Story = { args: { items: [{ name: "Teal Mix" }] } };
