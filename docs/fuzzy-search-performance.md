# Bounded, asynchronous fuzzy search

Search retains the existing accent/punctuation normalization, literal-only shortcut,
substring position ranking, fuzzy scoring and original-row tie order. An explicit
result limit uses a worst-first heap instead of sorting every match. Edit distance
only computes the allowance band and rejects impossible lengths/rows early.

`createFuzzyIndex` pre-normalizes text/words once. `fuzzyFilter` also reuses indexes
by immutable array + stable text-selector identity (never mutate indexed items).
UI candidates are memoized on their table/filter dependencies. `useFuzzySearch`
does no matching in render, memo callbacks or MUI `filterOptions`: nonempty input
is debounced 80 ms, then a lazily created module worker indexes the table and
returns row positions. Later keystrokes send only query/limit/request ID. Empty
search returns the original ordered list immediately, without starting a worker.
Changed tables dispose the old worker; stale requests/results cannot replace the
current table's options. Worker-unavailable/failure fallback runs in a later timer
task with the same debounce and index reuse, not in input handlers or rendering.
The fallback may occupy the main thread on older embeds; normal web/Electron use
runs matching off-thread.

The paint catalog endpoint retains its database snapshot/index between reads.
Connection `total_changes()` and SQLite `data_version` invalidate on local or
external writes respectively, covering imports, cascades, restores and sources
without a TTL. This is conservative: unrelated local writes can also rebuild the
index. Reads within an existing transaction bypass the shared cache.

## Work limits

Untrusted text/query strings are truncated **before** Unicode normalization (and
again after expansion), bounding malicious imports and requests:

- First 128 UTF-16 code units of a query.
- First 16,384 UTF-16 code units of each searchable text (covers supported 10,000
  character miniature notes plus its name/metadata).
- First 16 normalized query tokens for fuzzy fallback.
- First 512 normalized words per item for fuzzy fallback. Literal phrase matching
  still checks the full bounded text before considering any fuzzy suggestions.

Content outside those limits is deliberately not considered. All normal name
searches retain their previous results. Text sent to workers is also capped,
without copying all raw oversized fields into messages.

## Reproducing the cheap synthetic benchmark

No vault data is read or written. From the repository root with `.nvmrc` Node:

```sh
node --experimental-strip-types scripts/benchmark-fuzzy-search.mjs 9b62cb5e42c62c1587aff785668878e8d295a6bf
```

Measured with Node **22.22.2**: 12,000 synthetic paints, six mixed literal, typo,
subsequence and no-match queries, top 40, median of five complete batches after
warm-up. Original: **326.70 ms/batch**; pre-indexed: **16.76 ms/batch** (~19.5x).
One-time index construction: **11.27 ms**. Every query's results are asserted equal
to the baseline. Timings are illustrative local CPU measurements, not UI latency
claims (the UI adds its intentional debounce).

Focused regressions cover randomized original-score/result equivalence and heap
ties, limits, index reuse, no render-time extraction, debouncing, stale replies,
disposal, fallback, changed tables, and SQLite local/external/rollback invalidation.
