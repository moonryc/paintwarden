import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { column } from "../storybook/decorators";
import { miniatures, paints, requirements, vault } from "../storybook/fixtures";

import type { RecipeStepRow } from "./RecipeStepCard";
import { RecipeStepCard } from "./RecipeStepCard";

const rows: RecipeStepRow[] = [requirements.black, requirements.crimson].map(
  ({ miniatureId: _, ...manual }) => ({
    paintId: manual.paintId,
    step: manual.step,
    manual,
    schemeSources: [],
    paint: vault.catalog.find((paint) => paint.id === manual.paintId)!,
  }),
);
const ids = rows.map((row) => `${row.step}:${row.paintId}`);

const meta = {
  title: "Components/RecipeStepCard",
  component: RecipeStepCard,
  args: {
    step: "BASECOAT",
    label: "Basecoat",
    number: 1,
    rows,
    miniatureId: miniatures.knight.id,
    editMode: false,
    adding: false,
    onToggleAdd: fn(),
    onRemoveStep: fn(),
    onRemovePaint: fn(),
    onOpenPaint: fn(),
  },
  argTypes: { rows: { control: false }, addPanel: { control: false } },
  // The rows are sortable, so they need the drag contexts ProjectRecipe provides.
  decorators: [
    (Story) => (
      <DndContext>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <Story />
        </SortableContext>
      </DndContext>
    ),
    column(720),
  ],
} satisfies Meta<typeof RecipeStepCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EditMode: Story = { args: { editMode: true } };

export const SchemePaint: Story = {
  args: {
    rows: [
      {
        paintId: paints.gold.id,
        step: "BASECOAT",
        manual: null,
        schemeSources: [{ id: "user:scheme-crimson", name: "Crimson armour" }],
        paint: paints.gold,
      },
    ],
  },
};

export const Empty: Story = { args: { rows: [] } };

export const EmptyInEditMode: Story = { args: { rows: [], editMode: true } };
