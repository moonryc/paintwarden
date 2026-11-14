import { i18n, formatNumber } from "@paint-vault/i18n/runtime";
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
  const current = i18n.t("shell:version", { value1: state.currentVersion });
  switch (state.status) {
    case "disabled":
      return i18n.t("shell:automaticUpdatesAreOffInThisBuild", { value1: current });
    case "checking":
      return i18n.t("shell:checkingForUpdates", { value1: current });
    case "up-to-date":
      return i18n.t("shell:upToDate", { value1: current });
    case "downloading":
      return i18n.t("shell:downloading", {
        value1: current,
        value2: state.version ?? i18n.t("shell:anUpdate"),
        value3:
          state.progress === null
            ? ""
            : ` (${formatNumber(state.progress / 100, { style: "percent", maximumFractionDigits: 0 })})`,
      });
    case "ready":
      return i18n.t("shell:versionIsReadyToInstall", {
        value1: current,
        value2: state.version ?? i18n.t("shell:anUpdate"),
      });
    case "error":
      return i18n.t("shell:couldnTCheckForUpdates", { value1: current });
    default:
      return current;
  }
}
