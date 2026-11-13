import { ApolloClient, ApolloLink, HttpLink } from "@apollo/client";
import { CombinedGraphQLErrors, ServerError } from "@apollo/client/errors";
import { SetContextLink } from "@apollo/client/link/context";
import { ErrorLink } from "@apollo/client/link/error";
import { getMainDefinition } from "@apollo/client/utilities";
import { print } from "graphql";
import { createClient } from "graphql-sse";
import { Observable } from "rxjs";

import { createVaultCache } from "./cache";

type Revision = { epoch: string; seq: number };
export type VaultGraphQLError = { message: string; accessDenied: boolean };
type Options = {
  authHeaders: () => Record<string, string>;
  onError?: (error: VaultGraphQLError) => void;
  fetch?: typeof fetch;
  sseRetry?: (retries: number) => Promise<void>;
};

function revisionFromResult(data: unknown): Revision | null {
  if (!data || typeof data !== "object" || !("vaultChanges" in data)) return null;
  const event = data.vaultChanges;
  if (!event || typeof event !== "object" || !("epoch" in event) || !("seq" in event)) return null;
  return typeof event.epoch === "string" && Number.isSafeInteger(event.seq)
    ? { epoch: event.epoch, seq: event.seq as number }
    : null;
}

// One POST stream per subscription. graphql-sse retries the request; rebuild its variables
// from the last delivered event, not the original query revision, to catch up without gaps.
export function createVaultSSELink(options: Options) {
  return new ApolloLink(
    (operation) =>
      new Observable((observer) => {
        let cursor = { epoch: operation.variables.epoch as string, seq: operation.variables.since as number };
        const request = {
          query: print(operation.query),
          operationName: operation.operationName,
          variables: operation.variables,
        };
        const stream = createClient({
          url: "/api/graphql/stream",
          singleConnection: false,
          credentials: "same-origin",
          headers: options.authHeaders,
          retryAttempts: 5,
          retry: options.sseRetry,
          fetchFn: async (input: RequestInfo | URL, init?: RequestInit) => {
            const response = await (options.fetch ?? fetch)(input, {
              ...init,
              body: JSON.stringify({
                ...request,
                variables: { ...request.variables, epoch: cursor.epoch, since: cursor.seq },
              }),
            });
            // Permanent access/validation failures must not enter the network retry loop.
            // Surface them as GraphQL errors so the shared error link handles both transports.
            if (response.status >= 400 && response.status < 500) {
              const code =
                response.status === 401
                  ? "UNAUTHENTICATED"
                  : response.status === 403 || response.status === 428
                    ? "FORBIDDEN"
                    : "BAD_REQUEST";
              return new Response(
                `event: next\ndata: ${JSON.stringify({ errors: [{ message: `GraphQL stream failed (${response.status})`, extensions: { code } }] })}\n\nevent: complete\ndata: {}\n\n`,
                {
                  headers: { "content-type": "text/event-stream" },
                },
              );
            }
            return response;
          },
        });
        const unsubscribe = stream.subscribe(request, {
          next: (result) => {
            const revision = revisionFromResult(result.data);
            if (revision) cursor = revision;
            observer.next({ data: result.data, errors: result.errors });
          },
          error: (error: unknown) => observer.error(error),
          complete: () => observer.complete(),
        });
        return () => {
          unsubscribe();
          stream.dispose();
        };
      }),
  );
}

export function createVaultGraphQLClient(options: Options) {
  let disposed = false;
  let dispose = () => {};
  const active = new Set<() => void>();
  const lifecycle = new ApolloLink(
    (operation, forward) =>
      new Observable((observer) => {
        if (disposed) {
          observer.complete();
          return;
        }
        const subscription = forward(operation).subscribe(observer);
        const stop = () => {
          subscription.unsubscribe();
          observer.complete();
        };
        active.add(stop);
        return () => {
          active.delete(stop);
          subscription.unsubscribe();
        };
      }),
  );
  const errors = new ErrorLink(({ error }) => {
    const accessDenied =
      (ServerError.is(error) && [401, 403, 428].includes(error.statusCode)) ||
      (CombinedGraphQLErrors.is(error) &&
        error.errors.some((entry) =>
          ["UNAUTHENTICATED", "FORBIDDEN"].includes(String(entry.extensions?.code)),
        ));
    if (accessDenied) dispose();
    options.onError?.({ message: error.message, accessDenied });
  });
  const auth = new SetContextLink(() => ({ headers: options.authHeaders() }));
  const transport = ApolloLink.split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return definition.kind === "OperationDefinition" && definition.operation === "subscription";
    },
    createVaultSSELink(options),
    new HttpLink({ uri: "/api/graphql", credentials: "same-origin", fetch: options.fetch }),
  );
  const client = new ApolloClient({
    cache: createVaultCache(),
    link: ApolloLink.from([lifecycle, errors, auth, transport]),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "cache-and-network",
        notifyOnNetworkStatusChange: true,
      },
      query: { fetchPolicy: "network-only" },
    },
  });
  dispose = () => {
    if (disposed) return;
    disposed = true;
    client.stop();
    for (const stop of [...active]) stop();
    client.cache.restore({});
  };
  return { client, dispose };
}
