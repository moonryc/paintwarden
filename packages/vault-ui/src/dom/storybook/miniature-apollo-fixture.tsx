// In-memory network fixture: runs the real Apollo loader/cache without reading the legacy vault.
import { ApolloClient, ApolloLink, Observable } from "@apollo/client";
import { useEffect, useState, type ReactNode } from "react";

import { createVaultCache } from "../graphql/cache";
import { VaultInvalidationController } from "../graphql/invalidation";
import { MiniatureFixtureContext } from "../graphql/miniature-list-hooks";
import { VaultGraphQLContext } from "../graphql/provider";
import type { PaintingStatus, State } from "../types";

import { fixtureMiniatureResponse } from "./miniature-api-fixtures";

export function MiniatureApolloFixture({
  children,
  data,
  pageDelay = 25,
  failOnce = false,
  failAfter,
}: {
  children: ReactNode;
  data: State;
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
