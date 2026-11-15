import type { ApolloClient } from "@apollo/client";

import {
  LatestPluginInstallJobDocument,
  PluginInstallProgressDocument,
  type LatestPluginInstallJobQuery,
} from "./generated/graphql";

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
  let delivered = false;
  const subscription = client
    .subscribe({ query: PluginInstallProgressDocument, fetchPolicy: "no-cache" })
    .subscribe({
      next(result) {
        if (disposed || !result.data || !("pluginInstallProgress" in result.data)) return;
        delivered = true;
        onJob(result.data.pluginInstallProgress ?? null);
      },
      error() {
        if (!disposed) onDisconnected();
      },
      complete() {
        if (!disposed) onDisconnected();
      },
    });
  // The stream immediately replays the current job; the query also recovers the
  // latest terminal result if there is no active stream yet. Never let a slower
  // query overwrite a newer subscription event or REST acceptance.
  void client
    .query({ query: LatestPluginInstallJobDocument, fetchPolicy: "no-cache" })
    .then(({ data }) => {
      if (!disposed && !delivered && data) onJob(data.pluginInstallJob ?? null);
    })
    .catch(() => {
      if (!disposed && !delivered) onDisconnected();
    });
  return {
    accept(job: PluginInstallJob) {
      if (disposed) return;
      delivered = true;
      onJob(job);
    },
    dispose() {
      disposed = true;
      subscription.unsubscribe();
    },
  };
}
