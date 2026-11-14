import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { SwatchScanCanvas, type ScanPin } from "./SwatchScanCanvas";

const photo = new URL("../../../../../apps/paintwarden-web/public/icon-512.png", import.meta.url).href;
function CanvasExample() {
  const [pins, setPins] = useState<ScanPin[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <SwatchScanCanvas
      src={photo}
      alt="Paintwarden sample image"
      pins={pins}
      selected={selected}
      onSelect={setSelected}
      onSample={(point, hex) => {
        const id = pins.length + 1;
        setPins([...pins, { ...point, hex, id }]);
        setSelected(id);
      }}
    />
  );
}
const meta = {
  title: "Color tools/Swatch Scan canvas",
  component: SwatchScanCanvas,
  args: {
    src: photo,
    alt: "Paintwarden sample image",
    pins: [],
    selected: null,
    onSelect: () => {},
    onSample: () => {},
  },
} satisfies Meta<typeof SwatchScanCanvas>;
export default meta;
type Story = StoryObj<typeof meta>;
export const KeyboardPins: Story = {
  render: () => <CanvasExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sample = await canvas.findByRole("button", { name: "Sample at crosshair" });
    await waitFor(() => expect(sample).toBeEnabled());
    await userEvent.click(sample);
    await expect(canvas.getByRole("button", { name: /Pin 1,/ })).toHaveAttribute("aria-pressed", "true");
    const bounds = canvas.getByRole("button", { name: /Pin 1,/ }).getBoundingClientRect();
    await expect(Math.abs(bounds.width - bounds.height)).toBeLessThan(1);
    await userEvent.click(canvas.getByRole("group", { name: "Photo sampling area" }));
    await userEvent.keyboard("{ArrowRight}{ArrowDown}{Enter}");
    await expect(canvas.getByRole("button", { name: /Pin 2,/ })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
    await expect(canvas.getByRole("button", { name: /Pin 1,/ })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /Pin 1,/ }));
    await expect(canvas.getByRole("button", { name: /Pin 1,/ })).toHaveAttribute("aria-pressed", "true");
  },
};
export const ExternalPhoto: Story = {
  args: { src: "https://example.invalid/photo.jpg" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/This photo is hosted outside the vault/)).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Sample at crosshair" })).toBeDisabled();
  },
};
