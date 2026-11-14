# Phase 0 semantic acceptance coverage

These tests lock the existing per-screen rules in data-loading proposal §5 before
moving derivations to server read services. They exercise **real exported code**:
`packages/vault-ui/src/dom/utils/semantic-contract.test.mjs` bundles the production
screen helpers and core exports with esbuild, following the existing Home test
harness. The extracted helpers are called by Wishlist, Library, Schemes and paint
detail; the tests do not reimplement their filtering or relationship algorithms.
Fixtures are immutable and synthetic. No running server or real vault is required.

## Coverage matrix

In the table, **semantic** means `packages/vault-ui/src/dom/utils/semantic-contract.test.mjs`.
Other UI test paths are relative to that same directory.

| Contract                                                                                                                          | Executable coverage                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physical stock: OWNED, positive quantity, not EMPTY; LOW counts                                                                   | semantic: `physical stock requires…` (state × stock × quantity table, including untracked/null)                                                             |
| Library OWNED means effective availability; active substitution overrides owning the original                                     | semantic: `Library OWNED is effective availability…`; valid mix available with an untracked original, owned original unavailable with a missing replacement |
| Library explicit wishlist differs from shopping depletion; UNTRACKED excludes available/explicit wishlist                         | semantic: same test; includes explicit wishlist on an effectively available paint                                                                           |
| Nonempty Library search forces inventory ALL, whitespace-only does not                                                            | semantic: same test for OWNED/WISHLIST/UNTRACKED                                                                                                            |
| Shopping includes explicit wishlist, owned EMPTY and owned zero-quantity                                                          | semantic: `shopping includes explicit wishlist…`                                                                                                            |
| Associations cover owned and wishlisted miniatures; repeated manual/scheme targets count once per miniature/paint                 | semantic: same test, duplicated target across steps and attached scheme                                                                                     |
| Shopping brand groups alphabetical, custom under Custom; within group project count descending then name                          | semantic: same test, including a project-count vs alphabetical-name conflict and an equal-count tie                                                         |
| Missing-not-listed panel is global despite a selected shopping model; excludes owned/listed paints and unknown catalog references | semantic: `missing-not-listed is global…`                                                                                                                   |
| Just-bought rows remain editable in the page's retained map, without duplicate listed rows                                        | semantic: `just-bought shopping rows stay editable…`                                                                                                        |
| Manual effective targets dedupe, then append attached scheme targets in link/paint order                                          | semantic: `requirements dedupe manual targets…`                                                                                                             |
| Global defaults override legacy per-miniature choices, recurse, and dedupe leaves                                                 | semantic: same test; nested and shared leaf fixtures                                                                                                        |
| Substitution parts are ratios, not stock quantity consumption                                                                     | semantic: same test; 50–100 parts with one bottle per leaf remains available                                                                                |
| Editor keeps original repeated paints in different steps, notes/order and scheme target rows                                      | semantic: `editor rows retain repeated paints…`; frozen source rows unchanged after derivation                                                              |
| Paint-detail used-by means original effective targets, not transitive substitution ingredients                                    | semantic: `paint detail used-by means…`; includes direct attached-scheme usage                                                                              |
| Scheme selected paints are AND over distinct original targets, not replacement leaves                                             | semantic: `scheme uses-paints is AND…`                                                                                                                      |
| Scheme readiness facets ignore search but respect category/source/selected paints; category counts global                         | semantic: `scheme readiness facets ignore search…`; readiness classification itself is tested by the readiness suite                                        |
| Scheme display order stays category-label/name, uncategorized last, after literal and typo search                                 | semantic: `scheme display order is category label…`                                                                                                         |
| Scheme preview is last image by sortOrder, thumbnail preferred, full image fallback                                               | semantic: `scheme cards use last sortOrder image…`                                                                                                          |
| Complete ordered scheme names/gradient and usage count survive card summarization                                                 | semantic: same test, 24 paint rows supplied in reverse input order; no silent truncation                                                                    |
| Home/workbench global counts, ownership scope, searchable miniature fields and snapshot invalidation                              | `home-derivations.test.mjs`                                                                                                                                 |
| Empty project recipe is not ready                                                                                                 | `readiness-substitutions.test.mjs` / Home derivations (readiness-owned coverage)                                                                            |
| Broken empty/cyclic default and saved non-default substitutions                                                                   | `readiness-substitutions.test.mjs` and `packages/paint-core/paint-substitutions.test.ts` (separate Q3 change)                                               |

## Deliberate behavior decision: Q3

The old Library/Schemes versus miniature discrepancy for empty/cyclic substitutions
is **not** frozen by the semantic suite. The current approved rule supersedes the
earlier fallback decision: **an active broken substitution makes its paint unavailable,
even when its original is physically owned. There is no ownership fallback.**

- The active option is the global default substitution, otherwise the physical paint.
  Every ingredient uses its active option recursively. An empty active recipe is blocked.
- A direct self ingredient (`A = A + white`) means **physical A**, plus white; it is not
  a loop. Existing/imported self ingredients are evaluated this way; REST/UI creation
  validation remains unchanged.
- Longer loops block the closing-step **owner**. For `A → B → A`, root A records B as
  a blocked terminal requirement, and root B records A. Neither owning A nor B rescues
  the loop. The result is deterministic per root; only completed roots are cached.
- A valid ancestor (`A → broken B + red`) remains structurally valid, but unavailable B
  makes A unavailable even if A, B and red are owned. Broken branches must never be
  dropped from readiness totals. Every empty/cycle-member owner is flagged, not its
  valid ancestors. Saved non-default recipes are validated without changing active choices.
- Project paint issues preserve independent `missingStock` and `brokenSubstitution`
  reasons; a paint can have both. One paint still counts once in unavailable totals.
  Owned-but-broken requirements appear in project and Wishlist missing-not-listed
  panels with a red **Broken substitution** indicator and **Fix substitution** action,
  not as a bottle purchase. Stock-only/both-reason rows retain explicit wishlist actions.
- Shopping membership remains explicit wishlist plus depleted-owned inventory. Broken
  substitutions never add shopping rows automatically. Existing listed rows retain both
  issue reasons and project associations; model filters do not narrow the missing panel.
- Broken substitution chips use the existing red/error treatment. Paint detail explains
  `empty recipe` or `circular recipe` immediately above its substitutions button.

Executable coverage: `readiness-substitutions.test.mjs`, core substitution tests, and
focused stories for substitution chips, recipe/library rows, paint detail, saved recipes,
project paint summaries, missing-project paints and Wishlist rows.
The helper extraction otherwise preserves the existing rules, including current
locale-based display comparison and full card summaries. It does not introduce
cursor ordering, canonical collation or pagination behavior.

## Run and limits

Use the repository's Node version (`.nvmrc`, 22.22.2):

```sh
npm run test --workspace @paintwarden/ui
npm run test --workspace @paintwarden/core
npm run typecheck --workspace @paintwarden/ui
```

These are semantic unit tests, not visual/native UI acceptance. Placeholder
appearance, gradient rendering, image loading, responsive layout and all editor
interactions still require Storybook/browser or packaged desktop checks. No
GraphQL pagination/search envelope, unloaded-data behavior, network-request count,
or export completeness guarantee is implied by this Phase 0 matrix.
