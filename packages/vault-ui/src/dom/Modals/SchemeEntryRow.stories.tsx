import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { sortableList } from "../storybook/decorators";
import { paints } from "../storybook/fixtures";
import type { SchemeOrderEntry } from "../types";

import { SchemeEntryRow } from "./SchemeEntryRow";

const entries = {
  paint: { type: "PAINT", id: "entry-paint", paintId: paints.crimson.id, sortOrder: 1 },
  step: { type: "DIVIDER", id: "entry-step", label: "BASECOAT", tone: "SECTION", sortOrder: 0 },
  milestone: { type: "DIVIDER", id: "entry-milestone", label: "GET READY!", tone: "MILESTONE", sortOrder: 2 },
  required: {
    type: "DIVIDER",
    id: "entry-required",
    label: "YOU'RE READY!",
    tone: "MILESTONE",
    role: "COMPLETE",
    sortOrder: 3,
  },
  image: {
    type: "IMAGE",
    id: "entry-image",
    // An inline image, so the story needs no network.
    imageUrl:
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 5'><rect width='4' height='5' fill='%23934'/></svg>",
    thumbnailUrl: null,
    imageType: "BATTLE",
    method: "CLASSIC",
    sortOrder: 4,
  },
} satisfies Record<string, SchemeOrderEntry>;

const meta = {
  title: "Dialogs/SchemeEntryRow",
  component: SchemeEntryRow,
  args: {
    entry: entries.paint,
    paint: paints.crimson,
    stepHasPaints: false,
    onChangeLabel: fn(),
    onAddPaint: fn(),
    onRemove: fn(),
  },
  argTypes: { entry: { control: false }, paint: { control: false } },
  decorators: [sortableList(Object.values(entries).map((entry) => entry.id))],
} satisfies Meta<typeof SchemeEntryRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Paint: Story = {};

export const UnavailablePaint: Story = { args: { paint: null } };

export const Step: Story = { args: { entry: entries.step, paint: null } };

// A step holding paints can't be removed until they move.
export const StepWithPaints: Story = { args: { entry: entries.step, paint: null, stepHasPaints: true } };

export const Milestone: Story = { args: { entry: entries.milestone, paint: null } };

export const RequiredMilestone: Story = { args: { entry: entries.required, paint: null } };

export const Image: Story = { args: { entry: entries.image, paint: null } };
