import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { paints, schemes } from "../../storybook/fixtures";
import { mockApi } from "../../storybook/mock-api";
import type { MiniatureTemplate } from "../../types";

import { TemplateEditorDialog } from "./TemplateEditorDialog";

const template: MiniatureTemplate = {
  id: "user:fixture-template",
  name: "Reusable knight",
  manufacturer: "Fixture",
  faction: "Order",
  imageUrl: "",
  categories: ["My templates"],
  schemeCount: 1,
  paintCount: 1,
  kind: "user",
};
const recipePath = `/api/miniature-templates/${encodeURIComponent(template.id)}/recipe`;
const meta = {
  title: "Templates/Editor",
  component: TemplateEditorDialog,
  args: { template, onSaved: fn(async () => undefined), onClose: fn() },
  decorators: [
    mockApi({
      [recipePath]: () =>
        Response.json({
          schemeIds: [schemes.crimsonArmour.id],
          paints: [
            { paintId: paints.crimson.id, step: "BASECOAT", notes: "Preserved recipe notes", sortOrder: 0 },
          ],
        }),
    }),
  ],
} satisfies Meta<typeof TemplateEditorDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LoadsSelectedRecipe: Story = {
  play: async () => {
    await expect(
      await within(document.body).findByDisplayValue("Preserved recipe notes"),
    ).toBeInTheDocument();
    const dialog = within(await within(document.body).findByRole("dialog", { name: "Edit template" }));
    await expect(dialog.getByText(schemes.crimsonArmour.name)).toBeInTheDocument();
    await expect(dialog.getByRole("combobox", { name: "Step" })).toHaveTextContent("Basecoat");
    await userEvent.clear(dialog.getByLabelText("Name", { exact: false }));
    await userEvent.type(dialog.getByLabelText("Name", { exact: false }), "Edited knight");
    await expect(dialog.getByDisplayValue("Preserved recipe notes")).toBeInTheDocument();
  },
};
