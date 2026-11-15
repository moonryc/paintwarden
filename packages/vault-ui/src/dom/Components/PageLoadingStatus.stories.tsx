import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { PageLoadingStatus } from "./PageLoadingStatus";

const meta = {
  title: "Components/PageLoadingStatus",
  component: PageLoadingStatus,
  args: { loading: true, children: "Static shell" },
} satisfies Meta<typeof PageLoadingStatus>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("status")).toHaveLength(1);
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Loading…");
    await expect(canvasElement.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(
      window.innerWidth,
    );
  },
};
