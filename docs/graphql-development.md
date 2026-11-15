# GraphQL developer workflow

Use `.nvmrc` (Node 22.22.2) and a fresh temporary `DATA_DIR`; never run mutation
smokes against a personal vault. Apollo Client, Yoga inside the existing Nest
router, and the Guild client preset are the supported stack. There is no migration
flag or snapshot fallback. See [architecture](architecture.md) and
[data-loading](data-loading.md).

```sh
nvm use
npm ci
npm run codegen
npm run test:graphql
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
npm run codegen:check
npm run storybook:test
```

## Add a query or fragment

1. Define the smallest summary/detail contract in
   `apps/paintwarden/graphql/schema.graphql`. Return revision envelopes and bounded
   connections; separate global aggregates from loaded nodes. Do not add a field
   that silently loads an entire catalog/recipe. Use `Sequence` decimal strings
   on the wire, not GraphQL Int, for revisions.
2. Implement the local read/command and typed resolver. Keep related reads in a
   synchronous transaction/captured projection. Reuse shared readiness and domain
   command semantics; no resolver network requests or per-row SQL. Commands must
   feed the same durable trigger log and retain last-save-wins behavior.
3. Add a named operation and reusable fragment in
   `packages/vault-ui/src/dom/graphql/*.graphql`. For example, `library.graphql`
   composes `LibraryPaint` inside the bounded `LibraryPage` connection. Select only
   fields the screen uses. Preserve ID tie-break order and bound nested pages.
4. Run `npm run codegen`. The client preset generates typed documents, result/input
   types and fragment masking under `graphql/generated/`; server resolver types
   are generated under `apps/paintwarden/graphql/generated/`. Import individual
   `*Document` constants from `generated/graphql`, not the all-operations lookup
   map. Read a masked fragment with `getFragmentData(FragmentDocument, value)`.
   Do not hand-edit generated files or replace typed documents with string casts.
5. Model the hook after a nearby screen loader. Read with `no-cache`, capture an
   invalidation ticket, verify scope/revision/family watermarks, then commit the
   complete loaded window. Stable cursor cache policies alone do not prevent late
   or mixed-generation results. Do not manufacture a partial `State`.
6. Register family revision invalidation and operation cost/page-size validation.
   Cover cascades/source restore, inactive roots, refresh of all loaded pages,
   dirty responses, cursor restart and auth/server disposal. Only physical stock
   may be optimistic; derived counts/readiness are server-authoritative.
7. Add real-SQL semantic/HTTP tests, query-budget tests for the actual production
   document (including Apollo `__typename`), hook race tests and Apollo stories for
   loading/error/retry/empty/success plus keyboard/a11y behavior. Review unused SDL
   fields. Commit generated artifacts with their SDL/operation sources.

`codegen:check` regenerates and rejects a git diff in generated directories; after
an intentional schema change, stage/commit the regenerated output before the
freshness gate. CI runs this gate. It does not depend on production introspection.

## Transport and packaging

Ordinary operations use JSON `POST /api/graphql`; subscriptions use exact
`POST /api/graphql/stream` with SSE. Existing host/Origin/setup/auth gates, body and
query budgets, rate/stream limits, no-store and masked errors apply. Auth, files,
images, source operations and backups retain REST. `/api/state` and row-delta
`/api/changes` no longer exist. Do not reintroduce them as test conveniences.

Run the normal production build before native/Docker QA. The server SDL must be
beside `server.mjs`; Vite embeds generated client documents. Repackage the server
with `node scripts/package-desktop-server.mjs electron` after server changes, then
build the actual `.app`. Verify SSE and schema on the actual packaged local and
remote server path, not just in a source-dev Electron window. Pin Node and use the
root lockfile production dependencies on all deployments.

Final acceptance/measurement reproduction: [benchmarks/graphql-final.md](benchmarks/graphql-final.md).
