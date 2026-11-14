# Library server contract (Phase 2)

Schema: `apps/paintwarden/graphql/schema.graphql`. Generated typed documents live in
`packages/vault-ui/src/dom/graphql/generated`; `npm run codegen` owns both client
and resolver output. The ordinary protected JSON POST endpoint now accepts queries
**and mutations**; subscriptions still require the dedicated POST SSE endpoint.
All existing host, Origin, owner/session, body-size and operation budgets apply.

## Collection semantics

`library(first, after, filter, search, brand, sourceId, sourceName, noSource)` returns
bounded paint rows, matching `totalCount`, global `catalogCount`, global effective
`availableCount`, global **explicit** `explicitWishlistCount`, facets and a revision.
`first` is 1–100. The phase-1 `library { nodes pageInfo revision }` query remains
valid; this is now a complete Library projection rather than raw inventory alone.

- `OWNED` means effective availability, not physical original ownership. `WISHLIST`
  means explicit inventory state, not depleted owned stock. `UNTRACKED` excludes
  effectively available and explicitly wishlisted paints. A paint may be both
  effectively available and explicitly wishlisted.
- Nonblank trimmed search forces `ALL`; whitespace-only search does not. Search
  runs **on the server**, using the existing core `createFuzzyIndex` /
  `searchFuzzyIndex` scoring, normalization, literal precedence and typo behavior.
  Library text is `Custom ` (custom paints only), brand, range, name. Brand/plugin
  filtering happens **after** ranking, as on the legacy screen. No catalog search
  index or full catalog is transferred to the client.
- Base order is SQLite binary `(brand, range, name, id)`; fuzzy/literal score ties
  preserve that base order. The final ID is stable and prevents equal-name rows
  disappearing or duplicating across pages. This deliberately replaces incidental
  insertion order for ties, as required by the pagination decision.
- Brand `Custom` groups every `user:` paint, regardless of its saved brand. Brand
  null/omitted/`ALL` means all brands. Source name groups duplicate source names,
  matching the existing Plugin UI. `noSource: true` means no installing source;
  `sourceId` is also available for ID-specific consumers. Last source by source-ID
  key order wins when sources share a paint, matching snapshot formatting.
- Brand/source facets are global and include full distinct options; source facet
  key/label is the name, or empty key / `Not from a plugin`. Inventory facet counts
  respect search/brand/source but ignore the selected inventory filter. They are
  full result-set counts, never loaded-page counts.

Cursors are opaque versioned base64url values containing a query fingerprint,
revision and result position. A different filter/search/owner cannot reuse a
cursor (`BAD_USER_INPUT`); any intervening revision returns `STALE_CURSOR`. Refetch
all loaded pages together, restarting from page one on a stale cursor. Cursors are
not authorization credentials and are not required to be cryptographically signed.

## Paint details and options

`Paint` contains stock, source provenance, effective `available`, active recipe
ID/name, root `brokenReason` (`EMPTY`/`CYCLE`), `missingStock`, and
`brokenSubstitution`. The last flag includes broken descendants; the root reason
only describes this paint's own recipe. Missing stock and broken substitution can
both be true and must not be collapsed into a purchase recommendation.

The read service directly uses the shared core substitution resolver: active
default replaces physical original ownership; broken empty/long-cycle recipes
never fall back to owning the original; valid ancestors of broken recipes remain
unavailable; imported direct self-ingredients mean physical original stock.
Saved non-default recipes are independently evaluated and never change availability.
Parts remain ratios, not bottle consumption.

`paint(id)` returns nullable paint plus revision, paged saved substitutions,
paged `usedBy` miniatures. Similar-paint tools use the separate `paintRanking` query. `usedBy` means
original manual or attached-scheme target paints, deduplicated per miniature;
it does **not** mean transitive substitution ingredients. Unknown IDs yield an
empty detail envelope. `substitution(id)` supports independent ingredient paging.
Connections expose `nodes`, `totalCount`, and `pageInfo`; their cursors are tied to
the owning entity and the captured revision. Saved substitutions order by ID,
ingredients by sortOrder/paint ID, used-by by title/ID. All pages remain reachable.

`paintOptions(search, excludeIds, first)` returns revision plus bounded `items`.
Search text is brand, range, name (no Library-only Custom prefix), matching the
existing picker. Exclusions are applied **before** ranking, so an excluded literal
cannot suppress eligible typo suggestions. Exclusion count has no new product cap;
the existing 128 KiB JSON body / 32 KiB operation-text budgets bound input work,
and every individual ID is at most 256 characters. `first` is capped at 30. Paint/substitution IDs, search/filter strings and clientMutationId
are capped at 256 UTF-16 code units; cursors at 8192; epochs at 128. Nested
substitution pages cap at 30 and ingredient/usage pages at 100. Schema-aware expanded cost multiplies nested page bounds; combined requests
must still fit the 10,000 cost budget (the shipped detail document requests ten
recipes × twenty ingredients, not thirty × one hundred).

## Stock commands and invalidation

`setPaintStock(paintId, state, stockLevel, quantity, clientMutationId)` returns the
post-write paint, same-transaction revision, echoed clientMutationId and affected
families. The mutation and legacy REST PUT `/api/paint-state` call the same
synchronous `lib/paint-stock.ts` command. Existing normalization is retained:
owned quantity defaults to one, clamps to 0–999, and zero clears the record;
untracked/null state clears; wishlisted quantity is zero; owned stock is LOW only
when requested, otherwise FULL; wishlist EMPTY is retained. Invalid GraphQL enums
are rejected by coercion. Negative GraphQL quantities are rejected before SQL.
The optional clientMutationId is an echo, not an idempotency or concurrency token.
Last save wins; clients serialize rapid edits and use revision envelopes.

Existing SQLite triggers remain the sole durable change source: GraphQL, REST,
source, restore and other committed writes invalidate GraphQL revisions.
The row-materializing REST changes endpoint and snapshot are removed. Unknown
write targets return typed `NOT_FOUND` (REST 404), improving the old FK 500; clears
of unknown IDs retain the harmless no-op behavior. `vaultRevision` is a cheap focus
check, and `vaultInvalidation(epoch,since)` shares the SSE family catch-up path.

## Read architecture and verification

Library never calls `vaultSnapshot`. A revision-keyed, immutable **paint-domain**
projection loads four fixed SQL statements on a cold revision (paint/stock join,
source provenance join, substitutions, ingredients), then indexes/ranks/counts in
memory. It excludes miniatures, scheme contents, templates, project recipes and
legacy per-project substitution choices. Warm requests only check the durable
revision before reusing it. This minimizes full-vault materialization; it is not a
claim that availability or fuzzy search can be computed without catalog-wide work.
Any revision conservatively rebuilds, even an unrelated miniature edit. Cache
entries are never read/published from caller-owned write transactions, avoiding
uncommitted/rolled-back revision pollution. Stock envelopes capture their own
immutable projection before commit. Nested resolver pages use that captured
projection instead of making later inconsistent reads. Paint detail alone reads
direct usage associations in its root transaction; there is no per-row N+1.

Focused checks: `npm run test:graphql --workspace paintwarden`, shared stock route
tests, `npm run codegen:check`, and app typecheck. The Library domain suite covers
counts/filter/search/source parity, substitutions including empty/cycle/direct-self,
ID paging and cursor invalidation; HTTP tests verify stock writes, decimal-string
revisions, durable trigger-log invalidation, route protection and pre-SQL budget rejection.
Generated production operations themselves are checked against the operation
budget. Large/stress cold/warm measurements are separate from semantic correctness.

## Client integration (Phase 2)

Apollo is the default Library path; there is no debug flag or debug panel. `#paints`
opens Library directly in both HTTP and `paintwarden://app`, without `/api/state`.
The default entry remains Home; navigation is unchanged. All screens and overlays
now use bounded Apollo projections. The snapshot endpoint/cache/row merges and
TanStack dependency are removed. See `data-loading.md` and `graphql-miniatures.md`.

The typed invalidation controller maps trigger-log events to Library, paint detail,
options, Home, miniatures, Wishlist, schemes, templates and sources. Source metadata
has a separate sources-only trigger. Reset/epoch events clear the entire Apollo
scope and invalidate all active projections. Inactive root queries are evicted;
mounted windows retain authorized stale rows during refresh/error, never partial
new pages. No-change events do not evict or rerender. Query/mutation revisions do
not advance the subscription cursor. Parallel initial reads rewind the stream to
the earliest same-epoch envelope, and family dirty watermarks plus generation
checks reject late results. Retired-epoch events cannot reset back to an old server.
The SSE link catches up from its last delivered cursor on reconnect; visibility,
focus, online and visible 30-second checks run the same catch-up read, with access
checks, and restart an exhausted stream. Account/server scope changes dispose
requests and the sensitive Apollo cache.

Library refreshes all loaded 48-row pages atomically after edits, preserving scroll
geometry. It has no five-page cap. Pagination uses the immutable, revision-scoped
server projection and stable ID ordering; an opaque cursor cannot be reused with a
new revision/filter. Virtualized rendering and Tab handoff can fetch the next page;
late handoff never steals focus after clicking away. Detail recipes, ingredient
lists and used-by references likewise expose subsequent pages. Search uses the
same core fuzzy index/scorer on the server, rather than transferring the full
catalog and another worker copy. Picker exclusions apply before ranking, as before.
Production catalog search does not transfer a second full-catalog worker copy.

Stock edits are serialized per paint, with per-edit Apollo optimistic layers for
raw inventory and guarded rollback. Last save wins; Undo is retained. Global counts
and substitution availability always come from accepted server projections, not
client guesses over loaded pages. GraphQL stock writes and REST edits feed the same
SQLite trigger log. SSE invalidates complete loaded windows; no row-delta client/cache remains.
