import { ApolloClient, ApolloLink, HttpLink } from "@apollo/client";
import { CombinedGraphQLErrors, ServerError } from "@apollo/client/errors";
import { SetContextLink } from "@apollo/client/link/context";
import { ErrorLink } from "@apollo/client/link/error";
import { getMainDefinition } from "@apollo/client/utilities";
import { i18n, translateServerError } from "@paintwarden/i18n/runtime";
import { print } from "graphql";
import { createClient } from "graphql-sse";
import { Observable, catchError, map, throwError } from "rxjs";

import { createVaultCache } from "./cache";

type Revision = { epoch: string; seq: string };
export type VaultGraphQLError = { message: string; accessDenied: boolean; connectionLost?: boolean };
type Options = {
  authHeaders: () => Record<string, string>;
  onError?: (error: VaultGraphQLError) => void;
  fetch?: typeof fetch;
  sseRetry?: (retries: number) => Promise<void>;
  onDisconnect?: () => void;
};

// Preserve the status through the sanitized Error wrapper. Background health
// checks can defer throttling without pretending a healthy stream disconnected.
export function isVaultRateLimited(error: unknown): boolean {
  if (ServerError.is(error)) return error.statusCode === 429;
  if (CombinedGraphQLErrors.is(error))
    return error.errors.some((entry) => entry.extensions?.code === "RATE_LIMITED");
  return error instanceof Error && error.cause !== error && error.cause !== undefined
    ? isVaultRateLimited(error.cause)
    : false;
}

// Inspect original transport failures, including the sanitizing wrapper's cause.
// HTTP 500 and GraphQL/validation errors are NOT connectivity failures.
export function isVaultConnectionLost(error: unknown): boolean {
  if (ServerError.is(error)) return [502, 503, 504].includes(error.statusCode);
  if (CombinedGraphQLErrors.is(error)) return false;
  if (error instanceof Error && error.cause !== undefined && error.cause !== error)
    return isVaultConnectionLost(error.cause);
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      /failed to fetch|fetch failed|network ?error|network request failed|ECONNREFUSED|ECONNRESET/i.test(
        error.message,
      ))
  );
}

function revisionFromResult(data: unknown): Revision | null {
  if (!data || typeof data !== "object" || !("vaultChanges" in data)) return null;
  const event = data.vaultChanges;
  if (!event || typeof event !== "object" || !("epoch" in event) || !("seq" in event)) return null;
  return typeof event.epoch === "string" &&
    typeof event.seq === "string" &&
    /^(0|[1-9][0-9]*)$/.test(event.seq)
    ? { epoch: event.epoch, seq: event.seq }
    : null;
}

// One POST stream per subscription. graphql-sse retries the request; rebuild its variables
// from the last delivered event, not the original query revision, to catch up without gaps.
export function createVaultSSELink(options: Options) {
  return new ApolloLink(
    (operation) =>
      new Observable((observer) => {
        let cursor = { epoch: operation.variables.epoch as string, seq: operation.variables.since as string };
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
          on: {
            connecting: (reconnecting) => {
              if (reconnecting) options.onDisconnect?.();
            },
          },
          retry: options.sseRetry,
          fetchFn: async (input: RequestInfo | URL, init?: RequestInit) => {
            const response = await (options.fetch ?? fetch)(input, {
              ...init,
              body: JSON.stringify({
                ...request,
                variables: { ...request.variables, epoch: cursor.epoch, since: cursor.seq },
              }),
            });
            // Permanent access/validation/server bugs must not enter the network retry loop.
            // Surface them as GraphQL errors so the shared error link handles both transports.
            if (response.status >= 400 && ![502, 503, 504].includes(response.status)) {
              const code =
                response.status === 429
                  ? "RATE_LIMITED"
                  : response.status === 401
                    ? "UNAUTHENTICATED"
                    : response.status === 403 || response.status === 428
                      ? "FORBIDDEN"
                      : response.status >= 500
                        ? "INTERNAL_SERVER_ERROR"
                        : "BAD_REQUEST";
              return new Response(
                `event: next\ndata: ${JSON.stringify({ errors: [{ message: i18n.t("shell:graphqlStreamFailed", { value1: response.status }), extensions: { code } }] })}\n\nevent: complete\ndata: {}\n\n`,
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
  const errors = new ErrorLink(({ error, operation }) => {
    // Search effects abort superseded work deliberately. Keep rejecting the
    // operation for its caller, but do not report cleanup as a vault failure.
    if (operation.getContext().fetchOptions?.signal?.aborted) return;
    const accessDenied =
      (ServerError.is(error) && [401, 403, 428].includes(error.statusCode)) ||
      (CombinedGraphQLErrors.is(error) &&
        error.errors.some((entry) =>
          ["UNAUTHENTICATED", "FORBIDDEN"].includes(String(entry.extensions?.code)),
        ));
    if (accessDenied) dispose();
    const connectionLost = isVaultConnectionLost(error);
    if (connectionLost) options.onDisconnect?.();
    options.onError?.({
      message: translateServerError({
        errorCode: accessDenied
          ? "UNAUTHENTICATED"
          : isVaultRateLimited(error)
            ? "RATE_LIMITED"
            : "REQUEST_FAILED",
      }),
      accessDenied,
      ...(connectionLost ? { connectionLost: true } : {}),
    });
  });
  const auth = new SetContextLink(() => ({ headers: options.authHeaders() }));
  const transport = ApolloLink.split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return definition.kind === "OperationDefinition" && definition.operation === "subscription";
    },
    createVaultSSELink(options),
    new HttpLink({
      uri: "/api/graphql",
      credentials: "same-origin",
      fetch: options.fetch,
      // Apollo 4 otherwise adds an extensions.clientLibrary telemetry object.
      // Our endpoint intentionally accepts only query/variables/operationName.
      enhancedClientAwareness: { transport: false },
    }),
  );
  const localizedErrors = new ApolloLink((operation, forward) =>
    forward(operation).pipe(
      map((result) => ({
        ...result,
        ...(result.errors
          ? {
              errors: result.errors.map((error) => ({
                ...error,
                message: translateServerError(
                  error.extensions?.code === "RATE_LIMITED" ? { errorCode: "RATE_LIMITED" } : error,
                ),
              })),
            }
          : {}),
      })),
    ),
  );
  // ErrorLink must inspect the original transport class/status before wrapping.
  // Do not mutate a fetch/library-owned error; retain it as the diagnostic cause.
  // GraphQL result codes remain untouched, and SSE retries happen downstream.
  const localizedTransportErrors = new ApolloLink((operation, forward) =>
    forward(operation).pipe(
      catchError((cause: unknown) =>
        throwError(
          () =>
            new Error(
              translateServerError({
                errorCode: isVaultRateLimited(cause) ? "RATE_LIMITED" : "REQUEST_FAILED",
              }),
              { cause },
            ),
        ),
      ),
    ),
  );
  const client = new ApolloClient({
    cache: createVaultCache(),
    link: ApolloLink.from([lifecycle, localizedTransportErrors, errors, auth, localizedErrors, transport]),
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
