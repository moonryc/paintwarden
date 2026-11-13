import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { vault } from "../storybook/fixtures";
import { StoryGraphQL } from "../storybook/graphql";
import { fixtureTemplateResponse, sampleTemplates } from "../storybook/template-api-fixtures";

import { MiniatureForm } from "./MiniatureForm";

const templates = Array.from({ length: 180 }, (_, index) => ({
  ...sampleTemplates[0],
  id: `template-${index}`,
  name: index === 179 ? "Distant dragon" : `Knight ${index}`,
}));
const meta = {
  title: "Miniatures/Form templates",
  component: MiniatureForm,
  args: { onClose: fn(), onSubmit: fn(async () => {}) },
  decorators: [
    (Story) => (
      <StoryGraphQL
        respond={(operation) => {
          if (operation.operationName !== "TemplateSummaries")
            throw new Error("Miniature template picker must not read recipes");
          return (
            fixtureTemplateResponse(
              vault,
              operation.operationName,
              operation.variables,
              { epoch: "story", seq: "1" },
              templates,
            ) ?? {}
          );
        }}
      >
        <Story />
      </StoryGraphQL>
    ),
  ],
} satisfies Meta<typeof MiniatureForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const DistantInitialTemplate: Story = {
  args: { initialTemplateId: "template-179" },
  play: async ({ args }) => {
    const body = within(document.body);
    await body.findAllByDisplayValue("Distant dragon");
    await waitFor(() => expect(body.getByRole("textbox", { name: /Name/ })).toHaveValue("Distant dragon"));
    await userEvent.click(body.getByRole("button", { name: /^Save$/ }));
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Distant dragon", templateId: "template-179" }),
    );
  },
};
export const SearchesUnloadedTemplates: Story = {
  play: async ({ args }) => {
    const body = within(document.body);
    await userEvent.type(body.getByRole("combobox", { name: "Model" }), "Distant dragon");
    await userEvent.click(await body.findByRole("option", { name: "Distant dragon" }));
    await userEvent.click(body.getByRole("button", { name: /^Save$/ }));
    await expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ templateId: "template-179" }));
  },
};
