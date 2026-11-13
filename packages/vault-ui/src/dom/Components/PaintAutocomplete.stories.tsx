import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, waitFor } from "storybook/test";

import { column } from "../storybook/decorators";
import { paintList, paints } from "../storybook/fixtures";
import { StoryGraphQL } from "../storybook/graphql";
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

const serverOnlyPaint = {
  ...paints.skyBlue,
  id: "server-only",
  name: "Server-only paint",
  sourceName: null,
  sourceLogoUrl: null,
  inventory: null,
  available: false,
  hasActiveSubstitution: false,
  brokenReason: null,
  missingStock: true,
  brokenSubstitution: false,
  activeSubstitution: null,
};
export const ApolloServerOptions: Story = {
  args: { paints: [] },
  decorators: [
    (Story) => (
      <StoryGraphQL
        respond={(operation) => ({
          paintOptions: {
            revision: { epoch: "story", seq: "1" },
            items: (operation.variables.excludeIds as string[]).includes(serverOnlyPaint.id)
              ? []
              : [serverOnlyPaint],
          },
        })}
      >
        <Story />
      </StoryGraphQL>
    ),
  ],
  play: async ({ userEvent, args }) => {
    const picker = screen.getByRole("combobox", { name: "Add paint" });
    await userEvent.type(picker, "srver");
    const option = await screen.findByRole("option", { name: /Server-only paint/ });
    await userEvent.click(option);
    await expect(args.onChoose).toHaveBeenCalledWith(expect.objectContaining({ id: "server-only" }));
    await expect(picker).toHaveValue("");
    await userEvent.type(picker, "server");
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: /Server-only paint/ })).not.toBeInTheDocument(),
    );
    await expect(await screen.findByText("No more paints match.")).toBeVisible();
  },
};
