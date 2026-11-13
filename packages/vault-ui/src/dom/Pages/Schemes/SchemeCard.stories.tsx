import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { Profiler, useRef, useState, type ComponentProps, type RefObject } from "react";
import { expect, fn, userEvent, waitFor } from "storybook/test";

import { column } from "../../storybook/decorators";
import { paints, vault } from "../../storybook/fixtures";
import type { State } from "../../types";
import { VAULT_QUERY } from "../../utils/vault-query";

import { SchemeCard } from "./SchemeCard";

const meta = {
  title: "Schemes/SchemeCard",
  component: SchemeCard,
  args: {
    scheme: vault.colorSchemes[0],
    index: 0,
    available: 2,
    total: 3,
    onOpen: fn(),
    onKeyDown: fn(),
  },
  decorators: [column(360)],
} satisfies Meta<typeof SchemeCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MissingPaints: Story = {};
export const ReadyToPaint: Story = { args: { available: 3 } };
export const Empty: Story = { args: { scheme: vault.colorSchemes[2], available: 0, total: 0 } };

export const OpenAndKeyboard: Story = {
  args: { index: 7 },
  play: async ({ args, canvas }) => {
    const card = canvas.getByRole("button");
    await userEvent.click(card);
    await expect(args.onOpen).toHaveBeenCalledWith(args.scheme.id);
    await userEvent.keyboard("{ArrowRight}");
    await expect(args.onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "ArrowRight" }), 7);
  },
};

// Query mutations and counter sampling are siblings: neither action renders the card's parent.
function CacheControls({ commits }: { commits: RefObject<number> }) {
  const client = useQueryClient();
  const [sample, setSample] = useState(0);
  return (
    <div>
      <button onClick={() => setSample(commits.current)}>Read card commits</button>
      <span data-testid="card-commits">{sample}</span>
      <button
        onClick={() =>
          client.setQueryData<State>(VAULT_QUERY, (data) =>
            data
              ? { ...data, miniatures: data.miniatures.map((mini) => ({ ...mini, notes: "Unrelated edit" })) }
              : data,
          )
        }
      >
        Update unrelated notes
      </button>
      <button
        onClick={() =>
          client.setQueryData<State>(VAULT_QUERY, (data) =>
            data
              ? {
                  ...data,
                  catalog: data.catalog.map((paint) =>
                    paint.id === paints.black.id ? { ...paint, name: "Updated fixture paint" } : paint,
                  ),
                }
              : data,
          )
        }
      >
        Rename scheme paint
      </button>
      <button
        onClick={() =>
          client.setQueryData<State>(VAULT_QUERY, (data) =>
            data
              ? {
                  ...data,
                  miniatureColorSchemes: [
                    ...data.miniatureColorSchemes,
                    { miniatureId: "fixture:second", schemeId: vault.colorSchemes[0].id, sortOrder: 0 },
                  ],
                }
              : data,
          )
        }
      >
        Link second miniature
      </button>
    </div>
  );
}

function ProfiledCard(props: ComponentProps<typeof SchemeCard>) {
  const commits = useRef(0);
  return (
    <>
      <CacheControls commits={commits} />
      <Profiler
        id="scheme"
        onRender={() => {
          commits.current += 1;
        }}
      >
        <SchemeCard {...props} />
      </Profiler>
    </>
  );
}

export const SelectiveCacheSubscriptions: Story = {
  render: (args) => <ProfiledCard {...args} />,
  play: async ({ canvas }) => {
    const readCommits = async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Read card commits" }));
      return Number(canvas.getByTestId("card-commits").textContent);
    };
    const baseline = await readCommits();
    await expect(baseline).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole("button", { name: "Update unrelated notes" }));
    await expect(await readCommits()).toBe(baseline);
    await userEvent.click(canvas.getByRole("button", { name: "Rename scheme paint" }));
    await waitFor(() => expect(canvas.getByText(/Updated fixture paint/)).toBeInTheDocument());
    const afterRename = await readCommits();
    await expect(afterRename).toBeGreaterThan(baseline);
    await userEvent.click(canvas.getByRole("button", { name: "Link second miniature" }));
    await waitFor(() => expect(canvas.getByText(/Used by 2 miniatures/)).toBeInTheDocument());
    await expect(await readCommits()).toBeGreaterThan(afterRename);
  },
};
