import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import { Profiler, useRef, useState, type RefObject } from "react";
import { expect, fn, userEvent, waitFor } from "storybook/test";

import { list } from "../storybook/decorators";
import { paints } from "../storybook/fixtures";
import type { State } from "../types";
import { VAULT_QUERY } from "../utils/vault-query";

import { LibraryPaintRow } from "./LibraryPaintRow";

const meta = {
  title: "Components/LibraryPaintRow",
  component: LibraryPaintRow,
  args: {
    paint: paints.black,
    onOpenPaint: fn(),
  },
  decorators: [list()],
} satisfies Meta<typeof LibraryPaintRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Owned: Story = {};

export const Wishlisted: Story = { args: { paint: paints.scarlet } };

export const Untracked: Story = { args: { paint: paints.gold } };

// Available through a mix of other paints, so it can't be marked owned directly.
export const Substituted: Story = { args: { paint: paints.royalBlue } };

export const CustomPaint: Story = { args: { paint: paints.tealMix } };

// Sampling commits lives in a sibling, so reading the counter cannot itself render the rows.
function CacheControls({ commits }: { commits: RefObject<{ direct: number; mix: number }> }) {
  const client = useQueryClient();
  const [sample, setSample] = useState({ direct: 0, mix: 0 });
  return (
    <li>
      <button onClick={() => setSample({ ...commits.current })}>Read row commits</button>
      <span data-testid="direct-commits">{sample.direct}</span>
      <span data-testid="mix-commits">{sample.mix}</span>
      <button
        onClick={() =>
          client.setQueryData<State>(
            VAULT_QUERY,
            (data) =>
              data && {
                ...data,
                miniatures: data.miniatures.map((miniature) => ({
                  ...miniature,
                  title: `${miniature.title} updated`,
                })),
              },
          )
        }
      >
        Update unrelated miniature
      </button>
      <button
        onClick={() =>
          client.setQueryData<State>(
            VAULT_QUERY,
            (data) =>
              data && {
                ...data,
                paintRecords: {
                  ...data.paintRecords,
                  [paints.black.id]: { ...data.paintRecords[paints.black.id], quantity: 7 },
                },
              },
          )
        }
      >
        Update direct quantity
      </button>
      <button
        onClick={() =>
          client.setQueryData<State>(
            VAULT_QUERY,
            (data) =>
              data && {
                ...data,
                paintRecords: {
                  ...data.paintRecords,
                  [paints.skyBlue.id]: { state: "OWNED", stockLevel: "EMPTY", quantity: 0 },
                },
              },
          )
        }
      >
        Empty mix ingredient
      </button>
    </li>
  );
}

function ProfiledRows({ onOpenPaint }: { onOpenPaint: (id: string) => void }) {
  const commits = useRef({ direct: 0, mix: 0 });
  return (
    <>
      <CacheControls commits={commits} />
      <Profiler
        id="direct"
        onRender={() => {
          commits.current.direct += 1;
        }}
      >
        <LibraryPaintRow paint={paints.black} onOpenPaint={onOpenPaint} />
      </Profiler>
      <Profiler
        id="mix"
        onRender={() => {
          commits.current.mix += 1;
        }}
      >
        <LibraryPaintRow paint={paints.royalBlue} onOpenPaint={onOpenPaint} />
      </Profiler>
    </>
  );
}

export const SelectiveCacheSubscriptions: Story = {
  render: (args) => <ProfiledRows onOpenPaint={args.onOpenPaint} />,
  play: async ({ canvas }) => {
    const readCommits = async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Read row commits" }));
      return {
        direct: Number(canvas.getByTestId("direct-commits").textContent),
        mix: Number(canvas.getByTestId("mix-commits").textContent),
      };
    };
    const baseline = await readCommits();
    await expect(baseline.direct).toBeGreaterThan(0);
    await expect(baseline.mix).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole("button", { name: "Update unrelated miniature" }));
    await expect(await readCommits()).toEqual(baseline);

    await userEvent.click(canvas.getByRole("button", { name: "Update direct quantity" }));
    await waitFor(() =>
      expect(canvas.getByRole("textbox", { name: `${paints.black.name} quantity` })).toHaveValue("7"),
    );
    const afterQuantity = await readCommits();
    await expect(afterQuantity.direct).toBeGreaterThan(baseline.direct);
    await expect(afterQuantity.mix).toBe(baseline.mix);

    const unavailableLabel = `${paints.royalBlue.name} is unavailable through Teal Mix`;
    await expect(canvas.queryByRole("button", { name: unavailableLabel })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Empty mix ingredient" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: unavailableLabel })).toBeDisabled());
    const afterIngredient = await readCommits();
    await expect(afterIngredient.mix).toBeGreaterThan(afterQuantity.mix);
    await expect(afterIngredient.direct).toBe(afterQuantity.direct);
  },
};
