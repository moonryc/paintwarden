import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { VaultGraphQLProvider } from "../graphql/provider";
import { paints } from "../storybook/fixtures";
import { mockApi } from "../storybook/mock-api";

import { AddSchemeItemDialog } from "./AddSchemeItemDialog";

const meta = {
  title: "Dialogs/AddSchemeItemDialog",
  decorators: [
    mockApi(),
    (Story) => (
      <VaultGraphQLProvider>
        <Story />
      </VaultGraphQLProvider>
    ),
  ],
  component: AddSchemeItemDialog,
  args: {
    kind: "STEP",
    excludedIds: [paints.crimson.id],
    onAddDivider: fn(),
    onAddImage: fn(),
    onAddPaint: fn(),
    onClose: fn(),
  },
  parameters: { docs: { story: { inline: false, iframeHeight: 420 } } },
} satisfies Meta<typeof AddSchemeItemDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Step: Story = {};

export const Milestone: Story = { args: { kind: "MILESTONE" } };

export const Image: Story = { args: { kind: "IMAGE" } };

export const Paint: Story = { args: { kind: "PAINT", stepLabel: "BASECOAT" } };
