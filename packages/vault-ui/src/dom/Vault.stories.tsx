import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { miniatures, paints, vault } from "./storybook/fixtures";
import { mockApi } from "./storybook/mock-api";
import Vault from "./Vault";

// The whole app against a stand-in server with the sample vault, so pages and dialogs get the
// same accessibility checks as the components they use.
const meta = {
  title: "App/Vault",
  render: () => <Vault />,
  decorators: [mockApi()],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Canvas = ReturnType<typeof within>;

// On narrow screens the navigation sits in a drawer behind the menu button.
async function openPage(canvas: Canvas, name: string) {
  await canvas.findByRole("heading", { level: 1, name: /Workbench/ });
  const menu = canvas.queryByRole("button", { name: "Open navigation" });
  if (menu) await userEvent.click(menu);
  const nav = await within(document.body).findByRole("navigation", { name: "Primary" });
  // The settings button sits below the page list, in the same panel.
  const panel = within(nav.parentElement ?? nav);
  await userEvent.click(await panel.findByRole("button", { name: new RegExp(name) }));
}

export const Workbench: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: /Workbench/ })).toBeInTheDocument();
  },
};

const page = (name: string, heading: RegExp): Story => ({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openPage(canvas, name);
    await expect(await canvas.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  },
});

export const Miniatures = page("Miniatures", /Miniatures/);
export const Paints = page("Paints", /Paints/);
export const Wishlist = page("Wishlist", /Wishlist/);
export const Schemes = page("Schemes", /Schemes/);
export const Templates = page("Templates", /Templates/);
export const PaintTools = page("Paint Tools", /Paint Tools/);
export const Settings = page("Data & settings", /Data & settings/);

export const Plugins: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openPage(canvas, "Data & settings");
    await userEvent.click(await canvas.findByRole("button", { name: "Manage plugins" }));
    await expect(await within(document.body).findByRole("dialog", { name: "Plugins" })).toBeInTheDocument();
  },
};

export const PaintDetails: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openPage(canvas, "Paints");
    await userEvent.click(await canvas.findByRole("button", { name: new RegExp(`^${paints.crimson.name}`) }));
    await expect(await within(document.body).findByRole("dialog")).toBeInTheDocument();
  },
};

export const Project: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openPage(canvas, "Miniatures");
    await userEvent.click(await canvas.findByRole("button", { name: new RegExp(miniatures.knight.title) }));
    const dialog = await within(document.body).findByRole("dialog", { name: miniatures.knight.title });
    await expect(
      await within(dialog).findByRole("heading", { name: miniatures.knight.title }),
    ).toBeInTheDocument();
    await expect(within(dialog).queryByText("Loading project…")).not.toBeInTheDocument();
  },
};

export const AddMiniature: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openPage(canvas, "Miniatures");
    await userEvent.click(await canvas.findByRole("button", { name: /Add miniature/i }));
    await expect(await within(document.body).findByRole("dialog")).toBeInTheDocument();
  },
};

const serverError = () => Response.json({ error: "Server error" }, { status: 500 });

// Migrated Home starts without a snapshot; only entering a legacy screen requests it.
export const VaultLoadFailure: Story = {
  decorators: [mockApi({ "/api/state": serverError })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openPage(canvas, "Wishlist");
    await expect(
      await canvas.findByRole("heading", { name: /open your vault/ }, { timeout: 5000 }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("alert")).toHaveTextContent("Could not load your vault");
    await expect(canvas.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    await expect(canvas.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
  },
};

export const AccessCheckFailure: Story = {
  decorators: [mockApi({ "/api/auth/status": serverError })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("heading", { name: /open your vault/ }, { timeout: 5000 }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("alert")).toHaveTextContent("Could not check vault access");
  },
};

let serverDown = false;

// A failed refresh keeps the loaded vault on screen, says so, and Settings stops saying Connected.
export const RefreshFailure: Story = {
  decorators: [mockApi({ "/api/auth/status": () => (serverDown ? serverError() : undefined) })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    serverDown = false;
    await openPage(canvas, "Data & settings");
    await expect(await canvas.findByText("Connected")).toBeInTheDocument();
    serverDown = true;
    window.dispatchEvent(new Event("focus"));
    await expect(
      await canvas.findByText(/Could not refresh your vault/, undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    await expect(canvas.getByText("Not connected")).toBeInTheDocument();
    serverDown = false;
  },
};

let changedElsewhere = false;
const renamed = "Renamed on another device";

const changedVault = {
  ...vault,
  miniatures: vault.miniatures.map((mini) =>
    mini.id === miniatures.knight.id ? { ...mini, title: renamed } : mini,
  ),
};

// Focus catch-up invalidates and refetches Apollo projections without loading a snapshot.
export const ChangesFromAnotherClient: Story = {
  decorators: [
    mockApi(
      {},
      {
        data: () => (changedElsewhere ? changedVault : vault),
        revision: () => (changedElsewhere ? 1 : 0),
      },
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    changedElsewhere = false;
    await openPage(canvas, "Miniatures");
    await canvas.findByRole("button", { name: new RegExp(miniatures.knight.title) });
    changedElsewhere = true;
    window.dispatchEvent(new Event("focus"));
    await expect(await canvas.findByRole("button", { name: new RegExp(renamed) })).toBeInTheDocument();
    changedElsewhere = false;
  },
};
