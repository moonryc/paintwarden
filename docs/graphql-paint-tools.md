# Paint Tools projections

Paint compare and Recipe converter read Apollo projections only. Neither consumes
`State`, loads `/api/state`, nor reconstructs a partial snapshot from pages.

- Compare searches the scoped paint options and requests `paintRanking` for the
  selected paint. Ranking uses the existing core color comparison on the server;
  the client initially loads 30 matches and explicitly loads further pages.
- Converter reads the selected scheme's complete authored entries, then bounded
  owned-match previews for its original paints. Physical inventory (not effective
  availability through substitutions) defines candidates. Suggestions keep the
  existing same-type/85-percent threshold. A manually selected paint outside a
  preview is fetched by ID and checked for physical ownership.
- Ranking cursors bind paint ID, ownership mode, epoch, revision and offset. A
  changed revision restarts the loaded window; a foreign cursor is rejected.
- Reads use `no-cache`; only accepted complete windows enter Apollo. Conversion
  rows and selected-ID lookups must share one revision. Scheme/paint revision
  disagreement disables saving and refetches both projections.
- Changing a replacement retains the prior accepted rows and picker DOM during
  validation, preserving keyboard focus. Saving stays disabled until fresh data
  arrives. Failed saves leave the draft intact; the original scheme is unchanged.

The app shell uses REST only for access/session, source-management and binary
operations. Its REST refresh retires old Apollo read tickets and immediately
checks the invalidation cursor, including backup epoch replacement. Retained
legacy snapshot/row-delta modules are unreachable from the production import
graph and remain only for Phase 5 removal/testing. TanStack remains installed
for those isolated implementations/tests; Storybook uses its own fixture-only
complete snapshot adapter, not TanStack or runtime snapshot requests.
