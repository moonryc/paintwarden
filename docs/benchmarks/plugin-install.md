# Atomic plugin install benchmark

Synthetic only: 3,000 paints, 300 schemes, 500 templates, 800 procedural textured
1280×960 JPEGs (151,740,177 original image bytes), 152,747,874-byte stored ZIP.
No manufacturer catalogs, prepared catalogs or personal vaults were used.

macOS arm64, Apple M4 Pro, pinned Node 22.22.2. The baseline is `f4d2f54`;
measurements use separate empty temporary vaults, identical archive bytes and
wall-clock stage boundaries. One sample per case; filesystem warmth/load is not
controlled. These are observations, not latency guarantees or a network benchmark.
Raw portable measurements: [plugin-install.json](plugin-install.json).

| Stage | Before (ms) | After (ms) |
| --- | ---: | ---: |
| Reading | 18.40 | 13.44 |
| Checking | 12.22 | 12.40 |
| Images | 15,838.49 | 13,128.28 |
| Preparing data | included below | 8.91 |
| Committing and final cleanup | 571.99 | 331.46 |
| Total | 16,441.91 | 13,494.49 |

Observed total improvement: 17.9%. Images remain the dominant cost; all 800
originals and all 2,400 responsive thumbnails are still generated. Four bounded
asset workers share two thumbnail decoders. ZIP entries are read/inflated lazily,
uploads spool to a bounded private file, and unchanged image hashes reuse verified
local originals/derivatives without reading or decoding those ZIP entries.

The commit-stage measurement includes 3,200 synchronous image renames, SQLite
writes, reference-safe old-image cleanup and private staging disposal. Its maximum
observed event-loop gap was 317.84ms. This short critical section is deliberately
not cancellable; the 13-second image stage has no write transaction or global image
mutation lock. Row statements/250-row chunks are prepared before the transaction.
The baseline's row preparation was included in its commit measurement, so this is
not a pure SQLite execution comparison.

Installing version 1.0.1 with the same image hashes took **91.72ms** (images 7.70ms,
preparing 26.43ms, committing/cleanup 45.87ms; max event-loop gap 46.34ms).
Reinstalling the same version, which only refreshes optional logo metadata, took
**2.43ms**, max gap 1.23ms. No image files were added in either case.

## Reproduce the new pipeline

From the repository root, with the pinned Node selected:

```sh
node scripts/synthetic-plugin.mjs /tmp/paintwarden-synthetic-large.zip
node --import tsx scripts/profile-plugin-install.mjs \
  /tmp/paintwarden-synthetic-large.zip /tmp/paintwarden-install-profile.json
```

The profiler refuses anything except the generated synthetic manifest, creates a
new temporary vault itself, records initial install/new-version image reuse/
same-version refresh, and reports its location for inspection. Neither command
reads the application's normal `data/`. Generated archives/vaults are not tracked.

The production browser and packaged Mac acceptance flow uses the same archive at
1440px and 390px, saving a miniature while real images are processed, reloading,
cancelling halfway (zero plugin rows/images), then reinstalling to completion.
A separately authenticated browser client sees zero sources halfway and exactly
one committed `SOURCES` invalidation on success. See the optional runners:

```sh
node e2e/plugin-install-smoke.mjs --width 390 \
  --zip /tmp/paintwarden-synthetic-large.zip --artifacts /tmp/plugin-browser
node e2e/native-smoke.mjs --plugin-width 390 \
  --plugin-zip /tmp/paintwarden-synthetic-large.zip --artifacts /tmp/plugin-native
```

The browser runner requires `npm run build`; the native runner requires actual
`electron-builder --dir` output, never Electron's development app.
