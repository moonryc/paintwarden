# Phase 2 Library measurements and isolated smoke

Measured November 13, 2026 on macOS arm64, pinned Node 22.22.2. Performance samples use runtime source `1d1d666`; final rebuilt artifact smoke uses `ee83588`. This is the Library vertical slice, **not removal of the snapshot from other screens**. The default Workbench still loads the legacy snapshot; `/#paints` is the direct Library startup used below.

## Same Phase 0 fixture, complete Library document

`scripts/benchmark-library.mts` invokes the **unchanged** Phase 0 generator in a child process, which always creates its own retained synthetic vault. No existing vault is accepted. Large is 4,500 paints / 1,500 miniatures / 300 schemes / 500 templates; stress is 30,000 / 10,000 / 3,000 / 5,000. The Library operation includes inventory, availability, broken-substitution state, source metadata, all counts and all facets, not just raw rows.

| Measurement                                           |            Large |             Stress |
| ----------------------------------------------------- | ---------------: | -----------------: |
| Phase 0 full snapshot JSON                            |      6,518,884 B |       44,954,964 B |
| Current full snapshot JSON / SQL                      | 6,518,884 B / 19 |  44,954,964 B / 19 |
| Current snapshot serialize median / JSON parse median |  30.38 / 8.56 ms |  232.80 / 71.80 ms |
| GraphQL `ALL`, 48 rows, execute JSON                  |         20,137 B |           20,160 B |
| GraphQL `ALL`, 100 rows, execute JSON                 |         40,333 B |           40,271 B |
| Cold-derived-cache 48-row median / p95                | 30.58 / 33.32 ms | 146.56 / 171.83 ms |
| Cold SQL executions                                   |                6 |                  6 |
| Warm 48-row median / SQL                              |      0.96 ms / 2 |        4.31 ms / 2 |
| Warm search median / SQL                              |      0.52 ms / 2 |        2.37 ms / 2 |
| After stock invalidation, one rebuild / SQL           |     18.14 ms / 6 |      112.15 ms / 6 |
| Cold synchronous event-loop block p95                 |         33.37 ms |          171.89 ms |

Method: execute the actual production `LibraryPage` document through the production GraphQL schema, plus JSON serialization. Eleven independent processes provide first-operation samples; each cache is empty but **OS/SQLite disk caches are not cold**. Warm results use one warmup and eleven samples. Actual statement methods are instrumented, including raw Drizzle `.all()` chains; library transaction-helper BEGIN/COMMIT are excluded. Both first=1 and first=100 retain two warm SQL executions. The first cache build reads four paint-domain tables/joins; a revision invalidates that full derived cache. Warm work and cold rebuild work are distinct. The setImmediate observation is synchronous blocking, **not a production event-loop-delay histogram**. In-process execution excludes HTTP/auth/browser/Electron, and omits Apollo-added `__typename` fields. Eleven-sample p95 is the largest sample. No numerical latency release gate was invented after observing the results.

Snapshot bytes and SQL are unchanged; timing variance does not establish a snapshot speedup. Raw timing, gzip-size and SQL samples: `graphql-library-{large,stress}.json`. Phase 0 had no comparable browser render baseline, so the table below is not a measured before/after React speedup.

## Real browser, default OWNED filter

Fresh Chromium contexts, hostname `phase2-library.localhost` mapped only inside the test browser, fresh fixture DATA_DIR, random loopback server ports. These are **single illustrative end-to-end samples**, not p50/p95 browser benchmarks. Initial time ends after the bounded rows appear and two animation frames; it includes document/JS/fonts/auth/data/React. Warm-document time uses a new document/React tree and warm server/browser caches.

| Observed response/action                                  |                Large |               Stress |
| --------------------------------------------------------- | -------------------: | -------------------: |
| Default OWNED total / first loaded                        |           2,338 / 48 |          15,585 / 48 |
| Actual Apollo first Library response                      |             25,129 B |             25,152 B |
| Other initial JSON: auth / catalog sources                |          124 / 204 B |          124 / 204 B |
| Initial document → rows + two frames                      |            951.62 ms |            976.62 ms |
| Warm document → rows + two frames                         |            909.79 ms |            854.86 ms |
| Stock mutation response / action                          |    493 B / 116.12 ms |    493 B / 201.05 ms |
| SSE refresh, two loaded pages, JSON sum / observed update | 50,398 B / 315.27 ms | 50,271 B / 466.18 ms |
| Broken-paint search response                              |              2,760 B |              2,778 B |
| Broken-paint details response                             |              2,064 B |              2,162 B |

Apollo includes `__typename`; the browser starts with OWNED whereas the execute benchmark starts with ALL. Do not conflate their byte counts. JSON sizes are uncompressed response bodies, not TCP transfer. SSE frame bytes, shell JS/fonts/CSS and images are not included in the JSON totals. The server checks changes about once per second, so observed update latency varies with that cycle. Search/detail samples deliberately use one imported empty active recipe on a physically owned paint, injected only **after** the initial unmodified-fixture measurements. REST rejects creating an empty recipe; the harness injects imported corruption into its new fixture and publishes an ordinary stock revision afterward.

Both profiles at `1d1d666`: **7 PASS / 0 FAIL**. These table samples and raw browser data are preserved under `browser/runtime-1d1d666/`. Final `ee83588` repeats the full large scenario: **7 PASS / 0 FAIL**, with 933.36 ms initial document, 932.63 ms warm document, 257.22 ms stock and 950.21 ms independent-update samples; response sizes are unchanged. Stress was not rerun after the validation-only change. Checks cover no initial `/api/state`, bounded production requests, visible stock command, independent HTTP-session stock update, coherent refresh of both loaded pages with exact scroll preservation, actual legacy Home render then return with consistent stock, fresh Library document, red broken chip/details warning, and no renderer page errors. Some named checks group closely related assertions. This is not all-screen or all-control QA. Browser final evidence and stable open-modal screenshots live in the sibling audit folder `graphql-phase-2-evidence/browser/final/`.

## Packaged macOS and Docker

Actual unsigned macOS app: `/tmp/paintwarden-graphql-phase2-release-7fPpcD/mac-arm64/Paintwarden.app`. Updates disabled. Each local/remote run uses a fresh absolute `PAINTWARDEN_DESKTOP_DATA_DIR`; remote uses the bundled Node/server executable on another random loopback port with fresh data. Native fixture: 130 invented paints, all owned; **not large-vault native performance**.

Native checklist: **21 PASS, 1 PARTIAL, 1 NOT RUN, 0 FAIL**. Each mode additionally sends 101 actual paint IDs to the production picker and verifies none are returned and exactly 29 of the 130 fixture paints remain. Both local and remote exercise production Library without initial snapshot, visible stock edits, two-page SSE refresh/scroll, legacy Home and return, imported broken chip plus details warning, intentional quit, retained connection/owner relaunch and final intentional quit. Local's independent write uses a separate request through the production renderer proxy, not a distinct client/session: PARTIAL. Remote uses an independent Node HTTP bearer session: PASS. Full native controls, Windows executable, signing/notarization and distribution install: NOT RUN. Packaged resource hashes and timestamps are retained in `native/final/native-results.json`; the unchanged app host archive alone does not identify the renderer build. Every packaged web resource was independently matched to the final web build.

- `app.asar` SHA-256: `08a16536d79712d3b1d31f60e539b2c15fc6e4c8c510b6ea1105fcf2ba1c40c5`
- bundled server SHA-256: `e459f04588dd60f33eaa767e429eb0adbbb1076913be6c2a9761e3729563eb8d`

Final production Docker image `paintwarden:graphql-phase2`, immutable ID `sha256:6545ee40feb961cbec5567cc01f3b3c3324e083c49c8968ac3441854e2e8b9f9`: **8 PASS / 0 FAIL** on its own 130-paint fixture, including the shared browser Library scenario and owned-container cleanup. Fresh uniquely labelled volume retained; container removed. This is not Docker large-vault performance. No Compose defaults or user volumes were used.

Final `ee83588` removes the arbitrary 100-ID picker exclusion cap while keeping the existing 128 KiB request-body, 32 KiB operation, 256-character-per-ID and 30-result bounds. Native and Docker now include real 101-exclusion requests. The projection/client document and all 41 packaged renderer resources are unchanged, so the prior execute/stress/bundle measurements remain labelled `1d1d666`, not falsely remeasured. Final root build passed (unchanged web/site restored from Nx cache; changed server rebuilt), followed by fresh package and Docker builds. `verification/runtime-sources.json` records this split.

Only fixture processes started by these harnesses were stopped; no main checkout, running dev server, user session or vault was changed. Fixture data is retained. Earlier harness-selector/CDP metadata-read failures and preliminary runs remain separately retained; final results are under the `final/` directories, not inferred from builds.

## Bundle cost

Clean reconstructed Phase 0–1 source `1dd8ebe` versus final default production build (no internal debug flag):

| Build             |  Emitted JS | Sum per-file gzip |   Entry JS |
| ----------------- | ----------: | ----------------: | ---------: |
| Phase 0–1 default | 1,003,108 B |         335,480 B |  600,383 B |
| Phase 2 default   | 1,229,603 B |         401,980 B |  807,692 B |
| Delta             |  +226,495 B |         +66,500 B | +207,309 B |

The old default excluded Apollo entirely. Phase 2 includes the production Apollo/SSE/controller path eagerly and the real list/detail/editor code. This is total emitted JS and per-file gzip level 6, **not initial network transfer, install size or parsing cost**. Raw inventory: `graphql-library-bundle.json`. The reconstructed baseline exactly matches the retained Phase 0–1 totals. It was built from archived web/core/UI paths in a fresh temp tree with local workspace symlinks and shared immutable dependency links, never by changing main or the shared source tree.

## Reproduce

With pinned Node on PATH, from the repository root:

```sh
node --import tsx scripts/benchmark-library.mts large /tmp/library-large.json
node --import tsx scripts/benchmark-library.mts stress /tmp/library-stress.json
npm run build
node scripts/smoke-library-browser.mjs large /tmp/library-browser-large
node scripts/smoke-library-browser.mjs stress /tmp/library-browser-stress
node scripts/package-desktop-server.mjs electron
# Build an actual .app using the normal electron-builder package target, then:
node scripts/smoke-library-native.mjs /tmp/library-native --app '/path/Paintwarden.app' --run
# Build an explicitly named image first, then:
node scripts/smoke-library-docker.mjs /tmp/library-docker --image paintwarden:graphql-phase2 --run
node scripts/measure-web-bundle.mjs /path/clean-baseline-dist apps/paintwarden-web/dist
node --test scripts/library-smoke-support.test.mjs scripts/smoke-library-native.test.mjs
```

Native/Docker drivers default to honest NOT RUN plans unless `--run` is supplied. They never build or pull implicitly. The browser runner invokes the exported production `startServer`, waits for its listen promise before setup, and then runs with NODE_ENV=production; the temporary import guard prevents the module's automatic bootstrap from starting a second server. The traffic recorder never retains auth bodies/tokens and bounds CDP body reads across custom-protocol navigation; unavailable metadata is labelled, not treated as an app error. UI coexistence explicitly waits for the actual legacy Home content, not just HTTP 200.
