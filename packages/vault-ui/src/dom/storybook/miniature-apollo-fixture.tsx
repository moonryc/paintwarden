// In-memory network fixture: runs the real Apollo loader/cache without reading the legacy vault.
import { ApolloClient, ApolloLink, Observable } from "@apollo/client";
import { useEffect, useState, type ReactNode } from "react";

import { createVaultCache } from "../graphql/cache";
import { VaultInvalidationController } from "../graphql/invalidation";
import { MiniatureFixtureContext } from "../graphql/miniature-list-hooks";
import { VaultGraphQLContext } from "../graphql/provider";
import type { PaintingStatus, State } from "../types";

import type { FolderView } from "../Components/FolderTile";

import { fixtureMiniatureResponse } from "./miniature-api-fixtures";

export function MiniatureApolloFixture({
  children,
  data,
  folders = [],
  pageDelay = 25,
  failOnce = false,
  failAfter,
}: {
  children: ReactNode;
  data: State;
  folders?: FolderView[];
  pageDelay?: number;
  failOnce?: boolean;
  failAfter?: string;
}) {
  const [scope] = useState(() => {
    let failed = false;
    const controller = new VaultInvalidationController();
    const client = new ApolloClient({
      cache: createVaultCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            const variables = operation.variables as {
              first: number;
              workbench: boolean;
              after?: string | null;
              ownership?: "ALL" | "OWNED" | "WISHLIST";
              stage?: PaintingStatus | "ALL";
              search?: string;
            };
            if (operation.operationName === "BrowseFolders") {
              observer.next({
                data: {
                  folderBrowser: {
                    revision: { epoch: "storybook", seq: "1" },
                    folders: folders.map((folder) => ({
                      __typename: "Folder",
                      coverThumbnailUrl: null,
                      ...folder,
                    })),
                    totalCount: folders.length,
                    pageInfo: { hasNextPage: false, endCursor: null },
                  },
                },
              });
              observer.complete();
              return;
            }
            if (operation.operationName === "SearchFolderContents") {
              const response = fixtureMiniatureResponse(
                data,
                "MiniatureList",
                { ...variables, workbench: false },
                { epoch: "storybook", seq: "1" },
              ) as {
                miniatures: {
                  revision: { epoch: string; seq: string };
                  miniatures: { nodes: unknown[]; totalCount: number; pageInfo: unknown };
                };
              };
              const matchingFolders = folders.filter((folder) =>
                folder.name.toLowerCase().includes(variables.search?.toLowerCase() ?? ""),
              );
              const timer = setTimeout(() => {
                observer.next({
                  data: {
                    folderSearch: {
                      revision: response.miniatures.revision,
                      results: {
                        ...response.miniatures.miniatures,
                        totalCount: response.miniatures.miniatures.totalCount + matchingFolders.length,
                        nodes: [
                          ...(!variables.after
                            ? matchingFolders.map((folder) => ({
                                __typename: "Folder",
                                coverThumbnailUrl: null,
                                ...folder,
                              }))
                            : []),
                          ...response.miniatures.miniatures.nodes,
                        ],
                      },
                    },
                  },
                });
                observer.complete();
              }, pageDelay);
              return () => clearTimeout(timer);
            }
            const response = fixtureMiniatureResponse(data, operation.operationName, variables, {
              epoch: "storybook",
              seq: "1",
            });
            const timer = setTimeout(() => {
              if (failOnce && !failed && (failAfter === undefined || variables.after === failAfter)) {
                failed = true;
                observer.error(new Error("Miniature fixture temporarily unavailable"));
                return;
              }
              observer.next({ data: response ?? {} });
              observer.complete();
            }, pageDelay);
            return () => clearTimeout(timer);
          }),
      ),
    });
    return { client, controller };
  });
  useEffect(
    () => () => {
      scope.client.stop();
      scope.controller.dispose();
    },
    [scope],
  );
  return (
    <MiniatureFixtureContext.Provider value={null}>
      <VaultGraphQLContext.Provider value={scope}>{children}</VaultGraphQLContext.Provider>
    </MiniatureFixtureContext.Provider>
  );
}
