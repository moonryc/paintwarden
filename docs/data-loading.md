# Screen-level data loading

All production screens use typed Apollo projections. Home remains the default;
`#paints` is a supported direct Library entry in HTTP and `paintwarden://app`.
No screen downloads a whole-vault snapshot or reconstructs `State` from pages.

| Screen            | Initial data                                                             | Deferred data                                                   |
| ----------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Home / Miniatures | Bounded tiles, global counts/readiness and facets                        | Selected drawer metadata, paged recipe and attachments          |
| Paints            | 48-row windows, global counts, filter facets, raw stock and availability | Selected paint, substitution options/ingredients, used-by pages |
| Wishlist          | Independent shopping/issues windows and project choices                  | Complete association pages and full filtered sharing/export     |
| Schemes           | Bounded summaries, global/context facets, usage/readiness                | Complete selected scheme entries and editor                     |
| Templates         | Bounded summaries, search/category/source facets                         | Selected full recipe, independently paged paints/schemes        |
| Settings          | Auth, version, connection/updater bridge                                 | Plugins metadata/counts/licenses only after Plugins opens       |
| Plugins           | Local installed-source summary/counts                                    | Removal preview, local shareable choices, version check state   |
| Paint Tools       | Bounded ranking and selected paint/options                               | Selected scheme recipe and conversion choices                   |

Every list remains virtualized with keyboard page-boundary access and final-item
reachability. Filter/search membership, counts, derived readiness and source
provenance come from the server. List summaries are not editor records. A scheme
card previews the first 32 authored color stops (repeats retained), caps paint-name
text at 512 characters, and labels every omission with an accessible `+N more`.
Its detail/editor still loads the full sequence; these are not authoring limits.

The active default paint option overrides physical ownership. Empty/circular active
substitutions are unavailable with no fallback; unavailable descendants propagate.
Imported direct self-ingredients refer to physical original stock rather than a
cycle. Broken reasons remain distinct from missing stock and show red repair UI.
Buying never silently fixes a broken substitution or adds broken-only paint to
shopping. These rules are shared core/server semantics, not page-local guesses.

## Costs and limits

Bounded response size does not imply constant server CPU. Global fuzzy membership
and readiness can scan the compact paint/relationship graph on a new durable
generation; subsequent requests reuse it. Invalidation is conservative, and the
30k stress fixture can still block during an aggregate rebuild. Official scale is
a realistic few-thousand-paintwarden (including plugins), roughly 1–2k miniatures;
30k is a stress test, not a new support promise.

Queries are constrained before data SQL: body/text/parser/depth/field/root/cost,
ID length, page sizes, rate and stream limits. No new arbitrary recipe/exclusion
count authoring cap was introduced. Cursors bind to revision, filter and stable
order. Old cursors restart a complete loaded window with bounded retries.

Auth, source operations, uploads, images and streamed backup/restore remain REST.
Plugins network checks are deferred until Plugins opens; GraphQL field resolvers
never fetch GitHub. Installed data and the local server remain offline-capable.
See [architecture](architecture.md), [development](graphql-development.md),
[final measurements](benchmarks/graphql-final.md), and individual screen contracts.

## Loading presentation

`Components/PageSkeletons.tsx` owns a distinct `data-skeleton` layout for every
page, Plugins, miniature detail and paint detail. Startup/auth checks keep the app
shell mounted and select the current route's skeleton (`#paints` included). Page
chunk Suspense fallbacks use the same mapping; they never fall back to Workbench.
Pages use `useInitialPageLoading` only until the first successful read, so later
filtering and invalidation do not replace focused controls or accepted content.
Settings has no blocking page query; its skeleton covers startup and chunk loads.

Skeleton regions expose `aria-busy`, one polite loading status, and hidden MUI
shapes with reduced-motion support. Header typography, toolbar footprints, measured
shelf breakpoints and tile sizes mirror their content. Keep these together when
changing a page layout. Unknown row counts and conditional Wishlist panels cannot
reserve an exact final height. Miniature detail shares its real responsive drawer
frame and reuses a cached list preview's photo presence to choose the hero height;
a direct open without that preview reserves photograph space until detail arrives.
Paint detail retains its normal Modal. Lazy **dialog code** loading remains owned
by `DeferredDialog`, independently of these detail-query skeletons.

Adjacent Storybook stories cover each layout, real delayed Apollo reads, route
startup, focus retention and template-grid measurement after a skeleton unmounts.
