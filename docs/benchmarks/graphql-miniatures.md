# Phase 3 Home / miniature projection measurements

Pinned Node 22.22.2, macOS arm64. These measurements cover the production default Home and Miniatures read projections, not removal of every remaining legacy screen or the final removal of TanStack Query.

## Method and scope

`scripts/benchmark-miniatures.mts` calls the **unchanged Phase 0 fixture generator** in a child process. Large has 4,500 paints / 1,500 miniatures / 300 schemes / 500 templates; stress has 30,000 / 10,000 / 3,000 / 5,000. Every run creates its own retained temporary DATA_DIR and clears DATABASE_PATH. It never opens a caller-supplied vault. Paint0 is mutated only after every original-fixture cold/warm scenario finishes; that retained fixture is therefore a post-stock evidence vault, not an unchanged snapshot.

The measured document is the actual production `MiniatureList` operation in `miniature-list.graphql`, selecting Home or Miniatures via `$workbench`, plus the actual `VaultNavigation` operation for the default launch sequence. Apollo's `addTypenameToDocument` transform is applied, unlike the older Phase 2 execute benchmark. Initial variables match the production first=48, no-search/no-stage path. The Miniatures ownership filter is ALL; Home owns its OWNED scope. Tile fields contain no full notes, recipes, catalog arrays or image bodies. Image URLs and bounded color previews remain part of JSON. The Home response assertion uses **100,000 bytes**, not the looser 100 KiB.

Each cold scenario has **11 independent fresh Node processes**, resetting derived paint/miniature caches. The clock starts after imports, not at process spawn. This is **cold derived cache, not cold disk**: the fixture has just been seeded and OS/SQLite page caches are warm. Home-only and Miniatures-only first reads are independent. The launch scenario executes navigation then Home in one process; it sums operation time/SQL/JSON bytes and reports the **maximum per-operation** blocking observation, not a single uninterrupted startup block.

Warm variants use one warmup and 11 samples, including first=1/48/100, filters and search. The final Home worker then performs 11 stock writes through the shared production stock command. Each first post-write Home read must build the aggregate exactly once; subsequent Miniatures and Home reads at that revision must reuse it. Writes are timed separately from the rebuild, and each read's revision/count coherence is checked. Same-generation read reuse does not make a rebuild cheap: the conservative whole-vault generation invalidates the full paint/requirement projection on each durable write.

SQL instruments actual `.all/.get/.run/.iterate` calls, including raw Drizzle chains; transaction-helper BEGIN/COMMIT and trigger-internal statements are excluded. `setImmediate` measures operation-induced synchronous blocking; it is **not a production event-loop-delay histogram**. Gzip uses independent Node default level-6 compression and is not timed. Eleven-sample p95 is the maximum observation. The shared host may run other verification concurrently; no post-hoc latency release gate is implied.

**In-process measurements exclude HTTP, authorization, request parsing/validation, TCP, browser JavaScript/React, Electron and unrelated startup requests.** Response sizes are uncompressed JSON bytes, not TCP transfer. The navigation+Home total is only those two projection documents; actual browser startup traffic is reported separately. Phase 0 snapshot serialization and parse timings are in-process too, but its first-read/warm methodology differs from the new independent-process cold samples. Do not turn that comparison into a measured browser speedup or compare cold and warm latency as if equivalent.

A runtime SHA-256 manifest covers server GraphQL/lib/db and core sources plus both client documents. The harness rejects changes during sampling, preventing mixed-source results. Raw samples retain SQL counts, block times, bytes, gzip sizes, initial cardinalities and per-generation cache diagnostics.

## Results

Final stable-source runs: **2026-11-13 19:15–19:16 UTC**. Both profiles have the same runtime manifest SHA-256 `eebf5ba40bf8c69135ea08e5f60d60d222da5a6adf67dadc27981a255c209de1`. The working branch was based on `e1f345a` with the Phase 3 changes present; the manifest, not that unchanged Git HEAD alone, identifies these runtime sources. Raw results: [large](graphql-miniatures-large.json), [stress](graphql-miniatures-stress.json).

### Payload and Phase 0 comparison

| Measurement | Large | Stress |
| --- | ---: | ---: |
| Phase 0 full snapshot JSON | 6,518,884 B | 44,954,964 B |
| Current same-fixture snapshot JSON / SQL | 6,518,884 B / 19 | 44,954,964 B / 19 |
| Phase 0 warm snapshot serialize median / parse median | 31.95 / 8.82 ms | 256.01 / 72.68 ms |
| Current same-fixture warm snapshot serialize / parse median | 29.95 / 8.50 ms | 237.49 / 73.63 ms |
| Apollo-shaped Home, 48 tiles, JSON | 31,958 B | 31,965 B |
| Apollo-shaped Miniatures, 48 tiles, JSON | 32,107 B | 32,116 B |
| Navigation + Home JSON sum | 32,161 B | 32,170 B |
| Home owned total / initially loaded | 1,200 / 48 | 8,000 / 48 |
| Miniatures total / initially loaded | 1,500 / 48 | 10,000 / 48 |
| Home JSON reduction vs Phase 0 snapshot | 99.51% | 99.93% |

Snapshot bytes and SQL are unchanged; timing variance is not evidence of a snapshot improvement. The new Home remains below 100 KB even with Apollo `__typename`, while retaining global counts for the entire owned collection. The synthetic fixture has no ready miniatures: each has at least one missing requirement. Full original recipe data is not part of the tile response.

### In-process latency, SQL and blocking

All median/p95 pairs below have n=11. Cold means derived cache only, as defined above.

| Measurement | Large | Stress |
| --- | ---: | ---: |
| Home cold execute+serialize median / p95 | 55.33 / 73.76 ms | 322.86 / 369.88 ms |
| Home cold blocking median / p95 | 56.40 / 73.83 ms | 322.94 / 369.95 ms |
| Home warm execute+serialize median / p95 | 0.66 / 1.40 ms | 0.65 / 1.04 ms |
| Home cold / warm SQL executions | 12 / 2 | 12 / 2 |
| Miniatures cold execute+serialize median / p95 | 53.13 / 60.57 ms | 324.99 / 374.71 ms |
| Miniatures cold blocking median / p95 | 54.02 / 61.57 ms | 325.07 / 374.78 ms |
| Miniatures warm execute+serialize median / p95 | 0.71 / 1.54 ms | 0.76 / 1.02 ms |
| Miniatures cold / warm SQL executions | 12 / 2 | 12 / 2 |
| Navigation → Home sum cold execute+serialize median / p95 | 63.69 / 65.70 ms | 315.36 / 326.67 ms |
| Navigation → Home sum cold blocking median / p95 (max per operation) | 41.94 / 44.44 ms | 177.95 / 184.51 ms |
| Navigation → Home sum warm execute+serialize median / p95 | 0.54 / 1.12 ms | 0.64 / 1.11 ms |
| Navigation → Home sum cold / warm SQL executions | 14 / 4 | 14 / 4 |
| Home warm blocking median / p95 | 0.68 / 3.76 ms | 0.67 / 2.50 ms |
| Home post-stock rebuild execute+serialize median / p95 | 34.89 / 49.20 ms | 286.47 / 316.96 ms |
| Home post-stock blocking median / p95 | 35.63 / 51.22 ms | 286.94 / 317.01 ms |
| Home post-stock rebuild / subsequent read SQL | 12 / 2 | 12 / 2 |

Home first=1/48/100 warm variants all retain **two SQL executions**, as do warm Miniatures filters/search. Each of the eleven stock revisions rebuilds once, followed by same-generation reuse. The stress rebuild remains a synchronous full-domain operation with a roughly 317 ms observed blocking p95: this migration reduces startup payload and repeated read cost; it does **not** eliminate cold/revision rebuild blocking. These values cannot be substituted for browser render/startup timings.

### Browser evidence (separate measurement layer)

Actual Chromium against the revised final production build, pinned Node 22.22.2, random loopback ports and fresh fixture/auth sessions: **10 PASS / 0 FAIL per profile**. These are **single illustrative observations, not browser median/p95 measurements**. The browser fixture starts from the Phase 0 seed and adds **360 focused smoke miniatures**, paints and a scheme; it is **not the unchanged benchmark fixture**. The newest focused tiles have fewer swatches, so browser JSON sizes below are not interchangeable with the execute table.

| Browser observation | Large | Stress |
| --- | ---: | ---: |
| Owned total / initially loaded (includes prefetch) | 1,489 / 96 | 8,289 / 96 |
| First Home response, 48 tiles | 11,952 B | 11,959 B |
| Two Home responses / 96 tiles, JSON sum | 23,798 B | 23,812 B |
| All completed initial API JSON bodies | 24,329 B | 24,345 B |
| Default document → visible rows, two frames + recorder settlement | 293.74 ms | 973.09 ms |
| Independent stock → observed readiness refresh | 430.25 ms | 518.82 ms |
| Three-page loaded-window refresh JSON sum | 35,641 B | 35,662 B |

The initial completed-body total includes auth status (124 B), catalog sources (204 B), navigation (203 / 205 B), and two bounded Home reads. It excludes open SSE frame bytes, JS/CSS/fonts/images and other incomplete responses; it is not total network transfer. The UI auto-prefetches a second page at this viewport. Each first-response Home body remains well under 100 KB. Default-document time includes document/assets/data/React, two frames and harness recorder settlement; it is not pure server or render time. SSE observations include the server's polling cadence, so they are not a direct rebuild benchmark.

Both profiles have zero `/api/state`, no renderer/GraphQL errors, loaded-window readiness updates from an independent client, stage/ownership/search behavior, virtualized final-item reachability across more than five pages, keyboard boundary/open/dismiss behavior, persistent detail/status and scheme attach/detach, and a physically owned empty active substitution remaining red/broken. Named checks group related assertions; this is not a full native/app-controls sweep. All **29 measured JS/index asset hashes** independently match the revised browser artifact records in both profiles.

Derived metrics/provenance: [graphql-miniatures-browser.json](graphql-miniatures-browser.json). Full accepted reports/checks/screenshots are in the external audit's `browser/final/{large,stress}-results.json`; superseded fully passing pre-picker browser artifacts remain in `browser/pre-picker-parity/`, and earlier failed attempts are separately retained. They are not the revised final acceptance results. Phase 0 did not retain a comparable browser render baseline, so **no before/after browser speedup** is claimed. Native/Docker evidence is owned and reported by the separate smoke harness, not inferred from these browser results.

### Bundle delta versus Phase 2

Clean archived Phase 2 `e1f345a` versus the coordinator's final uncached production web build, without the internal debug flag:

| Build | Emitted JS | Sum per-file gzip | Entry JS | Entry gzip |
| --- | ---: | ---: | ---: | ---: |
| Phase 2 | 1,229,603 B | 401,980 B | 807,692 B | 249,759 B |
| Phase 3 | 1,291,985 B | 413,247 B | 844,588 B | 252,001 B |
| Delta | +62,382 B | +11,267 B | +36,896 B | +2,242 B |

The clean Phase 2 reconstruction exactly matches the retained Phase 2 totals. This delta includes the production Home/list/detail/editor projections and coexistence changes, **not Apollo's isolated package cost**. Raw inventory plus per-file SHA-256: [graphql-miniatures-bundle.json](graphql-miniatures-bundle.json). The candidate JS/index manifest SHA-256 is `7e7c2407e19f0a4d06c3c08ab4ea70b9e6c15f4ae1fc800f3dac3aab6a33305f`. No additional shared build was run for this comparison.

### Verification and retained evidence

- Both full fixture runs pass all source-stability, payload bounds, collection cardinality and post-stock generation reuse assertions.
- The existing bundle measurement regression tests pass **2/2**, including rejection of stale hashed entry output.
- Persistent audit directory: sibling `paint-tracker-audit/graphql-phase-3-evidence/metrics/`. It contains accepted raw reports/logs, Phase 2 reconstruction metadata/build log and final bundle inventory. `preliminary/` retains earlier measurements; two later attempts were rejected on source-hash changes and produced no accepted report. Preliminary numbers are not final acceptance results. `superseded-1906/` retains the earlier accepted measurements and browser summary before the final picker parity correction; the tables above use the fresh guarded reruns.
- Fixture paths and runtime manifests are recorded in each JSON report; fixtures are retained. Only child processes launched by these synchronous harnesses ran; each database was closed. No personal vault or existing server was touched.


## Reproduce

From the repository root with pinned Node on PATH:

```sh
node --import tsx scripts/benchmark-miniatures.mts large /tmp/miniatures-large.json
node --import tsx scripts/benchmark-miniatures.mts stress /tmp/miniatures-stress.json

# Can run while shared UI edits continue: clean Phase 2 archive, isolated outputs.
node --import tsx scripts/benchmark-miniatures-bundle.mts baseline /tmp/miniatures-bundle
# Read /tmp/miniatures-bundle/phase2-baseline.json for the retained baseline dist.

# Coordinate this normal candidate build with other build/browser owners first.
npm run build --workspace paintwarden-web
node --import tsx scripts/benchmark-miniatures-bundle.mts compare \
  /path/from/phase2-baseline.json/dist apps/paintwarden-web/dist /tmp/miniatures-bundle.json
node --test scripts/measure-web-bundle.test.mjs

# Actual browser observations, separate from in-process n11 measurements:
node scripts/smoke-home-miniatures-browser.mjs /tmp/miniatures-browser-large --profile large --run
node scripts/smoke-home-miniatures-browser.mjs /tmp/miniatures-browser-stress --profile stress --run
```

The baseline is clean archived **Phase 2 `e1f345a`**, not the pre-Apollo Phase 0–1 build. Archived local workspaces resolve to archived sources; only immutable external dependencies are linked. Build scratch/output directories are isolated, and the internal debug flag is unset. The measurement helper rejects stale multiple-entry outputs. Bundle totals cover emitted JavaScript and the sum of per-file gzip sizes only: **not initial network transfer, parsing cost, installed application size, CSS/fonts/images or server bundle size**. No main checkout/ref, running dev server, user vault or existing personal volume is changed.
