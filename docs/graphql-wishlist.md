# Wishlist read contract

Wishlist uses Apollo typed documents (`graphql/wishlist.graphql`), not a snapshot or a partial `State`.

## Reads

- `wishlist` returns the first shopping and global missing-not-listed pages together, revision, and global counts. Each connection defaults to 48 and is capped at 100 rows. `miniatureId` filters shopping only; missing-not-listed and header counts remain global.
- Shopping membership is explicit WISHLIST or physically depleted OWNED. Broken substitutions do not implicitly add a shopping row. Project associations include all miniature ownership states and dedupe effective requirements per miniature/paint. A missing row can have `missingStock`, `brokenSubstitution`, or both; only missing stock gets an Add action. Broken substitutions have a red repair action, never a claim that buying repairs the recipe.
- Shopping sorts by normalized brand group (`Custom` for custom paints), project count descending, normalized name, then ID. Normalization uses NFKD, combining-mark removal and lowercase with binary comparison rather than platform collation. The global missing panel remains most-needed first.
- `wishlistModelOptions` is server fuzzy search, paged in 40-row requests. Selection lives separately from results. Search is debounced, superseded reads are aborted, and late results are ignored.
- `wishlistRelatedProjects` loads a bounded 30-project page only when requested. Three preview projects and an explicit truncation flag do not represent the complete association set.
- `wishlistExport` generates the complete filtered list on the server. Sharing never exports only the currently loaded shopping pages or locally retained bought rows.

## Atomic windows and stock

The Wishlist loader fetches both independently sized loaded windows with `no-cache`, checks every page revision and retries the entire window on `STALE_CURSOR` or mixed revisions (at most three attempts). The hook checks the invalidation generation and WISHLIST/PAINT revision watermarks before a single cache/React commit. Relevant edits refetch every loaded page; existing rows remain mounted until replacement. Query changes hide old shopping results immediately. Global missing rows can remain visible while a new miniature filter is loading.

Raw inventory alone can be optimistic via `usePaintStock`; the server owns membership, readiness, reasons and counts. Bought rows are retained locally until leaving Wishlist, preserving editable quantities through the normalized inventory fragment. The retained map is not a substitute for a full vault. Shopping rows and missing checklist keep their existing viewport windowing and keyboard traversal; explicit continuation buttons remain reachable after the loaded window.

Only Storybook supplies `WishlistFixtureContext` from its complete fixture. Production Wishlist never calls `useVault`.

## Checks

`node --import tsx --test packages/vault-ui/src/dom/graphql/wishlist-loader.test.ts` checks independent connection depths, access beyond five pages, unchanged global totals, no premature normalization, stale-cursor reset, mixed-revision rejection, and malformed cursors. Server semantics and database generation tests live in `apps/paint-vault/graphql/wishlist.test.ts`. Wishlist page stories cover stock retention, repair reasons, search, sharing, project associations and keyboard/windowed interaction.
