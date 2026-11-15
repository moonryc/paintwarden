import assert from "node:assert/strict";
import { test } from "node:test";

import { ServerError, CombinedGraphQLErrors } from "@apollo/client/errors";
import { i18n, translateServerError } from "@paintwarden/i18n/runtime";

import { createVaultStore } from "../store/vault-store";

import { createVaultGraphQLClient, isVaultRateLimited, type VaultGraphQLError } from "./client";
import { LibraryPageDocument, VaultChangesDocument } from "./generated/graphql";
import { readLibraryWindow } from "./library-loader";

function page(name = "Paint", seq = 1, hasNextPage = false) {
  return {
    library: {
      __typename: "PaintConnection",
      nodes: [
        {
          __typename: "Paint",
          id: name,
          brand: "Brand",
          range: "Range",
          name,
          colorHex: "#ffffff",
          type: "acrylic",
          discontinued: false,
          inventory: null,
        },
      ],
      pageInfo: { __typename: "PageInfo", hasNextPage, endCursor: `cursor-${name}-${seq}` },
      revision: { __typename: "VaultRevision", epoch: "vault", seq: String(seq) },
    },
  };
}
const json = (data: unknown) =>
  new Response(JSON.stringify({ data }), {
    headers: { "content-type": "application/json" },
  });
const body = (init?: RequestInit) =>
  JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
    operationName: string;
    variables: { first?: number; after?: string | null; epoch?: string; since?: string };
  };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

void test("HTTP auth is evaluated per operation and each client starts with an isolated cache", async () => {
  let token = "first";
  const headers: Headers[] = [];
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({ authorization: token }),
    fetch: async (url, init) => {
      assert.equal(url, "/api/graphql");
      assert.equal(init?.credentials, "same-origin");
      assert.deepEqual(
        Object.keys(body(init)).sort(),
        ["operationName", "query", "variables"],
        "HTTP payload obeys the server allowlist; Apollo telemetry extensions are disabled",
      );
      headers.push(new Headers(init?.headers));
      return json(page(token));
    },
  });
  await scope.client.query({ query: LibraryPageDocument });
  token = "second";
  await scope.client.query({ query: LibraryPageDocument });
  assert.deepEqual(
    headers.map((entry) => entry.get("authorization")),
    ["first", "second"],
  );
  const other = createVaultGraphQLClient({ authHeaders: () => ({}) });
  assert.deepEqual(other.client.cache.extract(), {});
  scope.dispose();
  assert.deepEqual(scope.client.cache.extract(), {});
  other.dispose();
});

void test("disposing a scope cancels old requests; a late server result cannot restore its cache", async () => {
  const response = deferred<Response>();
  const started = deferred<void>();
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: () => {
      started.resolve();
      return response.promise;
    },
  });
  const pending = scope.client.query({ query: LibraryPageDocument }).catch(() => undefined);
  await started.promise;
  scope.dispose();
  response.resolve(json(page("old-account")));
  await pending;
  assert.deepEqual(scope.client.cache.extract(), {});
});

void test("cookie-only logout advances the auth generation even with an already-empty bearer token", () => {
  const store = createVaultStore();
  assert.equal(store.getState().token, "");
  store.getState().setToken("");
  assert.equal(store.getState().authGeneration, 1);
  store.getState().setToken("new-account");
  assert.equal(store.getState().authGeneration, 2);
});

void test("HTTP access denial immediately clears cached account data", async () => {
  let denied = false;
  const errors: VaultGraphQLError[] = [];
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    onError: (error) => errors.push(error),
    fetch: async () =>
      denied ? new Response('{"error":"sign in"}', { status: 401 }) : json(page("private")),
  });
  await scope.client.query({ query: LibraryPageDocument });
  assert.notDeepEqual(scope.client.cache.extract(), {});
  denied = true;
  await scope.client.query({ query: LibraryPageDocument }).catch(() => undefined);
  assert.equal(errors[0]?.accessDenied, true);
  assert.deepEqual(scope.client.cache.extract(), {});
});

void test("refresh uses bounded pages and restarts the entire window after STALE_CURSOR", async () => {
  const requests: ReturnType<typeof body>["variables"][] = [];
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async (_url, init) => {
      const request = body(init);
      requests.push(request.variables);
      if (requests.length === 1) return json(page("old", 1, true));
      if (requests.length === 2)
        return new Response(
          JSON.stringify({ errors: [{ message: "changed", extensions: { code: "STALE_CURSOR" } }] }),
          { headers: { "content-type": "application/json" } },
        );
      return json(page(request.variables.after ? "tail" : "head", 2, !request.variables.after));
    },
  });
  const result = await readLibraryWindow(scope.client, 2);
  assert.equal(result.library.nodes.length, 2);
  assert.equal(result.library.revision.seq, "2");
  assert.deepEqual(
    requests.map((entry) => entry.after),
    [null, "cursor-old-1", null, "cursor-head-2"],
  );
  assert.ok(requests.every((entry) => entry.first === 48));
  assert.deepEqual(scope.client.cache.extract(), {}, "window reads do not partially overwrite visible cache");
  scope.dispose();
});

void test("SSE uses POST and reconnects from the last delivered cursor; disposal aborts it", async () => {
  const first = deferred<void>();
  const second = deferred<void>();
  const aborted = deferred<void>();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const requests: ReturnType<typeof body>[] = [];
  const encoder = new TextEncoder();
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({ authorization: "session" }),
    sseRetry: async () => {},
    fetch: async (url, init) => {
      assert.equal(url, "/api/graphql/stream");
      assert.equal(init?.method, "POST");
      assert.equal(new Headers(init?.headers).get("authorization"), "session");
      requests.push(body(init));
      const connection = requests.length;
      const stream = new ReadableStream<Uint8Array>({
        start(current) {
          controller = current;
          current.enqueue(
            encoder.encode(
              `event: next\ndata: ${JSON.stringify({
                data: {
                  vaultChanges: {
                    epoch: "vault",
                    seq: requests.length === 1 ? "2147483648" : "2147483650",
                    reset: false,
                  },
                },
              })}\n\n`,
            ),
          );
          init?.signal?.addEventListener(
            "abort",
            () => {
              if (connection === 2) {
                current.close();
                aborted.resolve();
              }
            },
            { once: true },
          );
        },
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream" } });
    },
  });
  const subscription = scope.client
    .subscribe({ query: VaultChangesDocument, variables: { epoch: "vault", since: "2147483647" } })
    .subscribe({
      next(result) {
        if (result.data?.vaultChanges.seq === "2147483648") first.resolve();
        if (result.data?.vaultChanges.seq === "2147483650") second.resolve();
      },
    });
  await first.promise;
  controller.error(new Error("network disconnected"));
  await second.promise;
  assert.equal(requests[0].variables.since, "2147483647");
  assert.equal(requests[1].variables.since, "2147483648");
  scope.dispose();
  await aborted.promise;
  subscription.unsubscribe();
});

void test("SSE access denial is reported once without retrying permanent auth errors", async () => {
  const reported = deferred<VaultGraphQLError>();
  let requests = 0;
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    onError: reported.resolve,
    sseRetry: async () => {},
    fetch: async () => {
      requests += 1;
      return new Response(null, { status: 401 });
    },
  });
  const subscription = scope.client
    .subscribe({ query: VaultChangesDocument, variables: { epoch: "vault", since: "0" } })
    .subscribe({ error: () => {} });
  const error = await reported.promise;
  assert.equal(error.accessDenied, true);
  assert.equal(requests, 1);
  assert.deepEqual(scope.client.cache.extract(), {});
  subscription.unsubscribe();
  scope.dispose();
});

void test("network and unknown transport failures expose localized generic text, not diagnostics", async () => {
  const previous = i18n.language;
  await i18n.changeLanguage("de");
  try {
    for (const cause of [
      new TypeError("Failed to fetch private-host"),
      "raw server diagnostic",
      Object.freeze(new Error("frozen diagnostic")),
    ]) {
      const errors: VaultGraphQLError[] = [];
      const scope = createVaultGraphQLClient({
        authHeaders: () => ({}),
        onError: (error) => errors.push(error),
        // Exercise the non-Error throw path too: network libraries may reject arbitrary values.
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        fetch: () => Promise.reject(cause),
      });
      try {
        await assert.rejects(scope.client.query({ query: LibraryPageDocument }), (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, i18n.t("errors:REQUEST_FAILED"));
          assert.equal(error.cause, cause, "retain diagnostic cause without mutating the transport error");
          if (cause instanceof Error) assert.notEqual(cause.message, error.message);
          return true;
        });
        assert.deepEqual(errors, [{ message: i18n.t("errors:REQUEST_FAILED"), accessDenied: false }]);
      } finally {
        scope.dispose();
      }
    }
  } finally {
    await i18n.changeLanguage(previous);
  }
});

void test("HTTP server errors retain original class/status as cause with sanitized consumer text", async () => {
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => new Response("private server diagnostic", { status: 500 }),
  });
  try {
    await assert.rejects(scope.client.query({ query: LibraryPageDocument }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(ServerError.is(error.cause));
      assert.equal(error.cause.statusCode, 500);
      assert.notEqual(error.cause.message, error.message);
      assert.equal(error.message, i18n.t("errors:REQUEST_FAILED"));
      return true;
    });
  } finally {
    scope.dispose();
  }
});

void test("all HTTP and GraphQL auth denial codes still dispose the scope", async () => {
  for (const denial of [401, 403, 428, "UNAUTHENTICATED", "FORBIDDEN"]) {
    const errors: VaultGraphQLError[] = [];
    let denied = false;
    const scope = createVaultGraphQLClient({
      authHeaders: () => ({}),
      onError: (error) => errors.push(error),
      fetch: async () =>
        !denied
          ? json(page("private"))
          : typeof denial === "number"
            ? new Response("private auth diagnostic", { status: denial })
            : Response.json({
                errors: [{ message: "private auth diagnostic", extensions: { code: denial } }],
              }),
    });
    await scope.client.query({ query: LibraryPageDocument });
    denied = true;
    await scope.client.query({ query: LibraryPageDocument }).catch(() => undefined);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].accessDenied, true, String(denial));
    assert.equal(errors[0].message, i18n.t("errors:UNAUTHENTICATED"));
    assert.deepEqual(scope.client.cache.extract(), {});
    scope.dispose();
  }
});

void test("GraphQL stable codes/parameters survive localization and legacy diagnostics are hidden", async () => {
  for (const extensions of [
    { code: "STALE_CURSOR" },
    { code: "BAD_USER_INPUT", errorCode: "INVALID_SELECTION", errorParameters: { value1: "paint" } },
    { code: "UNKNOWN_LEGACY_CODE" },
  ]) {
    const scope = createVaultGraphQLClient({
      authHeaders: () => ({}),
      fetch: async () => Response.json({ errors: [{ message: "private English diagnostic", extensions }] }),
    });
    try {
      await assert.rejects(scope.client.query({ query: LibraryPageDocument }), (error: unknown) => {
        assert.ok(CombinedGraphQLErrors.is(error));
        assert.equal(error.message, translateServerError({ extensions }));
        assert.deepEqual(error.errors[0].extensions, extensions);
        return true;
      });
    } finally {
      scope.dispose();
    }
  }
});

void test("SSE terminal network failures localize only after the existing retries finish", async () => {
  let requests = 0;
  let retries = 0;
  const reported = deferred<VaultGraphQLError>();
  const delivered = deferred<unknown>();
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    onError: reported.resolve,
    sseRetry: async () => {
      retries += 1;
    },
    fetch: async () => {
      requests += 1;
      throw new TypeError("Failed to fetch SSE private-host");
    },
  });
  const subscription = scope.client
    .subscribe({ query: VaultChangesDocument, variables: { epoch: "vault", since: "0" } })
    .subscribe({ next: (result) => delivered.resolve(result.error), error: delivered.resolve });
  try {
    const error = await delivered.promise;
    assert.ok(error instanceof Error);
    assert.equal(error.message, i18n.t("errors:REQUEST_FAILED"));
    assert.equal((await reported.promise).accessDenied, false);
    assert.equal(requests, 6);
    assert.equal(retries, 5);
  } finally {
    subscription.unsubscribe();
    scope.dispose();
  }
});

void test("HTTP 429 retains a specific localized retryable message and status without diagnostics", async () => {
  const errors: VaultGraphQLError[] = [];
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    onError: (error) => errors.push(error),
    fetch: async () => new Response("private limiter diagnostic", { status: 429 }),
  });
  try {
    await assert.rejects(scope.client.query({ query: LibraryPageDocument }), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, i18n.t("errors:RATE_LIMITED"));
      assert.ok(ServerError.is(error.cause));
      assert.equal(error.cause.statusCode, 429);
      assert.equal(isVaultRateLimited(error), true);
      return true;
    });
    assert.deepEqual(errors, [{ message: i18n.t("errors:RATE_LIMITED"), accessDenied: false }]);
    assert.equal(isVaultRateLimited(new Error("offline")), false);
    assert.notEqual(scope.client.cache, null, "throttling never revokes access");
  } finally {
    scope.dispose();
  }
});

void test("GraphQL and SSE throttling retain RATE_LIMITED instead of generic failure", async () => {
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    fetch: async () => new Response("private limiter diagnostic", { status: 429 }),
  });
  const delivered = deferred<unknown>();
  const subscription = scope.client
    .subscribe({ query: VaultChangesDocument, variables: { epoch: "vault", since: "0" } })
    .subscribe({ next: (result) => delivered.resolve(result.error), error: delivered.resolve });
  try {
    const error = await delivered.promise;
    assert.ok(CombinedGraphQLErrors.is(error));
    assert.equal(error.message, i18n.t("errors:RATE_LIMITED"));
    assert.equal(isVaultRateLimited(error), true);
  } finally {
    subscription.unsubscribe();
    scope.dispose();
  }
});

void test("aborting superseded picker work rejects its caller without a shared error notification", async () => {
  const controller = new AbortController();
  const started = deferred<void>();
  const reported: VaultGraphQLError[] = [];
  const scope = createVaultGraphQLClient({
    authHeaders: () => ({}),
    onError: (error) => reported.push(error),
    fetch: (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Superseded search", "AbortError")),
          { once: true },
        );
        started.resolve();
      }),
  });
  try {
    const request = scope.client.query({
      query: LibraryPageDocument,
      context: { fetchOptions: { signal: controller.signal } },
    });
    const rejected = assert.rejects(request, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(error.cause instanceof DOMException);
      assert.equal(error.cause.name, "AbortError");
      return true;
    });
    await started.promise;
    controller.abort();
    await rejected;
    assert.deepEqual(reported, []);
  } finally {
    scope.dispose();
  }
});
