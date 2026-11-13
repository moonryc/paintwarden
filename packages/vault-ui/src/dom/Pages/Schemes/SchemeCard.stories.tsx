import type { Meta, StoryObj } from "@storybook/react-vite";
import { Profiler, useRef, useState, type ComponentProps, type RefObject } from "react";
import { expect, fn, userEvent, waitFor } from "storybook/test";

import { column } from "../../storybook/decorators";
import { vault } from "../../storybook/fixtures";
import { schemeCardSummary } from "../../utils/semantic-contract";

import { SchemeCard } from "./SchemeCard";

const meta = {
  title: "Schemes/SchemeCard",
  component: SchemeCard,
  args: {
    scheme: vault.colorSchemes[0],
    summary: schemeCardSummary(vault, vault.colorSchemes[0].id),
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
export const Empty: Story = {
  args: {
    scheme: vault.colorSchemes[2],
    summary: schemeCardSummary(vault, vault.colorSchemes[2].id),
    available: 0,
    total: 0,
  },
};
export const CatalogSource: Story = {
  args: { scheme: { ...vault.colorSchemes[0], isSystem: true, sourceName: "Example source" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Example source")).toBeVisible();
  },
};
export const LongName: Story = {
  args: {
    scheme: { ...vault.colorSchemes[0], name: "An unusually long name for a custom miniature color scheme" },
  },
};
export const PreviewImage: Story = {
  args: {
    summary: {
      ...schemeCardSummary(vault, vault.colorSchemes[0].id),
      previewUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cpath fill='%236b263d' d='M0 0h200v200H0z'/%3E%3C/svg%3E",
    },
  },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("img", { name: `${args.scheme.name} finished example` })).toBeVisible();
  },
};

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

// Reading commits and unrelated fixture edits live in a sibling, not the card's parent.
function ProjectionControls({
  commits,
  updateSummary,
}: {
  commits: RefObject<number>;
  updateSummary: (change: Partial<ComponentProps<typeof SchemeCard>["summary"]>) => void;
}) {
  const [sample, setSample] = useState(0);
  const [notes, setNotes] = useState("");
  return (
    <div>
      <button onClick={() => setSample(commits.current)}>Read card commits</button>
      <span data-testid="card-commits">{sample}</span>
      <button onClick={() => setNotes("Unrelated edit")} title={notes}>
        Update unrelated notes
      </button>
      <button onClick={() => updateSummary({ paintNames: "Updated fixture paint" })}>
        Rename scheme paint
      </button>
      <button onClick={() => updateSummary({ uses: 2 })}>Link second miniature</button>
    </div>
  );
}

function ProfiledCard(props: ComponentProps<typeof SchemeCard>) {
  const commits = useRef(0);
  const [summary, setSummary] = useState(props.summary);
  return (
    <>
      <ProjectionControls
        commits={commits}
        updateSummary={(change) => setSummary((current) => ({ ...current, ...change }))}
      />
      <Profiler
        id="scheme"
        onRender={() => {
          commits.current += 1;
        }}
      >
        <SchemeCard {...props} summary={summary} />
      </Profiler>
    </>
  );
}

export const ProjectionUpdates: Story = {
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

export const ExplicitlyBoundedPreview: Story = {
  args: {
    summary: {
      ...schemeCardSummary(vault, vault.colorSchemes[0].id),
      paintNames: "Long authored preview…",
      previewMoreCount: 968,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("+968 more")).toBeVisible();
    await expect(canvas.getByRole("button")).toHaveAccessibleName(
      expect.stringContaining("+968 more paint entries in the full scheme"),
    );
  },
};
