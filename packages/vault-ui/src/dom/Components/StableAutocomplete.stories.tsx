import { Button, TextField } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { SEARCH_DEBOUNCE_MS } from "../utils/use-search-results";

import { StableAutocomplete } from "./StableAutocomplete";

const items = Array.from({ length: 40 }, (_, index) => ({ id: index, name: `Model ${index + 1}` }));

function SearchFixture({ label = "Model", multiple = false, local = false }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<typeof items>([]);
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState(1);
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(
      () => {
        setOptions(query === "none" ? [] : items.slice(0, query ? 3 : pages * 10));
        setLoading(false);
      },
      local ? 0 : SEARCH_DEBOUNCE_MS + 400,
    );
    return () => clearTimeout(timer);
  }, [query, pages, local]);
  return (
    <StableAutocomplete
      multiple={multiple}
      options={options}
      loading={loading}
      inputValue={query}
      onInputChange={(_, value, reason) => {
        if (reason === "input" || reason === "clear") setQuery(value);
      }}
      filterOptions={(options) => options}
      getOptionLabel={(item) => item.name}
      hasNextPage={!query && pages < 4}
      onLoadMore={() => setPages((pages) => pages + 1)}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}

const meta = {
  title: "Components/StableAutocomplete",
  component: SearchFixture,
} satisfies Meta<typeof SearchFixture>;
export default meta;
type Story = StoryObj<typeof meta>;

function boxes(input: HTMLElement) {
  const list = document.querySelector('[role="listbox"]');
  const popup = document.querySelector(".MuiAutocomplete-popper");
  if (!list || !popup) throw new Error("Search popup disappeared");
  return [input, list, popup].map((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return [x, y, width, height];
  });
}

async function stableSearch(canvasElement: HTMLElement, label: string) {
  const canvas = within(canvasElement);
  const body = within(document.body);
  const input = canvas.getByRole("combobox", { name: label });
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.click(input);
  await waitFor(() => expect(body.getAllByRole("option")).toHaveLength(10));
  const initial = boxes(input);
  for (const letter of "model") {
    await userEvent.type(input, letter);
    // Check both the keystroke and the delayed loading indicator, not only settlement.
    for (const current of [
      boxes(input),
      await new Promise<number[][]>((resolve) => setTimeout(() => resolve(boxes(input)), 320)),
    ]) {
      current.forEach((box, index) =>
        box.forEach((value, axis) => expect(Math.abs(value - initial[index][axis])).toBeLessThanOrEqual(1)),
      );
      await expect(body.queryByText(/Loading…/)).not.toBeInTheDocument();
      await expect(body.getAllByRole("option").length).toBeGreaterThan(0);
    }
  }
  await waitFor(() => expect(body.getAllByRole("option")).toHaveLength(3));
  await expect(body.getByRole("listbox")).toHaveAttribute("aria-busy", "false");
  await userEvent.clear(input);
  await userEvent.type(input, "none");
  // Keep the accepted rows during rapid typing, then publish the settled empty result.
  await expect(body.getAllByRole("option")).toHaveLength(3);
  await expect(await body.findByText("No options")).toBeVisible();
  await userEvent.keyboard("{Escape}");
}

export const Model: Story = {
  play: async ({ canvasElement }) => stableSearch(canvasElement, "Model"),
};
export const Paint: Story = {
  args: { label: "Paint" },
  play: async ({ canvasElement }) => stableSearch(canvasElement, "Paint"),
};
export const SchemeMultiple: Story = {
  args: { label: "Scheme", multiple: true },
  play: async ({ canvasElement }) => stableSearch(canvasElement, "Scheme"),
};
export const FolderLocal: Story = {
  args: { label: "Folder", local: true },
};
export const FirstLoadAndInfiniteScroll: Story = {
  play: async ({ canvasElement }) => {
    const body = within(document.body);
    const input = within(canvasElement).getByRole("combobox", { name: "Model" });
    const before = input.getBoundingClientRect();
    await expect(input).toBeDisabled();
    await expect(input).toHaveAttribute("placeholder", "Loading…");
    await expect(body.queryByRole("progressbar")).not.toBeInTheDocument();
    await waitFor(() => expect(input).toBeEnabled());
    const after = input.getBoundingClientRect();
    for (const axis of ["x", "y", "width", "height"] as const)
      await expect(Math.abs(after[axis] - before[axis])).toBeLessThanOrEqual(0.5);
    await userEvent.click(input);
    await waitFor(() => expect(body.getAllByRole("option")).toHaveLength(10));
    const list = body.getByRole("listbox");
    list.scrollTop = list.scrollHeight;
    const top = list.scrollTop;
    list.dispatchEvent(new Event("scroll", { bubbles: true }));
    await waitFor(() => expect(body.getAllByRole("option")).toHaveLength(20));
    await expect(body.getByRole("listbox")).toBe(list);
    await expect(list.scrollTop).toBe(top);
    await userEvent.keyboard("{Escape}");
  },
};

function FreshValueFixture({ multiple = false }) {
  const [query, setQuery] = useState(multiple ? "" : items[0].name);
  const [id, setId] = useState(0);
  const selected = { ...items[id] };
  return (
    <>
      <StableAutocomplete
        multiple={multiple}
        options={items}
        value={multiple ? [selected] : selected}
        inputValue={query}
        onInputChange={(_, value) => setQuery(value)}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={(params) => <TextField {...params} label="Equivalent selection" />}
      />
      <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setId(1)}>
        Change selection
      </Button>
    </>
  );
}

export const EquivalentValuePreservesTyping: Story = {
  render: () => <FreshValueFixture />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "Equivalent selection" });
    await userEvent.clear(input);
    await userEvent.type(input, "rapid search");
    await expect(input).toHaveValue("rapid search");
    await userEvent.click(canvas.getByRole("button", { name: "Change selection" }));
    await expect(input).toHaveValue("Model 2");
    await userEvent.tab();
  },
};
export const EquivalentMultipleValuePreservesTyping: Story = {
  render: () => <FreshValueFixture multiple />,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox", { name: "Equivalent selection" });
    await userEvent.type(input, "rapid search");
    await expect(input).toHaveValue("rapid search");
    await userEvent.tab();
  },
};
