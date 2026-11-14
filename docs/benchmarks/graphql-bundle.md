# Apollo foundation bundle measurement

Measured 2026-11-13 on pinned Node 22.22.2, final runtime source `0085494` (including the current unavailable/broken-substitution product rule and decimal-string Sequence cursors).

| Web build | Total emitted JS | Sum of per-file gzip | Entry JS |
| --- | ---: | ---: | ---: |
| Before Apollo work | 999,731 B | not retained exactly | 599,254 B |
| Final, internal flag off | 1,003,108 B | 335,480 B | 600,383 B |
| Same source, internal flag on | 1,194,030 B | 394,816 B | 600,526 B |
| **Flag-on minus flag-off** | **190,922 B** | **59,336 B** | **143 B** |

The isolated enablement cost includes Apollo, GraphQL/SSE client runtime and the internal debug UI, not just the Apollo npm package. The lazy `LibraryDebugPanel` chunk is 190,779 B / 59,295 B gzip. With the flag off it is absent entirely. Default-build growth versus the earlier baseline is 3,377 B total JS / 1,129 B entry, **including readiness/UI and Phase 0 changes**, so do not attribute that entire difference to Apollo.

These are emitted `.js` bytes, not initial transfer, disk install size, memory or parsing/rendering time. Gzip uses Node's default level 6, independently per file; CSS, fonts, maps and images are excluded. Raw final measurements and file inventory are in [graphql-bundle.json](graphql-bundle.json). The earlier baseline came from the pre-Apollo build log, not a reconstruction of a different historical checkout.

## Reproduce

From the repository root, with pinned Node on PATH and no concurrent builds writing the default output:

```sh
npm run build --workspace paintwarden-web
flagdir=$(mktemp -d /tmp/paintwarden-graphql-bundle-XXXXXX)
VITE_GRAPHQL_LIBRARY_DEBUG=true npm run build --workspace paintwarden-web -- --outDir "$flagdir" --emptyOutDir
node scripts/measure-web-bundle.mjs apps/paintwarden-web/dist "$flagdir"
```

`--emptyOutDir` matters for an out-of-project build: Vite otherwise retains old hashed chunks and a directory sum overcounts them. The measurement script rejects multiple web entry files, with regression coverage in `scripts/measure-web-bundle.test.mjs`.
