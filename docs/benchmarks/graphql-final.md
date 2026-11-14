# Final GraphQL cutover — 2026-11-13

All production screens use bounded GraphQL reads, domain mutations and SSE family
invalidation. The universal snapshot, row-delta API, full-vault client store,
TanStack Query, old polling and debug/coexistence paths have been deleted. Auth,
backups, images, files, source operations and desktop transport retain their
supported REST/native boundaries. Local mode remains self-contained.

[Machine-readable final observations](graphql-final.json) ·
[original Phase 0 baseline](graphql-baseline.md) ·
[historical Apollo foundation bundle record](graphql-bundle.md)

## Migration summary

Invented fixtures are unchanged: large **4,500 paints / 1,500 miniatures / 300 schemes /
500 templates**; stress **30,000 / 10,000 / 3,000 / 5,000**. The seed loop was extracted
verbatim from the retired benchmark (SHA256
`68b74b3ba8addae069aad5d01466337f8540d8b3bf9d47d9ba987238c47b191b`).
No focused QA probe rows enter these measurements.

| Default launch, decoded API JSON                           |        Large |   30k stress |
| ---------------------------------------------------------- | -----------: | -----------: |
| Canonical Phase 0 snapshot alone                           |  6,518,884 B | 44,954,964 B |
| Phase 0 snapshot + separate template summaries             |  6,652,340 B | 46,293,920 B |
| Reconstructed pre-migration main launch, all API responses |  6,519,292 B | 44,955,371 B |
| Final launch, all API responses                            | **64,243 B** | **64,259 B** |
| Final GraphQL portion (plus 124 B auth)                    |     64,119 B |     64,135 B |
| Reduction against reconstructed all-API launch             |   **99.01%** |   **99.86%** |
| Loaded miniatures at end of final capture                  |           96 |           96 |

Final Home first requests 48 rows and prefetches 48 more. Counts are server totals,
not totals inferred from those 96 rows. The rest of the vault is loaded only when
its screen/detail is requested. These are decoded JSON bytes, **not compressed
wire transfer**, and exclude JS, images, fonts and the still-open SSE response.
The capture includes 800 ms after visible data to include automatic prefetch.

### Local browser timing and server RSS

Phase 0 recorded in-process snapshot read/serialization medians **31.95 / 256.01ms**
(and parse 8.82 / 72.68 ms), not browser launch. Those cannot be divided into the final
browser times to claim a speedup. Instead, a private archive of **pre-migration
main@ea86dd1** was built with its historical lockfile and measured anew, using the
same exact seed rows, pinned Node 22.22.2 and final browser harness conditions.
This is a **reconstruction**, not a replacement for the canonical Phase 0 report.
Fresh-connection cursor metadata accounts for the small 4/5-byte snapshot-size
variation from the canonical in-process run.

| Observation                                                |  Large before → final | Stress before → final |
| ---------------------------------------------------------- | --------------------: | --------------------: |
| Browser visible-data median (3 new server/browser samples) |   249.4 → **211.6ms** |   678.7 → **491.1ms** |
| Browser samples before                                     | 297.3 /247.9 /249.4ms | 693.8 /678.7 /676.7ms |
| Browser samples final                                      | 210.1 /297.1 /211.6ms | 457.2 /546.2 /491.1ms |
| Server RSS median after Home                               |       161.8 →163.0MiB |       391.0 →269.0MiB |
| Server RSS observed range before                           |        157.7–291.3MiB |        388.1–518.7MiB |
| Server RSS observed range final                            |        157.6–295.7MiB |        266.8–395.8MiB |

Timing uses the browser navigation-relative performance clock to the first real
miniature tile plus two animation frames. An injected MutationObserver avoids
including recorder body-parsing delay. Chromium viewport 1440×1000, local HTTP,
headless, sequential runs. The process/derived cache is new each launch; the
recently seeded disk is **not cold**. Three observations are not p95, an SLA,
a remote-network result, or evidence of an across-the-board speedup. RSS is not
heap, peak allocation or an attribution to GraphQL; V8/GC/JIT timing is visibly
noisy. No canonical Phase 0 RSS exists.

### First navigation payloads

Each screen starts in a new client context after Home on one warm server. Values
are completed API JSON in that screen's navigation window, **excluding Home**;
they include automatic prefetch/options loads. Before migration the snapshot was
already the prerequisite for every screen, with template summaries separate.
No per-screen before navigation timings were recorded in Phase 0.

| Screen          |     Large |    Stress |
| --------------- | --------: | --------: |
| Miniatures      |  64,217 B |  64,235 B |
| Paints          |  25,129 B |  25,152 B |
| Wishlist        | 101,870 B | 101,800 B |
| Schemes         |  90,059 B |  90,108 B |
| Templates       |  17,434 B |  17,480 B |
| Paint Tools     |  58,349 B |  58,392 B |
| Data & settings |      40 B |      40 B |
| Plugins         |   3,186 B |   2,640 B |

Plugins includes variable external update-availability metadata, not just fixture
rows. Network checks are deferred until this screen opens. Per-screen heading /
first-projection timings are retained in JSON but are single observations, not
whole-screen render or interaction-latency guarantees.

### Bundle cost: disclosed regression

Clean historical private archive **ea86dd1** versus final clean production build,
using the same checked bundle measurement tool. Raw bytes and sum of independent
per-file gzip sizes; all emitted JS is not the same as startup transfer.

| Bundle measure    |    Before |       Final | Change |
| ----------------- | --------: | ----------: | -----: |
| All emitted JS    | 998,224 B | 1,333,550 B | +33.6% |
| Per-file gzip sum | 334,242 B |   410,969 B | +23.0% |
| Vite entry JS     | 599,254 B |   866,743 B | +44.6% |
| Vite entry gzip   | 189,309 B |   242,003 B | +27.8% |

There is no debug chunk or TanStack dependency. Apollo, typed documents and the
migrated screen machinery increase JS despite legacy deletion. The historical
Phase 1 foundation record used a different baseline source and reports 999,731 B /
334,658 B gzip; it is retained, not relabelled as this reconstruction.

## Final verification

Root lint, typecheck, tests, build, format, codegen freshness and Storybook pass
(295/295 stories). Final targeted large/stress Chromium screens each 31 PASS,
zero FAIL; production Docker 33 PASS, zero FAIL; actual packaged macOS local and
remote 78 PASS, zero FAIL. Those inherited broad runners honestly retain PARTIAL /
NOT RUN labels for external repository update availability, full OS controls,
Windows and signing. Requested local demo install/remove is proven separately:
final browser 11/11, final Docker 11/11. Backup HTTP/UI merge/replace compares all 19
exported table sections and 3 image hashes, with account/session preservation.
Actual same-profile packaged Settings local→remote→local, normal sign-in,
retained connection, quit/relaunch and no vault bleed pass 8/8. Real independent
HTTP writers update mounted clients via SSE without reload. Two actual browser
contexts with separate owner sessions also pass bidirectional stock edits on both
exact large/stress fixtures (3/3 each, no navigation/reload between edits).

Final observations have zero unexpected GraphQL/HTTP/renderer errors. Browser /
Docker raw upload recordings retain successful 200 response-body inspector-cache
read diagnostics; status, independently exported full persistence, images and UI
assertions all pass. Prior failed attempts are preserved, not erased: a real
same-epoch SSE-reset command-acknowledgement race was fixed with separate strict
read and command-identity tickets and deterministic tests; final rebuilt checks
pass. Earlier harness page-completion/body-read failures, a fast Docker run hitting
the unchanged rate limiter, and one 240 s native tool deadline are also retained.

Docker, native and production web emitted JS/server/schema have identical byte
hashes (32 Docker files checked). Native's two web copies and source SDL match;
generated TS is compiled into the runtime, not read as TS. Actual packaged SSE and
SDL-dependent queries were exercised. Windows/signing are not established.

Full reports, screenshots, raw network/logs, manifests and unchanged-seed proof:
`paint-tracker-audit/graphql-phase-5.md` and `graphql-phase-5-evidence/` beside the
repository. The 30k fixture remains stress-only; supported scale remains a few
thousand paints and roughly 1–2k miniatures. No new authoring caps or remote-offline
replica were introduced.

## Reproduce safely

Use Node 22.22.2, temp fixtures only, and the migration worktree; never a personal
vault, main checkout, or an existing development server. Build first:

```sh
npm ci
npm run build
node scripts/benchmark-graphql-final.mjs large /absolute/evidence/large
node scripts/benchmark-graphql-final.mjs stress /absolute/evidence/stress
# Historical build is an explicit separately prepared private archive, not main:
node scripts/benchmark-graphql-before.mjs large /private/archive/ea86dd1 /absolute/evidence/before-large
node scripts/benchmark-graphql-before.mjs stress /private/archive/ea86dd1 /absolute/evidence/before-stress
node scripts/benchmark-miniatures-bundle.mts compare /private/archive/ea86dd1/apps/paintwarden-web/dist apps/paintwarden-web/dist /absolute/evidence/bundle.json
```

The historical archive uses `git archive ea86dd1 | tar -x -C PRIVATE_DIR`, its own
`npm ci`, `npm run build --workspace paintwarden-web`, then
`npm run build --workspace paintwarden`. No old endpoint implementation is kept in
current production source. See `scripts/graphql-phase5-README.md` for production
browser/Docker and same-profile native switching QA; broad screen runners remain
in `scripts/graphql-phase4-README.md`. Runners do not build/pull/mutate a live vault.
