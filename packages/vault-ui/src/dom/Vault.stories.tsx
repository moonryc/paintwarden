import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { miniatures, paints, vault } from "./storybook/fixtures";
import { mockApi } from "./storybook/mock-api";
import Vault from "./Vault";

// The whole app against a stand-in server with the sample vault, so pages and dialogs get the
// same accessibility checks as the components they use.
const meta = {
  title: "App/Vault",
  render: () => <Vault />,
  decorators: [mockApi()],
  parameters: { fullBleed: true },
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
    await expect(await canvas.findByRole("heading", { level: 1, name: /Workbench/ })).toBeInTheDocument();
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
export const PaintTools = page("Paint Tools", /Paint tools/i);
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
    await userEvent.click(
      await canvas.findByRole("button", { name: new RegExp(`^(?!Actions for).*${miniatures.knight.title}`) }),
    );
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
    await userEvent.click(await canvas.findByRole("button", { name: /Add miniature/ }));
    const dialog = within(await within(document.body).findByRole("dialog", { name: /miniature/i }));
    await expect(dialog.getByRole("group", { name: "What would you like to add?" })).toBeInTheDocument();
  },
};

const serverError = () => Response.json({ error: "Server error" }, { status: 500 });

const legacySnapshotRequest = fn(serverError);

// A failed legacy endpoint cannot affect any migrated screen. Auth failure
// remains a separate full-shell retry path below.
export const LegacySnapshotUnavailable: Story = {
  decorators: [mockApi({ "/api/state": legacySnapshotRequest })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openPage(canvas, "Wishlist");
    await expect(await canvas.findByRole("heading", { level: 1, name: /Wishlist/ })).toBeInTheDocument();
    await expect(legacySnapshotRequest).not.toHaveBeenCalled();
    await expect(canvas.queryByText(/open your vault/)).not.toBeInTheDocument();
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
    await canvas.findByRole("button", { name: new RegExp(`^(?!Actions for).*${miniatures.knight.title}`) });
    changedElsewhere = true;
    window.dispatchEvent(new Event("focus"));
    await expect(
      await canvas.findByRole("button", { name: new RegExp(`^(?!Actions for).*${renamed}`) }),
    ).toBeInTheDocument();
    changedElsewhere = false;
  },
};

// Access checks use REST, before any page query is allowed. Deep links must not
// flash the workbench while this check or a lazy page import is pending.
export const StartupWorkbench: Story = {
  decorators: [mockApi({ "/api/auth/status": () => new Promise<Response>(() => {}) })],
  beforeEach: () => {
    const hash = window.location.hash;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return () =>
      window.history.replaceState(null, "", window.location.pathname + window.location.search + hash);
  },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("status")).toHaveTextContent("Loading Workbench");
    await expect(canvasElement.querySelectorAll("[data-skeleton]")).toHaveLength(1);
    await expect(canvasElement.querySelector('[data-skeleton="home"]')).toHaveAttribute("aria-busy", "true");
  },
};

export const StartupPaintsDeepLink: Story = {
  decorators: [mockApi({ "/api/auth/status": () => new Promise<Response>(() => {}) })],
  beforeEach: () => {
    const hash = window.location.hash;
    window.history.replaceState(null, "", "#paints");
    return () =>
      window.history.replaceState(null, "", window.location.pathname + window.location.search + hash);
  },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("status")).toHaveTextContent("Loading Paints");
    await expect(canvasElement.querySelectorAll("[data-skeleton]")).toHaveLength(1);
    await expect(canvasElement.querySelector('[data-skeleton="paints"]')).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(canvasElement.querySelector('[data-skeleton="home"]')).toBeNull();
  },
};

export const OwnerSetupLandmark: Story = {
  decorators: [
    mockApi({
      "/api/auth/status": () =>
        Response.json({
          setupRequired: true,
          setupCodeRequired: false,
          username: null,
          requireSignIn: false,
          authenticated: false,
        }),
    }),
  ],
  play: async ({ canvasElement }) => {
    const main = await within(canvasElement).findByRole("main");
    await expect(
      await within(main).findByRole("heading", { level: 1, name: "Set up Paintwarden" }),
    ).toBeInTheDocument();
    await expect(within(main).getByRole("button", { name: "Create account" })).toBeInTheDocument();
  },
};

export const LoginLandmark: Story = {
  decorators: [
    mockApi({
      "/api/auth/status": () =>
        Response.json({
          setupRequired: false,
          setupCodeRequired: false,
          username: "Sample owner",
          requireSignIn: true,
          authenticated: false,
        }),
    }),
  ],
  play: async ({ canvasElement }) => {
    const main = await within(canvasElement).findByRole("main");
    await expect(
      await within(main).findByRole("heading", { level: 1, name: "Sign in to Paintwarden" }),
    ).toBeInTheDocument();
    await expect(within(main).getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  },
};

// Exercise real provider/outlet wiring via a failed reconciliation, not a
// warning injected by the decorator. Loaded screen queries still succeed.
const unavailableReconciliation = fn((name: string) =>
  name === "VaultInvalidation" ? serverError() : undefined,
);

export const LiveUpdatesDisconnected: Story = {
  decorators: [mockApi({}, { query: unavailableReconciliation })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const main = await canvas.findByRole("main");
    await canvas.findByRole("heading", { level: 2, name: /Workbench/ });
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(unavailableReconciliation).toHaveBeenCalledWith("VaultInvalidation"));
    const notice = (
      await within(main).findByText("The request could not be completed. Please try again.")
    ).closest("[data-app-banner]") as HTMLElement;
    await expect(within(notice).getByRole("button", { name: "Retry" })).toBeVisible();
    await userEvent.click(within(notice).getByRole("button", { name: "Close" }));
    await expect(notice).not.toBeInTheDocument();
    await waitFor(() => expect(canvas.getByRole("heading", { level: 2, name: /Workbench/ })).toBeVisible());
  },
};
