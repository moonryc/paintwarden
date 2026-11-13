import { useCallback, useEffect, useState } from "react";

import type { DesktopUpdateState } from "../types";

// Follows the desktop app's self-update. Returns null in a normal browser, which has no updater.
export function useDesktopUpdate() {
  const bridge = typeof window === "undefined" ? undefined : window.paintVaultDesktop;
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    void bridge.getUpdateState().then(
      (current) => {
        if (active) setState(current);
      },
      () => undefined,
    );
    const stop = bridge.onUpdateState(setState);
    return () => {
      active = false;
      stop();
    };
  }, [bridge]);
  const check = useCallback(async () => {
    if (bridge) setState(await bridge.checkForUpdates());
  }, [bridge]);
  const install = useCallback(async () => {
    if (bridge) await bridge.installUpdate();
  }, [bridge]);
  return { state, check, install };
}

export function describeUpdate(state: DesktopUpdateState) {
  const current = `Version ${state.currentVersion}`;
  switch (state.status) {
    case "disabled":
      return `${current} · Automatic updates are off in this build`;
    case "checking":
      return `${current} · Checking for updates…`;
    case "up-to-date":
      return `${current} · Up to date`;
    case "downloading":
      return `${current} · Downloading ${state.version ?? "an update"}${
        state.progress === null ? "" : ` (${state.progress}%)`
      }`;
    case "ready":
      return `${current} · Version ${state.version ?? "update"} is ready to install`;
    case "error":
      return `${current} · Couldn't check for updates`;
    default:
      return current;
  }
}
