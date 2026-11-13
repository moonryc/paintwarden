import { ApolloClient, ApolloLink, type Operation } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { useEffect, useState, type ReactNode } from "react";
import { Observable } from "rxjs";

import { createVaultCache } from "../graphql/cache";
import { VaultInvalidationController } from "../graphql/invalidation";
import { VaultGraphQLContext } from "../graphql/provider";

// Exercises the real Apollo hooks without HTTP/SSE or a legacy snapshot.
export function StoryGraphQL({
  respond,
  children,
}: {
  respond(operation: Operation): Record<string, unknown>;
  children: ReactNode;
}) {
  const [scope] = useState(() => ({
    controller: new VaultInvalidationController(),
    client: new ApolloClient({
      cache: createVaultCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            observer.next({ data: respond(operation) });
            observer.complete();
          }),
      ),
    }),
  }));
  useEffect(
    () => () => {
      scope.client.stop();
      scope.controller.dispose();
    },
    [scope],
  );
  return (
    <ApolloProvider client={scope.client}>
      <VaultGraphQLContext.Provider value={scope}>{children}</VaultGraphQLContext.Provider>
    </ApolloProvider>
  );
}
