# Packaged miniature drawer performance

## Reproduce

Use pinned Node 22.22.2 on Apple Silicon. Build the production web/server and
package with electron-builder (`npm run build`, `node scripts/package-desktop-server.mjs electron`,
`npm run dist --workspace paintwarden-electron -- --dir --publish never`).

Run `node scripts/profile-drawer.mjs outputs/drawer-seed` once to create a
throwaway owner/vault. It prints the synthetic desktop profile directory and
writes it to `outputs/drawer-seed/profile.txt`. Then run:

```sh
DRAWER_PROFILE="$(cat outputs/drawer-seed/profile.txt)" \
DRAWER_FRESH_CODE_CACHE=1 \
node scripts/profile-drawer.mjs outputs/drawer-measured
```

Optional `DRAWER_EXECUTABLE` selects a different packaged binary;
`DRAWER_INTENT=1` tests pointer-intent prefetch before clicking. Cache clearing is
restricted to this harness's synthetic temp profiles. Never supply a personal
profile. The harness never launches the development Electron executable or uses
a developer's server/data directory. Windows are positioned offscreen, renderer
background throttling is disabled, and Chromium background/occlusion throttling
is disabled to keep frame measurements meaningful. No production hidden-mode
switch is introduced by this change.

Each measured invocation starts a new packaged app process, opens the heavy
miniature once without hover/pointerdown, then reopens it three times. Fixture:
60 miniatures, seven photographed heavy miniatures, nine attached schemes with
36 mixed scheme entries, 30 manual recipe rows, and a synthetic 1600×1200 JPEG.
The persisted vault/session is reused; JS/HTTP/GPU disk caches are cleared before
each measured launch. This is cold renderer/code-cache behavior, not an OS disk
cache flush. The computer also had other work running; these are sample timings,
not a universal latency guarantee.

## Results (2026-11-15, macOS arm64)

Three fresh launches per version, nine warm reopens per version. Before is
`c3cd888`, with only the same opt-in render timing hook added. Production React,
not a profiling/development React build.

| Metric (median, ms) | Before cold | After cold | Before warm | After warm |
| --- | ---: | ---: | ---: | ---: |
| Shell inserted | 21.1 | 22.1 | 14.3 | 28.7 |
| First intersecting drawer frame | 40.6 | 22.5 | 48.7 | 29.2 |
| Full detail painted | 250.1 | 72.8 | 150.6 | 34.7 |
| Detail + photo ready + drawer settled | 258.0 | 89.5 | 178.0 | 47.3 |
| Renderer main-thread task CPU | 113.5 | 66.7 | 58.7 | 31.1 |
| Electron main-process CPU | 46.5 | 10.1 | 34.4 | 4.0 |
| GraphQL requests per open | 10 | 1 | 10 | 0 |
| Drawer boundary commits | 3 | 2 | 3 | 1 |

After cold: visible 17.3–68.7 ms; full detail 71.3–141.2 ms; complete including
photo/frame 78.7–153.7 ms. After warm: full detail 28.3–81.7 ms; complete including
photo/frame 38.8–97.4 ms. Before cold full detail 218.1–296.6 ms; before warm
93.4–355.5 ms. Long tasks: before 1 cold + 3 warm tasks (60–76 ms), after none in
these repeated samples. Earlier single offscreen measurements varied much more
before disabling occlusion throttling; they are not mixed into this table.

Intent-prefetched first open: shell 45.5 ms, complete 57.1 ms, no click-time
GraphQL request (one request during pointer intent), no long task.

The timing hook measures component render-start → layout commit, **not inclusive
React CPU time**; nested shell/content measurements overlap. Warm boundary
render→commit measurements after the change were 1.3–2.2 ms (one shell and one
content measurement in the same commit). Cold content measurements were
21.2–26.3 ms. Raw JSON includes every boundary measurement, request waterfall,
long task, CDP renderer CPU counter delta and Electron process CPU snapshot.
Network resource timing for the custom native protocol is incomplete; Playwright
request/finished events provide the GraphQL waterfall instead. No drawer JS
chunk was requested during the measured click window: existing first-screen
idle preloading had already loaded it. The server was not the bottleneck.

## Changes and safeguards

- One flat bounded attached-entry connection instead of a serial request per
  scheme. Independent cursor streams finish before a revision is published.
  Large recipes still page fully; the generated-loader/HTTP regression covers
  45 schemes, 47 mixed entries in one scheme and 43 manual recipe rows.
- A vault-scope-local 12-entry LRU shares in-flight intent reads and complete
  accepted aggregates. Pointer enter/down/focus prefetches; reopening does not
  refetch. SSE changes, newer accepted paint revisions, resets, explicit retry
  and vault changes prevent stale reuse. Errors are not cached.
- Keep the same drawer frame/session owner across loading → loaded so the opening
  animation does not restart. The project-only lazy-import fallback is immediate;
  other dialog fallbacks retain their existing delay.
- Memoize derived recipe/scheme projections. Lazy-load Swatch Scan and secondary
  paint/scheme overlays only on use; the drawer chunk shrank from 80,554 to 60,482
  bytes (uncompressed), with Swatch Scan in a separate 19,429-byte chunk. The color
  index is still requested only when scanning is opened.
- Existing browser scans (desktop/phone, aggregate and ranking), full recipes,
  mutations, refetch retention and connection recovery are regression-tested.
  Responsive host changes preserve open scan/edit state above the host while
  resetting only its session-local pin canvas, as before.

A fresh install's first-ever empty-vault setup is intentionally not timed: the
reported task concerns opening a real populated miniature after app launch.
