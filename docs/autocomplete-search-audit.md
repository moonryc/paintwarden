# Autocomplete and search-as-you-type audit

Audit date: 2026-11-15. Baseline: `bd5af0377e2b7983d2c0a58551485c897b02e71d`.
All app paths below are relative to `packages/vault-ui/src/dom/`.
Source inventory covers production `apps/` and `packages/`, including modals,
filters, folders, source/plugin sharing and async hooks. Stories and generated
GraphQL documents are not additional user-facing fields.

## Field inventory

The baseline contains **12 MUI Autocomplete declarations in nine files**.
`PaintAutocomplete` is reused in two additional locations. The shared
`StableAutocomplete` implementation now replaces those declarations; it is not
an additional user-facing field.

| Location / field                                                     | Data and search behavior                                                                                                                                                                                                                     | Pagination / baseline risk                                                                                                                      |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Modals/MiniatureForm.tsx`: **Model** when adding a miniature        | `useTemplateCatalog` with typed search and category; server ranking; identity `filterOptions`. Selected template applies name, manufacturer, faction and image. Initial template ID has a separate catalog query, independent of first page. | 48-row pages; baseline external **Load more models**. Search discarded the catalog while pending, removed the button and changed dialog height. |
| `Components/PaintAutocomplete.tsx`: paint                            | `usePaintOptions(query, excludeIds)`; server-ranked paint/brand/range matches; no second client filter.                                                                                                                                      | Bounded default 30 options; baseline cleared options on each query/loading state.                                                               |
| `Components/ProjectRecipe.tsx`: paint step picker                    | Reuses `PaintAutocomplete`; clears query after attaching a paint.                                                                                                                                                                            | Same bounded query.                                                                                                                             |
| `Modals/AddSchemeItemDialog.tsx`: paint to add to scheme             | Reuses `PaintAutocomplete`; query and selected choice live in dialog.                                                                                                                                                                        | Same bounded query.                                                                                                                             |
| `Modals/SubstitutionDialog.tsx`: ingredient paint                    | `IngredientPicker` → `usePaintOptions`, excluding already chosen paints. Label includes paint and brand.                                                                                                                                     | Same bounded query.                                                                                                                             |
| `Pages/PaintTools/PaintComparison.tsx`: **Paint**                    | `usePaintOptions(query.trim(), [])`; selected paint separately drives comparison results.                                                                                                                                                    | 30-option picker; **More matches** belongs to comparison results, not dropdown.                                                                 |
| `Pages/PaintTools/ComplementaryTool.tsx`: **Paint**                  | `usePaintOptions(query.trim(), [])`; selected paint drives complementary/color suggestions.                                                                                                                                                  | 30-option picker; result state is separate from search.                                                                                         |
| `Pages/PaintTools/RecipeConverter.tsx`: source **Scheme**            | `useSchemeOptions`; server-ranked summaries and separate full scheme detail.                                                                                                                                                                 | Cursor pages; baseline external **More schemes** button.                                                                                        |
| Same file: each **Use paint** override                               | `useOwnedPaintOptions(query.trim())`; original paint is always prepended and deduplicated from owned matches.                                                                                                                                | Bounded top-30 owned paint query plus original; no cursor or external paging button.                                                            |
| `Pages/Schemes/ColorSchemesPage.tsx`: multi-select **Uses paint**    | `useSchemePaintOptions`; server options exclude selected paint IDs; selection constrains schemes page results.                                                                                                                               | Bounded top-30 server options; no paging control.                                                                                               |
| `Pages/Templates/TemplateEditorDialog.tsx`: **Start from miniature** | `SourceMiniaturePicker` → `useMiniatureList` with search; template records selected source ID separately.                                                                                                                                    | 48-row pages; baseline external **Load more miniatures**.                                                                                       |
| Same file: multi-select **Schemes**                                  | `useSchemeOptions(search)`; selected chips belong to editor, not current result window.                                                                                                                                                      | Cursor pages; baseline external **Load more schemes**.                                                                                          |
| Same file: multi-select **Required paints**                          | `usePaintOptions(search, selectedIds)`; IDs exclude selected paints; retry remounts bounded read only, preserving editor selections/recipe.                                                                                                  | Bounded 30 options.                                                                                                                             |
| `Pages/WishlistPage.tsx`: **Miniature**                              | `useWishlistModelOptions(modelSearch)`; only input/clear events update search. Options show project count. Selection filters shopping list.                                                                                                  | 40-row cursor pages; baseline external **Load more miniatures**.                                                                                |

## Text searches and non-autocomplete filters

| Location / surface                                                  | Behavior and relevant hooks                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Components/FilterToolbar.tsx`                                      | Shared controlled search field used by Home, Paint Library, Schemes and Templates. Clear button and Escape clear a nonempty query. Does not load data or introduce its own debounce.                                                                                                                                                                                                                                  |
| `Pages/Home.tsx`: Workbench / collection search                     | `useMiniatureList`, `useFolderBrowser` and `useFolderSearch`. Nonempty production search shows mixed folder + miniature results. Flat mode searches across the tree; folder mode carries folder ID. Ownership and stage filters remain in the server variables. Navigating to a folder clears search. This is broad collection search, not a standalone global command palette.                                       |
| `Pages/Templates/MiniatureTemplatesPage.tsx`: model/template search | `useTemplateCatalog`, `useFolderBrowser`, `useFolderSearch(kind: TEMPLATE)`. Mixed folder/template results for nonempty search. Category, source/plugin and no-source filters are carried through both queries. Grid uses intersection-observer pagination plus page fallback button.                                                                                                                                 |
| `Pages/PaintLibrary.tsx`: paint search                              | Store-backed `paintSearch` plus `useLibraryPaints({search, brand, plugin, inventory})`; server search + cursor-window/virtualized rows. Brand, source/plugin and inventory are ordinary select/chip filters, not searchable dropdowns.                                                                                                                                                                                |
| `Pages/Schemes/ColorSchemesPage.tsx`: scheme text search            | `useSchemes` through shared `useSchemeWindow`; baseline page debounces text by 120ms. Category, source/plugin, availability and Uses paint filters narrow server results. Grid scrolling preloads pages; page fallback button is distinct from a picker.                                                                                                                                                              |
| `Modals/SchemePickerDialog.tsx`: **Search schemes or colors**       | Full card/list selection dialog, not MUI Autocomplete. `ApolloSchemePickerDialog` supplies `useSchemeOptions` with search/category/availability/excluded IDs; loaded selections are retained separately. Local/story path uses `useFuzzySearch(pool, query, schemeSearchText)` worker ranking. Remote path does not re-filter already server-ranked results. Its category/availability controls are ordinary filters. |
| `Pages/Sources/CreateSourceDialog.tsx`: **Search items to include** | Source/plugin export dialog; shown when more than five shareable items exist. Synchronous, case-insensitive name substring filtering across paints/schemes/templates in `useMemo`. No network request or loading phase per key. Selection set survives filtering; select/clear-matches acts on visible items. Enter in search does not submit export.                                                                 |
| `Pages/Sources/PluginsModal.tsx` / install flow                     | No additional installed-plugin live-search field or asynchronous repository autocomplete. Repository URL, version, plugin name and export metadata are plain inputs/selects, not search-as-type. Source/plugin filters on library/schemes/templates are covered above.                                                                                                                                                |
| Folder forms / move dialogs / `MiniatureForm` folder field          | Ordinary folder selection (including full ancestor paths where needed), rename/name text and tree navigation, not async autocompletes. `useFolderBrowser(view, kind, search)` also filters folder names locally by case-insensitive substring and parent relationship; production mixed tree searches use `useFolderSearch`.                                                                                          |
| `Layout/`, `Vault.tsx`, Settings and other app roots                | No separate global-search omnibox found. Authentication `autoComplete` attributes are browser autofill hints, not option-search widgets. Plain name/notes/password/URL fields are outside this audit's search scope.                                                                                                                                                                                                  |

## Async boundaries and behavior contract

- `store/template-hooks.ts`: `useTemplateWindow` / `useTemplateCatalog`,
  baseline 80ms delayed first read, keyed by filters; pages are complete accepted
  windows. Keep selected-template ID reads independent of the initial page.
- `graphql/miniature-scheme-hooks.ts`: `useSchemeWindow` / `useSchemeOptions`,
  shared by scheme summaries, paint tools and scheme paint filtering. Baseline
  key changes return null until a replacement accepted window arrives.
- `graphql/detail-hooks.ts`: `usePaintOptions`, baseline 120ms debounce and
  explicit empty results during key mismatch/loading, default `first: 30`.
- `graphql/paint-tools-hooks.ts`: `useOwnedPaintOptions`, bounded 30;
  `graphql/schemes-hooks.ts`: `useSchemePaintOptions`, bounded top-30 server read.
  These APIs have no continuation cursor; infinite scrolling must not invent one.
- `graphql/miniature-list-hooks.tsx`, `graphql/library-hooks.tsx` and
  `graphql/wishlist-hooks.tsx`: revision-aware list windows; Wishlist model options
  use their own 40-row cursor query and abort controller.
- `graphql/folder-search-hooks.ts`: `useFolderSearch`, enabled only for a nonblank
  query; baseline 80ms delay, paged `SearchFolderContents` mixed results.
- `utils/use-fuzzy-search.ts` → `fuzzy-search-task.ts` /
  `fuzzy-search.worker.ts`: asynchronous local ranking, with immediate unfiltered
  output for an empty query. Async results must not overwrite a later query.
- Revised shared contract: `utils/use-search-results.ts` retains a previously
  accepted projection only while pending and only within the same GraphQL scope;
  shared search debounce is 250ms. Settled empty/error results and connection
  changes must not retain options indefinitely. This is presentation retention,
  not permission to write stale/partial results into Apollo.
- `Components/StableAutocomplete.tsx` provides fixed popup/list footprint,
  reserved nonblocking progress indication, live result count and scroll-end
  paging. No options → Loading replacement after initial load, no query-driven
  dialog/field/popup jump. Preserve controlled selection and keyboard behavior.
  Requests still use the real invalidation/accepted-revision boundary. Latest-wins
  AbortControllers cancel obsolete template, paint, scheme, library and folder
  reads, in addition to rejecting stale effect completions.

## External picker pagination inventory

Baseline external controls to replace with **in-dropdown scroll**:

1. MiniatureForm: Load more models (`catalogQuery.loadMore`).
2. TemplateEditor SourceMiniaturePicker: Load more miniatures (`miniatures.loadMore`).
3. TemplateEditor TemplateSchemePicker: Load more schemes (`schemes.loadMore`).
4. RecipeConverter scheme picker: More schemes (`schemeOptions.loadMore`).
5. Wishlist model picker: Load more miniatures (`models.loadMore`).

`SchemePickerDialog` additionally has an external Load more schemes button driven
by `ApolloSchemePickerDialog` / `useSchemeOptions`. It is a dedicated virtualized
card-list dialog, not an autocomplete popup; use its list-scroll boundary rather
than treating it as an unrelated page fallback.

Do not conflate these with page/detail pagination: Home, Templates, Paint Library,
Schemes grids; Wishlist missing-stock/list/project sections; PaintComparison
matches; substitution list/ingredients; PaintDetails used-by projects. Those
buttons are not external autocomplete controls.

## Production browser regression and evidence

`e2e/autocomplete-search.mjs` is imported by `e2e/browser-flows.mjs` and runs via
`npm run e2e:browser` after the ordinary flow and scheme-ranking flow. Each phase
owns a fresh production server/data directory. It can also run independently:

```sh
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run build
E2E_ARTIFACTS_DIR="$HOME/Desktop/REPOS/PERSONAL/paint-tracker-audit/autocomplete-shift/after" \
  node e2e/browser-smoke.mjs --autocomplete-search
```

The runner creates an isolated temporary `DATA_DIR`, ephemeral loopback production
server and fresh browser context. No personal vault/catalog, existing dev server,
main checkout or user app is touched. It seeds 65 synthetic templates using real
authenticated GraphQL mutations, opens Add miniature → Model and exercises slow
and quick typing (`Audit`, 260ms / 15ms inter-key waits). Real TemplateSummaries
response delivery is delayed 150ms for deterministic pending-state observation;
no options or response bodies are mocked.

For each mode `autocomplete-geometry.json` records every animation-frame and
per-keystroke DOM rect (`x`, `y`, `width`, `height`) for the dialog, autocomplete
field, actual input, Popper and listbox; option counts, popup text, missing
listbox and Loading replacement flags are included. All present rectangles must
remain within 1px of their initial loaded state; loaded listbox cannot disappear
or be replaced by Loading. Initial, each slow keystroke, settled and scroll-end
screenshots accompany JSON. The final assertion checks in-dropdown next-page
loading, absence of external Load more models and application of the final model
to miniature Name. A separate stress case types 180 characters at 1ms per key,
checks settled empty results and recovery after clearing, captures a screenshot,
and rejects any page/API error (including React maximum-update-depth failures).
Recorded request variables must keep `first` within the 48-row template budget.

### Captured baseline

Evidence root: `~/Desktop/REPOS/PERSONAL/paint-tracker-audit/autocomplete-shift/`.

- `baseline-existing/`: pre-fix `npm run build` log and existing production browser
  flow **PASS**, eight checks; started 17:23:30Z, finished 17:23:48Z.
- `baseline-geometry/`: targeted production flow **FAIL**, as expected, captured
  against the same unchanged production dist before any core rebuild; started
  17:25:12Z, finished 17:25:24Z. Chromium 156.0.8078.4, Node v22.22.2,
  viewport 1440 × 1050, reduced motion.
- Both slow and quick typing: dialog drift **10.1875px**; field and input drift
  **5.09375px**; popper drift **384px**. Listbox disappeared and Loading replaced
  options for **32 slow frames / 13 quick frames**. Original baseline JSON encodes
  an unbounded/missing-listbox drift as `null`; explicit missing-frame counts and
  raw rectangles retain the evidence. The checker now records finite present-box
  drift and missing-target counts separately.
- Post-fix geometry/build results are recorded separately; baseline evidence must
  not be overwritten. The measured typing test is specifically MiniatureForm
  Model; source inventory alone is not a measured browser pass for other fields,
  native Electron, mobile widths, empty/error responses or keyboard selection.

### Post-fix measurement (before long-query normalization)

- `after/build.log`: production build **PASS**, 6.8s, no cache hits.
- `after/results.json`: targeted run 17:38:42Z–17:38:59Z. Slow and quick typing
  both measured **0px drift** for dialog, field, input, Popper and listbox, with
  **zero** Loading replacement or missing-listbox frames. Dropdown scrolling
  reached the 65th fixture and selection populated miniature Name; no external
  Load more models button was present.
- Overall status was correctly **FAIL** for an additional stress discovery: the
  long input (216 characters in this exploratory run, corrected to exactly 180
  for the final regression) was sent unchanged to a server search argument limited to
  128 characters, producing `BAD_USER_INPUT`. No React update-depth failure was
  observed. The shared normalization fix keeps the full typed input visible but
  trims/caps server search variables to 128 characters; a subsequent clean run
  is required, rather than treating this API validation failure as a pass.

### Final verified production suite

`final-suite/` is the authoritative final evidence from the latest shared source
(including the final skeleton padding adjustment and long-query normalization).

| Gate                               | Result                                      | Evidence                                       | UTC time                 |
| ---------------------------------- | ------------------------------------------- | ---------------------------------------------- | ------------------------ |
| `npm run build`                    | **PASS**, 12.3s, 0/3 cache hits             | `final-suite/build.log`                        | Immediately before suite |
| Ordinary production browser flow   | **PASS**, 8 checks, no page/API errors      | `final-suite/results.json`                     | 17:47:13–17:47:29        |
| Scheme ranking production flow     | **PASS**, 6 checks, including desktop/phone | `final-suite/scheme-ranking/results.json`      | 17:47:30–17:47:52        |
| Model autocomplete production flow | **PASS**, 3 checks, no page/API errors      | `final-suite/autocomplete-search/results.json` | 17:47:52–17:48:15        |

Both slow and quick typing measured **0px** maximum drift on all five targets:
dialog, field, input, Popper and listbox. Both recorded **zero** Loading
replacement and missing-listbox frames. Dropdown scroll reached **Audit model
064**, applied it to miniature Name and needed no external Load more button.
The exact **180-character** fast input remained visible, produced a normalized
**128-character** latest request, showed a settled empty state and recovered on
clear. Every template request used at most **48** rows (12 search/page requests
observed).

Raw geometry and network variables:
`final-suite/autocomplete-search/autocomplete-geometry.json`.
Screenshots: `autocomplete-{slow,quick}-initial.png`, slow per-keystroke images,
`autocomplete-{slow,quick}-settled.png`, `autocomplete-infinite-scroll.png` and
`autocomplete-long-typing.png` in that same directory.

The autocomplete phase deliberately has its own production invocation in the
root `e2e:browser` script and writes to the `autocomplete-search/` artifacts
subdirectory, so CI runs it without overwriting ordinary-flow evidence. An early
attempt to append its fixture setup directly to the already busy backup/SSE flow
hit the real **120 operations/minute** server limiter (`after-full/` and
`after-full-batched/` retained as failed setup evidence). No rate limit was
relaxed or bypassed: seed commands are batched at **three real mutation roots**
per operation, within production GraphQL budgets, and independent flow/server
lifetimes keep each test's operation budget isolated. `verified-full/` and
`verified-targeted/` are additional passing runs before the final suite.

## Final implementation and verification

- Every autocomplete declaration now uses `Components/StableAutocomplete.tsx`.
  Accepted search projections are retained by the scoped `useSearchResults` hook,
  not written back as fresh Apollo data. Exclusions still remove selected paints
  immediately. Scope changes and settled empty results do not expose old options.
- `SEARCH_DEBOUNCE_MS = 250` is the single server-search tuning constant. Server
  variables are normalized to the existing 128-character budget; displayed input
  is not truncated. Superseded search effects abort HTTP work and cannot publish
  late results; deliberate aborts do not create global error banners.
- The field permanently reserves a 20px indicator slot; a 16px spinner appears
  only after 300ms pending. First load has five fixed-height skeleton rows. No
  loading text replaces accepted options. Popup/listbox height is bounded and
  stable, placement is chosen once on opening, and result-count announcements are
  polite with `aria-busy` on pending listboxes.
- All five external autocomplete paging buttons above, plus the scheme-card
  picker button, are removed. Scrolling near the list bottom fetches the next
  bounded page and retains the viewport. Paint option endpoints remain bounded
  top-30 server searches over the whole catalog (they had no pagination control).
- The ordinary folder selects and plugin metadata selects are not asynchronous
  autocompletes. Existing page/detail Load more controls listed above remain.

Latest exact-source production verification is in
`paint-tracker-audit/autocomplete-shift/final-verified/`: ordinary browser flow
**8/8**, scheme ranking **6/6**, autocomplete **3/3**, no errors. Geometry remains
**0px** for all five targets in both typing modes, with zero missing-listbox or
loading-replacement frames. Request bounds remain 48 rows / 128 characters.
`gates/` contains passing logs for all nine local Quality gates plus
`notices:check`; Storybook passes **500/500** across 93 files. Unit tests also
exercise shared normalization/scroll thresholds and real template/scheme loader
cancellation without cache writes or global error notifications.

An unsigned worktree-only arm64 Electron package was built and exercised using
`e2e/native-smoke.mjs`, an isolated temporary desktop profile and disabled updates.
`native-final/run-*/results.json` records **5/5** native startup checks: actual
packaged identity, connection chooser, bundled server, owner creation/workbench,
and intentional exit code 0, with no renderer errors. This is startup smoke, not
a claim of exhaustive native picker UI testing. The installed application and
personal desktop vault were not accessed.

Hosted Quality CI was **not triggered**: the coordinator reported GitHub billing
blocked and explicitly instructed no pushes or reruns. The local branch is kept
for merge after green local gates; no hosted CI pass is claimed.
