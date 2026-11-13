# GraphQL foundation (Phases 0–1)

> Historical Phase 0–1 description. Phase 2 replaces the raw Library experiment
> with full typed Library reads and stock mutations, and adds family-scoped
> invalidation. See [the current Library server contract](graphql-library.md).

This is infrastructure plus an **internal experiment**, not a screen migration. Existing Library, Schemes, Wishlist, miniatures and templates still use the existing snapshot and TanStack Query. Apollo Client is the GraphQL client; Yoga subscriptions use SSE. Local desktop remains self-contained; remote offline support is not added.

## Develop

Use the pinned `.nvmrc` Node version and an invented temporary `DATA_DIR`, never an existing vault for testing. The schema is `apps/paint-vault/graphql/schema.graphql`; operations/fragments live in `packages/vault-ui/src/dom/graphql/*.graphql`.

```sh
npm run codegen       # client preset + fragment masking, server resolver types
npm run codegen:check # regenerate and reject changes to checked-in output; also in CI
npm run test:graphql
```

The build and desktop packaging copy the SDL alongside the bundled server. Codegen reads SDL directly, so production introspection need not be enabled.

Build/run the web UI with `VITE_GRAPHQL_LIBRARY_DEBUG=true` to mount the lazy internal Library panel. The default build excludes its entire Apollo/debug chunk. The panel reads 48 rows per request, at most five loaded pages (240 rows). It projects raw catalog/inventory only: **not** full Library filters, readiness, facets or aggregate parity. It is not a replacement-screen benchmark.

## Transport and limits

Both routes pass through the existing session, same-Origin and host checks in `server/api-router.ts`:

- `POST /api/graphql`: one JSON query operation; no GET, mutations, batching, multipart or unknown request keys.
- `POST /api/graphql/stream`: one JSON subscription operation with `Accept: text/event-stream`; no alternate streaming paths.
- Body: 128 KiB; operation text: 32 KiB; parser: 8,000 tokens; exactly one operation; depth: 10; aliases: 10; root fields: 3; expanded selections: 500; multiplicative cost: 10,000. Fragments are expanded on each use and skipped selections still consume budget. Library `first` must be 1–100. Validation/budget rejection precedes resolver data SQL.
- Each client address **and** canonical session are limited to 120 operations/minute and four active operations. A stream holds its active allowance until cancellation/EOF/error; global streams cap at 128. Tracking maps are bounded. Production introspection is rejected.
- Responses are `no-store`. Unexpected errors are masked with a correlation ID; operation logs contain name, duration and row count, not variables or credentials.

Apollo's HTTP telemetry extensions are disabled: the server accepts only `query`, `variables` and `operationName`. Credentials and authorization are evaluated per operation. Auth changes create a fresh client/cache; server switching unmounts the vault/client. Revoked access aborts operations and clears sensitive cached rows. The SSE link resumes from the last delivered cursor on reconnect and bounds retries.

## Consistency and invalidation

Library uses SQLite keyset pagination with `(brand, range, name, id)` ordering. Its opaque cursor includes collection `{epoch, seq}`; another collection revision rejects an old cursor with `STALE_CURSOR` rather than mixing pages.

`vaultChanges(epoch, since)` emits conservative all-family invalidations with `{epoch, seq, reset}`. `seq` and `since` use the `Sequence` scalar: canonical nonnegative decimal **strings**, not GraphQL's 32-bit `Int`. The current SQLite service uses safe JavaScript integers internally, so values above `9007199254740991` are rejected rather than rounded. On reconnect, retained SQLite change-log state catches the client up to the current revision; restart/epoch mismatch, pruning or reset require a new baseline. This is invalidation catch-up, not a replay of every intermediate edit or mutation payload. The server checks the log and idle-stream authorization about once per second. Logout/revocation and request disconnect stop streams and release concurrency accounting.

The internal panel refetches its complete loaded window using bounded, no-cache reads, retries the whole window on revision mismatch, and publishes one coherent replacement. It preserves list scroll; focus/online are additional recovery triggers, not polling-only updates. Cursor cache policies provide list topology merging/deduplication; future migrated screens must keep the same coherent-revision/late-response discipline rather than assume normalized entity merges alone solve races. Writes remain existing REST/last-save-wins.

Electron streams **only the exact subscription POST route**. All other API responses retain buffering, ordinary deadlines and existing per-origin session behavior. Live streams are canceled on renderer abort/server switch, including requests still awaiting headers; stale responses cannot adopt another server's cookie.

## Acceptance and measurements

- [Semantic contract and coverage](graphql-phase0-semantic-coverage.md)
- [Reproducible large/stress snapshot baseline](benchmarks/graphql-baseline.md)
- [Apollo/debug bundle delta and clean-build measurement](benchmarks/graphql-bundle.md)

A snapshot byte baseline is not browser startup latency, cold disk, React render time, or full migrated-screen parity. Future phases should compare equivalent screen semantics, loaded-window boundaries, aggregates and final-row reachability on the same fixtures. No existing screen is migrated in this phase.
