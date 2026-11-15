# Application architecture

Paintwarden is one single-owner SQLite vault with three hosts: browser, Docker/Nest,
and Electron. Web and desktop render the same React/MUI UI. Electron's local mode
starts its packaged loopback server; remote mode uses an existing server and does
not start a second vault. Local mode works without internet. Remote offline writes
and a durable client replica are not supported.

## Data boundaries

- Nest dispatches protected `/api` routes through `server/api-router.ts`. Host,
  Origin, setup, session, request limits and security headers remain common.
- Yoga serves `POST /api/graphql` queries/mutations and the exact
  `POST /api/graphql/stream` subscription. SDL lives in
  `apps/paintwarden/graphql/schema.graphql`. No production GraphiQL/introspection.
- Server `graphql/` read services return bounded summary/detail models with a captured durable
  revision. It uses SQL aggregates and generation-cached shared paint/readiness
  projections, not an application-wide snapshot. Global counts are not calculated
  from whatever pages happen to be loaded.
- Domain commands share transactions with the supported REST compatibility routes.
  REST remains for authentication, version, source installation/update/removal,
  files/images/imports and streamed backup/restore. Electron connection selection,
  update and native backup export stay behind its preload bridge.
- Apollo is the **only server-data client cache**. Zustand owns credentials,
  actions, navigation and transient UI state, never a second vault database.
  Guild codegen client-preset documents and masked fragments type screen reads.
  `State` is permitted as a backup or Storybook fixture shape, not a runtime API.
- `/api/state`, row-materializing `/api/changes`, their merge/cache machinery and
  TanStack Query are removed. The SQLite change log is not removed.

## Live coherence

SQLite triggers log committed entity keys, including cascades. SSE translates
those keys into affected query families and a decimal-string `{epoch, seq}` cursor.
Reconnect catches up from retained log state; restart, retention gaps or invalid
cursors reset the client scope. Source bookkeeping has its own invalidation key.

Each mounted hook reads bounded pages privately with `no-cache`, validates the
invalidation ticket/generation/revision, then publishes a complete loaded window
atomically. Invalidations mark projections dirty without evicting accepted roots;
only a vault reset clears the cache. Late responses, retired epochs and mixed
page revisions cannot overwrite fresher records. Edits refetch loaded pages,
retain scroll and use stable ID tie-breaks. Only raw stock is optimistic; readiness
and counts are server-authoritative. Last save wins. Mutation receipts never
acknowledge the SSE cursor. Focus/online/visibility and visible 30-second revision
checks are recovery/access checks, not a return to snapshot polling.

Auth changes and server switching dispose operations/subscriptions and clear the
sensitive cache. The Electron proxy streams only the exact subscription route;
ordinary REST/GraphQL responses retain their buffering/deadline behavior.

## Deployment

The production build bundles server code and copies `schema.graphql`, Drizzle
migrations and the Vite web output into `apps/paintwarden/dist`. Docker copies that
whole artifact. Desktop packaging copies the same server/schema/web artifact,
production lockfile dependencies and pinned Node binary. Generated client documents
are compiled into Vite output; generated resolver types are compile-time only.
Never package a web-only rebuild after changing the server. Verify actual built
artifacts in browser, Docker and packaged local/remote modes.

See [data loading](data-loading.md), [GraphQL development](graphql-development.md),
and the per-screen `graphql-*.md` contracts.

## Read and command lifetimes

Read tickets retire on a projection reset or explicit refresh so old list/detail
responses cannot publish into a new read generation. Commands use a separate
vault-identity lifetime (`captureCommand` / `commitCommand`): a same-epoch SSE
reset may arrive before a successful mutation response, but must not falsely
report that committed write as failed or cancel the next queued write. Actual
epoch changes, auth/server scope disposal and an unknown-baseline first reset
retire commands. A response from another/retired epoch is never acknowledged as
this vault's write. Stock keeps a separate strict read ticket for cache
normalization, even when its command legitimately survives a projection reset.
