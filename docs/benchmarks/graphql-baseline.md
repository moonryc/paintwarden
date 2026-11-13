# GraphQL migration baseline (Phase 0)

Measured 2026-11-13, pinned Node 22.22.2 on the development Mac. These are invented fixtures, not copies of the owner's vault. `large` is the supported-scale baseline; `stress` is deliberately beyond the supported scale.

| Profile | Paints | Miniatures | Schemes | Templates | Full snapshot JSON | Snapshot SQL | Snapshot median | JSON parse median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Large | 4,500 | 1,500 | 300 | 500 | 6,518,884 B | 19 | 31.95 ms | 8.82 ms |
| Stress | 30,000 | 10,000 | 3,000 | 5,000 | 44,954,964 B | 19 | 256.01 ms | 72.68 ms |

A plugin-sized invented catalog accounts for 96% of paints; the remaining 4% are `user:` paints. Twelve brands, five ranges, varied colors/stock, ten requirement rows per miniature, attached schemes, eight paints per scheme, and ten recipe rows per template exercise more than bare catalog loading. Catalog-source ownership is recorded in SQLite without downloading anything. Template summaries are measured separately because their shared cache is loaded by consumers, not a universal initial request: 133,456 B / 5 SQL / 3.31 ms large; 1,338,956 B / 5 SQL / 29.72 ms stress. Lazy template recipes are not included in startup bytes.

## Reproduce

From the repository root with pinned Node on PATH:

```sh
cd apps/paint-vault
BENCH_REPORT=../../docs/benchmarks/graphql-baseline-large.json node --import tsx ../../scripts/benchmark-startup.mts large
BENCH_REPORT=../../docs/benchmarks/graphql-baseline-stress.json node --import tsx ../../scripts/benchmark-startup.mts stress
```

The harness **always overrides `DATA_DIR` with a fresh retained temp directory and removes `DATABASE_PATH` before importing database code**. It never opens an existing vault. Reports contain the retained fixture paths. Each profile is a separate process/database. Raw reports are checked in beside this document, including gzip sizes, first-read measurements, min/max timings and SQL counts.

## Measurement contract and limitations

- Snapshot timing includes `vaultSnapshot()` and `JSON.stringify`, not HTTP/auth/compression or browser rendering. One first read, one warmup, eleven measured samples. Median/min/max reported. The first read is **not cold disk**: the process just seeded the fixture. Parse timings are eleven separate `JSON.parse` samples.
- SQL counts count executed prepared-statement methods, including Drizzle's `.raw(true).all()` chain, not just calls to `prepare`. Transaction `BEGIN`/`COMMIT` issued by the library are excluded. No catalog-size-dependent N+1 exists in this snapshot path.
- Snapshot JSON is the current universal data payload. It excludes shell JavaScript/fonts, authentication/version checks and images. Snapshot-plus-template-summary bytes are reported separately, not claimed as every screen's startup transfer.
- Gzip is a size-only measurement. Synthetic repeated text compresses unusually well. This is not remote latency, event-loop-delay, React parse/render, Electron proxy or native UI verification.
- The Phase 1 Library experiment intentionally exposes **raw inventory only**, not complete Library behavior/facets/substitution availability; legacy screens remain on the snapshot. Its bounded query is not a replacement-screen parity benchmark. Later phases must compare whole-screen aggregates, cold derived-index rebuilds, final-row reachability and visible startup transfers separately.
- The earlier unmerged spike's 41,984,036 B stress fixture differs in stock/text/source distribution from this reproducible fixture. Do not compare different fixture bytes as an implementation regression.
