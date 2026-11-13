# Home and Miniatures projections (Phase 3)

`packages/vault-ui/src/dom/graphql/miniature-list.graphql` owns the production
`MiniatureList` operation. Its `workbench` variable selects exactly one root:
`home` for Workbench and `miniatures` for the collection. The shared Home component
preserves the existing Step/Collection selectors, search, Add tile and responsive
virtualized shelf. It does not call `useVault()` or construct a partial `State`.

## Projection and counts

The tile fragment selects only identity, title, ownership, image URL, readiness
`total`/`missing`, and compact color swatches. A tile is deliberately neither a
complete Miniature editor nor a Paint. `MiniatureTile` accepts the compact colors
without inventing Paint records. The server filters out paints without colors
before bounding the ordered swatches; `PaintGradientPlaceholder` still uses the
first four valid colors, retaining the previous gradient and empty-placeholder
appearance. Recipe rows, paint metadata and notes load only for a selected drawer.

Workbench is owned-only, ordered by newest creation time, normalized title and
unique ID. Its readiness ring, stage counts, distinct missing paints and
wishlisted missing paints are global across owned miniatures, independent of the
loaded page, stage selection and search. An empty recipe is not ready. Broken
active substitutions do not fall back to physical original ownership. The
collection returns global all/owned/wishlist counts and server-filtered rows.

Search runs on the server over title, notes, manufacturer, faction, scale and
painting status, using the shared fuzzy scorer. Nonblank queries are debounced
80ms; whitespace is trimmed. Search preserves the collection/stage filter rather
than forcing All (unlike Library's inventory search rule).

## Server read model

The server builds one immutable batched relationship/readiness aggregate per exact
whole-vault revision, not a legacy `State`. It excludes templates, recipe notes and
image assets from list projections. Home/ownership/stage counts and navigation
scalars are cached with that revision. Any write conservatively rebuilds the paint
and miniature domains, including a stock edit; subsequent list/detail requests
reuse them. This is not a claim of SQL-only or per-row incremental readiness.

Ownership/stage filters precede fuzzy literal precedence. Search result sets are
bounded to 100 with a 60-second idle TTL; an expired search cursor returns
`STALE_CURSOR`. Empty and long-cycle active substitutions never fall back to
ownership of the original; a direct self ingredient means physical stock. Missing
stock and broken-substitution reasons stay separate in detail projections.

## Loading, invalidation and navigation

The client requests 48 rows per page (the server accepts at most 100). The client can load arbitrarily many pages;
there is no five-page ceiling. Near-tail scrolling, Tab handoff and the explicit
**Load more miniatures** button fetch subsequent pages. The shelf continues to
mount only its viewport window with overscan and stable responsive columns.
`data-loaded-count` and `data-total-count` report miniature counts, excluding the
Add tile; tile indices include the Add tile when present.

All reads use `no-cache`. A stale cursor or revision change restarts the complete
loaded chain, with a bounded three-attempt retry. The invalidation controller
accepts the generation/revision before one cache write and one React update
replace the whole loaded window. Accepted rows remain in place on refresh/error;
failed or mixed-generation partial pages are never committed. Query changes hide
old rows immediately. Scope changes hide results from the previous account/server.
Global counts and readiness are never inferred from loaded pages or optimistic
stock. The controller observes accepted envelopes to seed live-update catch-up.

The non-text tile-button keyboard handoff supports virtualized and network page
boundaries. A delayed handoff is canceled if focus has left the shelf, so clicking
another control cannot cause focus to be stolen when a request completes. Text
inputs and selectors are never programmatically focused.

## Verification and fixture boundaries

`miniature-list-loader.test.ts` covers Home and collection windows beyond five
pages, filter propagation, final-item reachability, revision restarts, stale-cursor
retry bounds, missing-cursor failure and cache isolation. Storybook's
`miniature-fixtures.tsx` is an explicit complete-vault adapter for existing stories;
it is not imported by the production path. Apollo Home stories use the production
document, loader and hook with Apollo mocks, testing global counts,
server search beyond the first page, pagination/final-item keyboard navigation,
loading and recoverable errors. Server tests own readiness/filter/order/search
semantics against real temporary SQLite fixtures.

Focused commands (Node 22.22.2):

```sh
node --import tsx --test packages/vault-ui/src/dom/graphql/miniature-list-loader.test.ts
npm run codegen
node scripts/nx.mjs typecheck @paint-vault/ui
npm run storybook:test
```

Web/native/Docker evidence is recorded in the phase report. Passing a browser
story is not a claim of native packaged UI coverage.
