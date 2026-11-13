import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

import { FilterToolbar } from "./FilterToolbar";

// The pages fill the toolbar with dropdown filters like this one.
function Filters() {
  const [filter, setFilter] = useState("ALL");
  return (
    <TextField
      select
      fullWidth
      size="small"
      label="Status"
      value={filter}
      onChange={(event) => setFilter(event.target.value)}
    >
      <MenuItem value="ALL">All</MenuItem>
      <MenuItem value="OWNED">Owned</MenuItem>
      <MenuItem value="WISHLIST">Wishlist</MenuItem>
    </TextField>
  );
}

const meta = {
  title: "Components/FilterToolbar",
  component: FilterToolbar,
  args: { search: "", setSearch: fn(), placeholder: "Search miniatures", children: <Filters /> },
  argTypes: { children: { control: false } },
  render: function Render(args) {
    const [search, setSearch] = useState(args.search);
    return (
      <FilterToolbar
        {...args}
        search={search}
        setSearch={(value) => {
          setSearch(value);
          args.setSearch(value);
        }}
      />
    );
  },
} satisfies Meta<typeof FilterToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// A typed search shows a clear button; Escape also clears it.
export const WithSearch: Story = { args: { search: "knight" } };

export const WideSearch: Story = {
  args: {
    wideSearch: true,
    placeholder: "Search paints, brands, or ranges",
    children: (
      <TextField select fullWidth size="small" label="Brand" defaultValue="all">
        <MenuItem value="all">All brands</MenuItem>
        <MenuItem value="example">Example Paints</MenuItem>
      </TextField>
    ),
  },
};

export const SingleLineFilters: Story = { args: { singleLineFilters: true } };
