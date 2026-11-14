import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState, type ComponentType } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { FirstScreenPreload, useFirstScreenReady } from "../utils/FirstScreenPreload";
import { createPreloadable } from "../utils/preloadable";

import { AppErrorBoundary } from "./AppErrorBoundary";
import { DeferredDialog } from "./DeferredDialog";
import { Modal } from "./Modal";

const title = "New color scheme";
type DialogProps = { onClose: () => void };
type ImportControls = { resolve: () => void; reject: () => void };

function LoadedDialog({ onClose }: DialogProps) {
  return (
    <Modal title={title} subtitle="Ready to edit" onClose={onClose}>
      Scheme editor loaded
    </Modal>
  );
}

// Each mount owns its lazy component and import promise. The play functions decide
// exactly when the import settles, without timers or a module-level lazy cache.
function ControlledDialog({
  onReady,
  onClose,
  initiallyOpen = true,
}: {
  initiallyOpen?: boolean;
  onReady: (controls: ImportControls) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [settled, setSettled] = useState(false);
  const [importState] = useState(() => {
    let resolve!: (module: { default: ComponentType<DialogProps> }) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<{ default: ComponentType<DialogProps> }>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { Dialog: createPreloadable(() => promise).Component, resolve, reject };
  });
  useEffect(() => {
    onReady({
      resolve: () => {
        importState.resolve({ default: LoadedDialog });
        setSettled(true);
      },
      reject: () => importState.reject(new Error("Dialog import failed")),
    });
  }, [importState, onReady]);
  const close = () => {
    onClose();
    setOpen(false);
  };
  const Dialog = importState.Dialog;
  return (
    <AppErrorBoundary>
      {!open && <button onClick={() => setOpen(true)}>Open</button>}
      <p>{settled ? "Import resolved" : "Import pending"}</p>
      {open && (
        <DeferredDialog kind="schemes" title={title} onClose={close}>
          <Dialog onClose={close} />
        </DeferredDialog>
      )}
    </AppErrorBoundary>
  );
}

const meta = {
  title: "Components/DeferredDialog",
  component: ControlledDialog,
  args: { onReady: fn<(controls: ImportControls) => void>(), onClose: fn() },
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
} satisfies Meta<typeof ControlledDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: title });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(within(dialog).getByRole("status")).toHaveTextContent(`Opening ${title}…`);
    await expect(within(dialog).getByRole("status")).toHaveAttribute("aria-busy", "true");
    await expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();
    await expect(body.queryByText("Scheme editor loaded")).not.toBeInTheDocument();
  },
};

export const Resolves: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const pending = await body.findByRole("dialog", { name: title });
    await expect(within(pending).getByRole("status")).toBeInTheDocument();
    await waitFor(() => expect(args.onReady).toHaveBeenCalled());
    args.onReady.mock.lastCall![0].resolve();
    await expect(await body.findByText("Scheme editor loaded")).toBeInTheDocument();
    await waitFor(() => expect(body.queryByRole("status")).not.toBeInTheDocument());
    await expect(body.getAllByRole("dialog", { name: title })).toHaveLength(1);
    await expect(body.getByText("Ready to edit")).toBeInTheDocument();
    await expect(body.queryByText("Loading…")).not.toBeInTheDocument();
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};

export const EscapeWhilePending: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await body.findByRole("dialog", { name: title });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(args.onReady).toHaveBeenCalled());
    args.onReady.mock.lastCall![0].resolve();
    await expect(await within(canvasElement).findByText("Import resolved")).toBeInTheDocument();
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(body.queryByText("Scheme editor loaded")).not.toBeInTheDocument();
  },
};

export const CloseWhilePending: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: title });
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(args.onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(args.onReady).toHaveBeenCalled());
    args.onReady.mock.lastCall![0].resolve();
    await expect(await within(canvasElement).findByText("Import resolved")).toBeInTheDocument();
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(body.queryByText("Scheme editor loaded")).not.toBeInTheDocument();
  },
};

export const RejectedImport: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await body.findByRole("dialog", { name: title });
    await waitFor(() => expect(args.onReady).toHaveBeenCalled());
    args.onReady.mock.lastCall![0].reject();
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    await expect(canvas.getByText("Dialog import failed")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(body.queryByRole("status")).not.toBeInTheDocument();
  },
};

export const FastImportDoesNotFlash: Story = {
  args: { initiallyOpen: false },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(args.onReady).toHaveBeenCalled());
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open" }));
    await expect(body.queryByRole("status")).not.toBeInTheDocument();
    args.onReady.mock.lastCall![0].resolve();
    await expect(await body.findByText("Scheme editor loaded")).toBeInTheDocument();
    await expect(body.queryByRole("status")).not.toBeInTheDocument();
  },
};

function PreloadedExample({ onImport }: { onImport(): void }) {
  const [open, setOpen] = useState(false);
  const [dialog] = useState(() =>
    createPreloadable(async () => {
      onImport();
      return { default: LoadedDialog };
    }),
  );
  const preload = () => {
    void dialog.preload();
  };
  const Dialog = dialog.Component;
  return (
    <>
      <button
        onPointerEnter={preload}
        onFocus={preload}
        onPointerDown={preload}
        onClick={() => setOpen(true)}
      >
        Open preloaded
      </button>
      {open && (
        <DeferredDialog kind="schemes" title={title} onClose={() => setOpen(false)}>
          <Dialog onClose={() => setOpen(false)} />
        </DeferredDialog>
      )}
    </>
  );
}

export const PreloadedHasNoFallback: Story = {
  render: () => <PreloadedExample onImport={preloadedImport} />,
  beforeEach: () => {
    preloadedImport.mockClear();
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const button = within(canvasElement).getByRole("button", { name: "Open preloaded" });
    const statuses: Element[] = [];
    const observer = new MutationObserver(() =>
      statuses.push(...canvasElement.ownerDocument.querySelectorAll('[role="status"]')),
    );
    observer.observe(canvasElement.ownerDocument.body, { subtree: true, childList: true });
    try {
      await userEvent.hover(button);
      await userEvent.tab();
      await waitFor(() => expect(preloadedImport).toHaveBeenCalledTimes(1));
      await userEvent.click(button);
      await expect(await body.findByText("Scheme editor loaded")).toBeInTheDocument();
      await expect(preloadedImport).toHaveBeenCalledTimes(1);
      await expect(statuses).toHaveLength(0);
    } finally {
      observer.disconnect();
    }
  },
};
const preloadedImport = fn();

function ScreenContent({ ready }: { ready: boolean }) {
  useFirstScreenReady(ready);
  return <p>{ready ? "First screen rendered" : "Page data pending"}</p>;
}
function IdleExample({ preload }: { preload(): void }) {
  const [ready, setReady] = useState(false);
  return (
    <FirstScreenPreload preload={preload}>
      <button onClick={() => setReady(true)}>Render first screen</button>
      <ScreenContent ready={ready} />
    </FirstScreenPreload>
  );
}
const idleImport = fn();
export const OnlyPreloadAfterFirstScreen: Story = {
  render: () => <IdleExample preload={idleImport} />,
  beforeEach: () => {
    idleImport.mockClear();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Page data pending")).toBeInTheDocument();
    await expect(idleImport).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Render first screen" }));
    await expect(canvas.getByText("First screen rendered")).toBeInTheDocument();
    await waitFor(() => expect(idleImport).toHaveBeenCalledTimes(1), { timeout: 4000 });
    await userEvent.click(canvas.getByRole("button", { name: "Render first screen" }));
    await expect(idleImport).toHaveBeenCalledTimes(1);
  },
};
export const EscapeDuringDelay: Story = {
  args: { initiallyOpen: false },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open" }));
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect(args.onClose).toHaveBeenCalledTimes(1);
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};
