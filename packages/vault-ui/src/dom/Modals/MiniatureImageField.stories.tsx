import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, fn, waitFor, within } from "storybook/test";

import { MiniatureImageField } from "./MiniatureImageField";

const meta = {
  title: "Miniatures/Image field",
  component: MiniatureImageField,
  args: {
    image: null,
    removeImage: false,
    templateImageUrl: "",
    onImageChange: fn(),
    onRemoveImageChange: fn(),
  },
} satisfies Meta<typeof MiniatureImageField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ImportErrorsAreLocalized: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const original = window.fetch.bind(window);
    const drop = async () => {
      const dataTransfer = new DataTransfer();
      // Chromium protects synthetic drag data during dispatch; supply the same
      // string a real URI drop exposes to the component.
      Object.defineProperty(dataTransfer, "getData", { value: () => "https://example.test/photo.png" });
      await fireEvent.drop(canvas.getByRole("button", { name: /Drag and drop a project photo/ }), {
        dataTransfer,
      });
    };
    try {
      window.fetch = async () => {
        throw new TypeError("Failed to fetch private-host");
      };
      await drop();
      await waitFor(() => expect(canvas.getByRole("alert")).toHaveTextContent("Could not import that image"));
      await expect(canvas.queryByText("Failed to fetch private-host")).not.toBeInTheDocument();
      window.fetch = async () =>
        Response.json(
          { error: "private legacy diagnostic", errorCode: "IMAGE_REQUEST_FAILED" },
          { status: 400 },
        );
      await drop();
      await waitFor(() => expect(canvas.getByRole("alert")).toHaveTextContent("Image request failed"));
      await expect(canvas.queryByText("private legacy diagnostic")).not.toBeInTheDocument();
    } finally {
      window.fetch = original;
    }
  },
};
