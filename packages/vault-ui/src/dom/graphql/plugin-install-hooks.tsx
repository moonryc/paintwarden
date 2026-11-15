import type { ApolloClient } from "@apollo/client";
import { Alert, Box } from "@mui/material";
import { i18n, translateServerError } from "@paintwarden/i18n/runtime";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { PluginInstallProgress } from "../Components/PluginInstallProgress";
import { useVaultStore } from "../store/hooks";

import {
  isPluginInstallActive,
  observePluginInstall,
  type PluginInstallJob,
} from "./plugin-install-observer";

const localizedJobError = (job: PluginInstallJob) =>
  translateServerError({
    errorCode: job.errorCode ?? undefined,
    errorParameters: Object.fromEntries(job.errorParameters.map(({ name, value }) => [name, value])),
  });

type InstallState = {
  job: PluginInstallJob | null;
  cancelling: boolean;
  disconnected: boolean;
  acceptJob: (job: PluginInstallJob) => void;
  cancel: () => void;
};
const PluginInstallContext = createContext<InstallState>({
  job: null,
  cancelling: false,
  disconnected: false,
  acceptJob() {},
  cancel() {},
});
export const usePluginInstall = () => useContext(PluginInstallContext);

export function PluginInstallProvider({ client, children }: { client: ApolloClient; children: ReactNode }) {
  const authHeaders = useVaultStore((s) => s.authHeaders);
  const notify = useVaultStore((s) => s.notify);
  const [job, setJob] = useState<PluginInstallJob | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef<PluginInstallJob | null>(null);
  const watched = useRef(new Set<string>());
  const announced = useRef(new Set<string>());
  const observer = useRef<ReturnType<typeof observePluginInstall> | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const receive = useCallback(
    (next: PluginInstallJob | null) => {
      if (!alive.current) return;
      // An initial REST acceptance/cancel acknowledgement can arrive after the
      // stream already delivered the terminal state. Never resurrect that job.
      if (
        next &&
        latest.current?.id === next.id &&
        !isPluginInstallActive(latest.current) &&
        isPluginInstallActive(next)
      )
        return;
      setDisconnected(false);
      if (latest.current?.id !== next?.id) setCancelling(false);
      if (isPluginInstallActive(next) && next) watched.current.add(next.id);
      latest.current = next;
      setJob(next);
      if (!next || isPluginInstallActive(next)) return;
      setCancelling(false);
      // Reload recovers terminal status without replaying yesterday's toast.
      if (!watched.current.has(next.id) || announced.current.has(next.id)) return;
      announced.current.add(next.id);
      if (next.stage === "SUCCEEDED") {
        notify(i18n.t("pages:sourcesJobSucceeded"));
        // Catalog rows are published through the single committed VaultChanges
        // invalidation. A global refresh here would cancel that live stream.
      } else if (next.stage === "FAILED") {
        notify(`${i18n.t("pages:sourcesJobFailed")}: ${localizedJobError(next)}`, "error");
      } else {
        notify(i18n.t("pages:sourcesJobCancelled"));
      }
    },
    [notify],
  );

  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined;
    const recover = () => {
      setDisconnected(true);
      retry ??= setTimeout(() => setAttempt((value) => value + 1), 5_000);
    };
    observer.current = observePluginInstall(client, receive, recover);
    const reconnect = () => setAttempt((value) => value + 1);
    window.addEventListener("online", reconnect);
    window.addEventListener("focus", reconnect);
    return () => {
      if (retry) clearTimeout(retry);
      observer.current?.dispose();
      observer.current = null;
      window.removeEventListener("online", reconnect);
      window.removeEventListener("focus", reconnect);
    };
  }, [client, receive, attempt]);

  const acceptJob = useCallback(
    (next: PluginInstallJob) => {
      watched.current.add(next.id);
      if (observer.current) observer.current.accept(next);
      else receive(next);
    },
    [receive],
  );
  const cancel = useCallback(() => {
    const current = latest.current;
    if (!current?.cancellable || !isPluginInstallActive(current) || cancelling) return;
    setCancelling(true);
    void (async () => {
      let awaitingCleanup = false;
      try {
        const response = await fetch(`/api/catalog-sources?job=${encodeURIComponent(current.id)}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        const result = (await response.json()) as { job?: PluginInstallJob; errorCode?: string };
        if (!response.ok) {
          if (alive.current) notify(translateServerError(result), "error");
          return;
        }
        // Cancellation can race the final commit. The returned job is authoritative,
        // not an optimistic CANCELLED state: committing may already have won.
        if (alive.current && latest.current?.id === current.id && result.job) {
          awaitingCleanup =
            isPluginInstallActive(result.job) && !result.job.cancellable && result.job.stage !== "COMMITTING";
          acceptJob(result.job);
        }
      } catch {
        if (alive.current) notify(i18n.t("pages:sourcesJobCancelFailed"), "error");
      } finally {
        if (alive.current && !awaitingCleanup) setCancelling(false);
      }
    })();
  }, [acceptJob, authHeaders, cancelling, notify]);

  return (
    <PluginInstallContext.Provider value={{ job, cancelling, disconnected, acceptJob, cancel }}>
      {children}
    </PluginInstallContext.Provider>
  );
}

export function PluginInstallStatus({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("pages");
  const { job, cancelling, disconnected, cancel } = usePluginInstall();
  // Completed jobs stay visible in Plugins; the global indicator only occupies
  // space while work is running, with terminal results delivered as app toasts.
  if (!job || (compact && !isPluginInstallActive(job))) return null;
  return (
    <Box sx={{ minWidth: 0 }}>
      <PluginInstallProgress
        job={{ ...job, error: job.stage === "FAILED" ? localizedJobError(job) : null }}
        compact={compact}
        cancelling={cancelling}
        onCancel={cancel}
      />
      {disconnected && isPluginInstallActive(job) && (
        <Alert severity="warning" role="status">
          {t("sourcesJobReconnecting")}
        </Alert>
      )}
    </Box>
  );
}
