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
  // The server immediately replays its latest snapshot, including null and terminal
  // jobs, on every connection. A duplicate latest-job HTTP query adds no recovery
  // guarantee and would consume ordinary operation slots/rate budgets during edits.
  const subscription = client
    .subscribe({ query: PluginInstallProgressDocument, fetchPolicy: "no-cache" })
    .subscribe({
      next(result) {
        if (disposed || !result.data || !("pluginInstallProgress" in result.data)) return;
        onJob(result.data.pluginInstallProgress ?? null);
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
      if (!disposed) onJob(job);
    },
    dispose() {
      disposed = true;
      subscription.unsubscribe();
    },
  };
}
