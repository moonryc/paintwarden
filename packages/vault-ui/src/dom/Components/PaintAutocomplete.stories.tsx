import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

import { column } from "../storybook/decorators";
import { paintList, paints } from "../storybook/fixtures";
import type { Paint } from "../types";

import { PaintAutocomplete } from "./PaintAutocomplete";

// Keeps the query and adds chosen paints to the excluded list, as the recipe editor does.
function RecipePicker({
  paints: options,
  excludedIds,
  query,
  onChoose,
}: {
  paints: Paint[];
  excludedIds: string[];
  query: string;
  onChoose: (paint: Paint) => void;
}) {
  const [text, setText] = useState(query);
  const [chosen, setChosen] = useState(excludedIds);
  return (
    <PaintAutocomplete
      paints={options}
      excludedIds={chosen}
      query={text}
      onQueryChange={setText}
      onChoose={(paint) => {
        setChosen((ids) => [...ids, paint.id]);
        setText("");
        onChoose(paint);
      }}
    />
  );
}

const meta = {
  title: "Components/PaintAutocomplete",
  component: RecipePicker,
  args: { paints: paintList, excludedIds: [], query: "", onChoose: fn() },
  argTypes: { paints: { control: false } },
  decorators: [column(420)],
} satisfies Meta<typeof RecipePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithQuery: Story = { args: { query: "blue" } };

export const SomeAlreadyInRecipe: Story = {
  args: { query: "b", excludedIds: [paints.black.id, paints.blackWash.id] },
};

export const NoMatches: Story = { args: { query: "zzzz" } };
