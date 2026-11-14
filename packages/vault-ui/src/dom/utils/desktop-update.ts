import { i18n, formatNumber } from "@paintwarden/i18n/runtime";
import { useCallback, useEffect, useRef, useState } from "react";

import type { DesktopUpdateState } from "../types";

// Follows the desktop app's self-update. Returns null in a normal browser, which has no updater.
export function useDesktopUpdate() {
  const bridge = typeof window === "undefined" ? undefined : window.paintwardenDesktop;
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const revision = useRef(0);
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    const requestedRevision = revision.current;
    void bridge.getUpdateState().then(
      (current) => {
        if (active && revision.current === requestedRevision) setState(current);
      },
      () => undefined,
    );
    const stop = bridge.onUpdateState((current) => {
      if (!active) return;
      revision.current += 1;
      setState(current);
    });
    return () => {
      active = false;
      revision.current += 1;
      stop();
    };
  }, [bridge]);
  const check = useCallback(async () => {
    if (!bridge) return;
    const requestedRevision = ++revision.current;
    const current = await bridge.checkForUpdates();
    if (revision.current === requestedRevision) setState(current);
  }, [bridge]);
  const install = useCallback(async () => {
    if (bridge) await bridge.installUpdate();
  }, [bridge]);
  const respond = useCallback(
    async (input: { version: string; consentId: string; action: "download" | "defer" }) => {
      if (!bridge) return;
      const requestedRevision = ++revision.current;
      const current = await bridge.respondToUpdate(input);
      if (revision.current === requestedRevision) setState(current);
    },
    [bridge],
  );
  return { state, check, install, respond };
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
    case "consent-required":
      return i18n.t("shell:updateNeedsConsent", { value1: current });
    case "deferred":
      return i18n.t("shell:updateDeferred", { value1: current });
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
