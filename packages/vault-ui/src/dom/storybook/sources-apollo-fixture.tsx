import { ApolloClient, ApolloLink, Observable } from "@apollo/client";
import { type ReactNode, useEffect, useState } from "react";

import { createVaultCache } from "../graphql/cache";
import { VaultInvalidationController } from "../graphql/invalidation";
import { VaultGraphQLContext } from "../graphql/provider";
import { PluginInstallProvider } from "../graphql/plugin-install-hooks";
import { type PluginInstallJob } from "../graphql/plugin-install-observer";

export type SourcesFixtureMode = "installed" | "empty" | "loading" | "error";
const source = {
  id: "fixture-plugin",
  repository: "example/paints",
  url: "https://github.com/example/paints",
  name: "Example paint source",
  version: "1.0.0",
  license: "CC-BY-4.0",
  attribution: "Example authors",
  dependencies: [],
  lastError: null,
  lastErrorInfo: null,
  logoUrl: null,
  counts: { paints: 12, schemes: 2, templates: 1 },
};

// Exercises the actual no-cache/accept/commit hook with no production HTTP server.
export function SourcesApolloFixture({
  children,
  mode = "installed",
  delay = 20,
  onOperation = () => {},
  job = null,
  startedJob,
}: {
  children: ReactNode;
  mode?: SourcesFixtureMode;
  delay?: number;
  onOperation?: (name: string) => void;
  job?: PluginInstallJob | null;
  startedJob?: PluginInstallJob;
}) {
  const [scope] = useState(() => {
    const controller = new VaultInvalidationController();
    const client = new ApolloClient({
      cache: createVaultCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            onOperation(operation.operationName ?? "");
            if (operation.operationName === "PluginInstallProgress") {
              observer.next({ data: { pluginInstallProgress: job } });
              return undefined;
            }
            if (mode === "loading") return undefined;
            const timer = setTimeout(() => {
              if (mode === "error") {
                observer.error(new Error("Could not load fixture plugins"));
                return;
              }
              const revision = { epoch: "sources-story", seq: "1" };
              const responses: Record<string, unknown> = {
                LatestPluginInstallJob: { pluginInstallJob: job },
                InstalledSources: { sources: { revision, sources: mode === "empty" ? [] : [source] } },
                PluginVersions: {
                  sourceVersions: {
                    revision,
                    versions: [
                      { id: source.id, availableVersion: "1.1.0", updateAvailable: true, error: null },
                    ],
                  },
                },
                PluginShareable: {
                  sourceShareable: {
                    revision,
                    paints: ["Silver", "Gold", "White", "Black", "Red", "Blue"].map((name) => ({
                      id: `user:${name}`,
                      name: `Custom · ${name}`,
                    })),
                    schemes: [],
                    templates: [],
                  },
                },
                PluginRemoval: {
                  sourceRemoval: {
                    revision,
                    source: { id: source.id, name: source.name, version: source.version },
                    removes: source.counts,
                    blockers: [],
                    canRemove: true,
                  },
                },
              };
              observer.next({ data: responses[operation.operationName ?? ""] as Record<string, unknown> });
              observer.complete();
            }, delay);
            return () => clearTimeout(timer);
          }),
      ),
    });
    return { client, controller };
  });
  const [originalFetch] = useState(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
      if (url.pathname === "/api/catalog-sources")
        return Response.json({
          job:
            init?.method === "POST"
              ? (startedJob ?? {
                  id: "new-job",
                  stage: "READING",
                  done: 0,
                  total: 0,
                  percent: 0,
                  cancellable: true,
                  error: null,
                  errorCode: null,
                  errorParameters: [],
                })
              : {
                  id: "background-job",
                  stage: "SUCCEEDED",
                  done: 1,
                  total: 1,
                  percent: 100,
                  cancellable: false,
                  error: null,
                  errorCode: null,
                  errorParameters: [],
                },
        });
      if (url.pathname === "/api/version") return Response.json({ version: "story-fixture" });
      throw new Error(`Unexpected source story request: ${url.pathname} (${init?.method ?? "GET"})`);
    };
    return original;
  });
  useEffect(
    () => () => {
      window.fetch = originalFetch;
      scope.client.stop();
      scope.controller.dispose();
    },
    [scope, originalFetch],
  );
  return (
    <VaultGraphQLContext.Provider value={scope}>
      <PluginInstallProvider client={scope.client}>{children}</PluginInstallProvider>
    </VaultGraphQLContext.Provider>
  );
}
