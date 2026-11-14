// Story wrappers for components that need app context: drag-and-drop lists, a narrow column,
// and the Electron preload bridge.
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import Box from "@mui/material/Box";
import type { Decorator } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import type { DesktopBridge, DesktopUpdateState } from "../types";

const listSx = {
  listStyle: "none",
  m: 0,
  p: 0,
  maxWidth: 720,
  border: "1px solid var(--line)",
  borderRadius: "20px",
  bgcolor: "var(--surface)",
};

// Rows render as list items, so they sit in a card-styled list as they do on the pages.
export function list(): Decorator {
  return function List(Story) {
    return (
      <Box component="ul" sx={listSx}>
        <Story />
      </Box>
    );
  };
}

// Sortable rows also need a DndContext and SortableContext; the list items supply their own ids.
export function sortableList(ids: string[]): Decorator {
  return function SortableList(Story) {
    return (
      <DndContext>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <Box component="ul" sx={listSx}>
            <Story />
          </Box>
        </SortableContext>
      </DndContext>
    );
  };
}

// Keeps a component at a realistic width instead of stretching across the canvas.
export function column(maxWidth: number): Decorator {
  return function Column(Story) {
    return (
      <Box sx={{ maxWidth }}>
        <Story />
      </Box>
    );
  };
}

// A stand-in for the desktop app's preload bridge, including consent transitions.
function fakeBridge(state: DesktopUpdateState, overrides: Partial<DesktopBridge>): DesktopBridge {
  let current = state;
  const listeners = new Set<(state: DesktopUpdateState) => void>();
  const publish = (next: DesktopUpdateState) => {
    current = next;
    listeners.forEach((listener) => listener(current));
    return Promise.resolve(current);
  };
  return {
    getSupportSummary: (language) =>
      Promise.resolve({ version: "1.0.0", os: "macOS", mode: "local", language }),
    saveSupportBundle: () => Promise.resolve(true),
    openBugReport: () => Promise.resolve(true),
    getLanguage: () => Promise.resolve("en"),
    setLanguage: (language) => Promise.resolve(language),
    getConnection: () => Promise.resolve({ mode: "local" }),
    setConnection: (choice) => Promise.resolve(choice),
    saveBinary: () => Promise.resolve(true),
    saveBackup: () => Promise.resolve(true),
    restoreBackup: () => Promise.resolve({}),
    getUpdateState: () => Promise.resolve(current),
    checkForUpdates: () => publish(state),
    respondToUpdate: ({ action }) =>
      publish({ ...current, status: action === "defer" ? "deferred" : "downloading" }),
    installUpdate: () => Promise.resolve(true),
    onUpdateState: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    ...overrides,
  };
}

function WithBridge({
  state,
  overrides,
  children,
}: {
  state: DesktopUpdateState;
  overrides: Partial<DesktopBridge>;
  children: () => ReactNode;
}) {
  // Installed before the first render so the component sees the bridge as it would in Electron.
  const [installed] = useState(() => {
    window.paintwardenDesktop = fakeBridge(state, overrides);
    return true;
  });
  useEffect(
    () => () => {
      delete window.paintwardenDesktop;
    },
    [],
  );
  return installed ? children() : null;
}

export function desktopBridge(state: DesktopUpdateState, overrides: Partial<DesktopBridge> = {}): Decorator {
  return function DesktopBridge(Story) {
    return (
      <WithBridge state={state} overrides={overrides}>
        {() => <Story />}
      </WithBridge>
    );
  };
}
