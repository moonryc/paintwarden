import { Button } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { vault } from "../storybook/fixtures";
import { StoryGraphQL } from "../storybook/graphql";
import { fixtureTemplateResponse, sampleTemplates } from "../storybook/template-api-fixtures";

import { useTemplateActions, useTemplateCatalog, useTemplateRecipe } from "./template-hooks";

function Probe() {
  const [id, setId] = useState<string | null>(null);
  const catalog = useTemplateCatalog();
  const recipe = useTemplateRecipe(id);
  const actions = useTemplateActions();
  return (
    <>
      <p role="status">{catalog.loading ? "Loading" : `${catalog.data?.totalCount ?? 0} templates`}</p>
      <Button onClick={() => setId("user:one")}>Open selected recipe</Button>
      <Button onClick={() => void actions.create({ name: "New template" })}>Create template</Button>
      {recipe.data && <p>Loaded selected recipe</p>}
    </>
  );
}
function Harness() {
  const [state] = useState(() => ({ sequence: 0 }));
  return (
    <StoryGraphQL
      respond={(operation) => {
        if (operation.operationName === "CreateReusableTemplate") state.sequence += 1;
        const rows = state.sequence
          ? [
              ...sampleTemplates,
              { ...sampleTemplates[0], id: "user:new", name: "New template", kind: "user" as const },
            ]
          : sampleTemplates;
        return (
          fixtureTemplateResponse(
            vault,
            operation.operationName,
            operation.variables,
            { epoch: "story", seq: String(state.sequence) },
            rows,
          ) ?? {}
        );
      }}
    >
      <Probe />
    </StoryGraphQL>
  );
}
const meta = { title: "Store/Template cache", render: () => <Harness /> } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Invalidation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("1 templates")).toBeInTheDocument();
    await expect(canvas.queryByText("Loaded selected recipe")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Open selected recipe" }));
    await expect(await canvas.findByText("Loaded selected recipe")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Create template" }));
    await expect(await canvas.findByText("2 templates")).toBeInTheDocument();
    await expect(await canvas.findByText("Loaded selected recipe")).toBeInTheDocument();
  },
};
