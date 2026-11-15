import type { ApolloClient } from "@apollo/client";

import { PluginInstallProgressDocument, type LatestPluginInstallJobQuery } from "./generated/graphql";

export type PluginInstallJob = NonNullable<LatestPluginInstallJobQuery["pluginInstallJob"]>;
export const isPluginInstallActive = (job: PluginInstallJob | null) =>
  Boolean(job && !["SUCCEEDED", "FAILED", "CANCELLED"].includes(job.stage));

/** One scope-owned stream, independent of the Plugins dialog's lifetime. */
export function observePluginInstall(
  client: ApolloClient,
  onJob: (job: PluginInstallJob | null) => void,
  onDisconnected: () => void,
) {
  let disposed = false;
  let initialSnapshot = true;
  let acceptedId: string | null = null;
  // The server immediately replays its latest snapshot, including null and terminal
  // jobs, on every connection. A duplicate latest-job HTTP query adds no recovery
  // guarantee and would consume ordinary operation slots/rate budgets during edits.
  const subscription = client
    .subscribe({ query: PluginInstallProgressDocument, fetchPolicy: "no-cache" })
    .subscribe({
      next(result) {
        if (disposed || !result.data || !("pluginInstallProgress" in result.data)) return;
        const next = result.data.pluginInstallProgress ?? null;
        if (initialSnapshot) {
          initialSnapshot = false;
          // Initial replay can already be in transit when REST accepts a new job.
          // Ignore that one older snapshot, not later authoritative server replay.
          if (acceptedId && next?.id !== acceptedId) return;
        }
        onJob(next);
      },
      error() {
        if (!disposed) onDisconnected();
      },
      complete() {
        if (!disposed) onDisconnected();
      },
    });
  return {
    accept(job: PluginInstallJob) {
      if (!disposed) {
        acceptedId = job.id;
        onJob(job);
      }
    },
    dispose() {
      disposed = true;
      subscription.unsubscribe();
    },
  };
}
