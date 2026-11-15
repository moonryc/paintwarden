import { Button, Skeleton } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { useState } from "react";

import { useRetainedQuery } from "./use-retained-query";

function Probe() {
  const [scope, setScope] = useState(0);
  const [pending, setPending] = useState(true);
  const [data, setData] = useState<{ count: number } | null>(null);
  const result = useRetainedQuery(data, pending, scope);
  return (
    <>
      {result.loading ? <Skeleton data-testid="initial-skeleton" /> : <p>Count: {result.data?.count}</p>}
      <Button
        onClick={() => {
          setData({ count: 0 });
          setPending(false);
        }}
      >
        Accept empty view
      </Button>
      <Button
        onClick={() => {
          setData(null);
          setPending(true);
        }}
      >
        Change query
      </Button>
      <Button onClick={() => setPending(false)}>Fail refresh</Button>
      <Button
        onClick={() => {
          setData({ count: 1 });
          setPending(false);
        }}
      >
        Accept update
      </Button>
      <Button
        onClick={() => {
          setData(null);
          setScope((old) => old + 1);
          setPending(true);
        }}
      >
        Change vault
      </Button>
    </>
  );
}

const meta = { title: "GraphQL/Retained query", render: () => <Probe /> } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const InitialLoadOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("initial-skeleton")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Accept empty view" }));
    const content = await canvas.findByText("Count: 0");
    for (const action of ["Change query", "Fail refresh", "Change query"]) {
      await userEvent.click(canvas.getByRole("button", { name: action }));
      await expect(canvas.queryByTestId("initial-skeleton")).not.toBeInTheDocument();
      await expect(content).toBeInTheDocument();
    }
    await userEvent.click(canvas.getByRole("button", { name: "Accept update" }));
    await waitFor(() => expect(content).toHaveTextContent("Count: 1"));
    await userEvent.click(canvas.getByRole("button", { name: "Change vault" }));
    await expect(canvas.getByTestId("initial-skeleton")).toBeInTheDocument();
    await expect(content).not.toBeInTheDocument();
  },
};
