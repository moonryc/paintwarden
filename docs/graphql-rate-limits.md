# Interactive GraphQL budgets and global notices

## Reproduction and root cause

The unsigned desktop beta can show a warning saying “The request could not be
completed. Please try again.” after rapid Model searches/navigation. It is not
an update-check error. The warning was the GraphQL provider's catch-up failure,
rendered **before** the shell whose fixed sidebar then covered its beginning.

Production Electron with a newly created, isolated `PAINTWARDEN_DESKTOP_DATA_DIR`
reproduced HTTP **429** on `VaultInvalidation` after ordinary query traffic used
the old shared **120 starts/minute** allowance. The HTTP transport discarded the
status when sanitizing its display message, turning throttling into
`REQUEST_FAILED`. A retained healthy SSE stream was unnecessarily supplemented
by focus/30-second `VaultInvalidation` reads. Switching Workbench/Miniatures also
remounted the same folder browser (`key={tab}`), fetching its identical tree again.
Rapid non-debounced Model searches are another consumer of that same allowance;
search debouncing/cancellation is an independent optimization, not a prerequisite
for this fix.

A packaged baseline navigation stress replay recorded **203 API responses**,
including **77 HTTP 429s**, with the final failed operation `VaultInvalidation`.
The fixed production native regression uses the real Model field (three search
terms, 160 characters total), 40 rapid Workbench/Miniatures switches and 20 focus
events. It measured **55 GraphQL operations in 20.144 seconds** (about **164/minute**
if sustained): 14 template searches, 40 miniature windows and **one** folder tree.
The focus burst issued **zero** catch-up reads. No HTTP failure or renderer error
occurred. These numbers are evidence, not timing-sensitive test assertions.

## Policy

- **800 ordinary starts/minute per client AND session** only for a session verified
  by the server's session table/expiry check. This is approximately **4.9×** the
  sustained heavy interactive regression. A bearer-shaped string, expired token,
  or anonymous access to a sign-in-disabled vault cannot select this allowance.
- Anonymous/unverified ordinary traffic remains **120 starts/minute**.
- Ordinary concurrency remains **four** operations per client AND session.
- Subscription budgets remain independent: **120 starts/minute**, **eight** active
  streams per client AND session, and **128** streams globally.
- Login/password/setup protection, operation complexity/body/row limits, host,
  Origin and authorization gates are unchanged. Raising an authenticated start
  allowance is not an authentication bypass or a concurrency increase.
- Healthy SSE owns revision delivery/catch-up; no redundant background
  `VaultInvalidation` poll or focus burst runs while it is connected. Authentication
  polling and reconnect/focus recovery when disconnected remain active.
- A background reconciliation 429 does not mean the vault disconnected. Retain
  current data/stream and retry at the existing bounded recovery interval. Other
  failures still surface; explicit Retry and foreground query errors retain the
  localized `RATE_LIMITED` message, with screen-local Retry controls.

Updater HTTP 404/no release metadata remains an updater-only error state. The
About screen describes it calmly as “Couldn't check for updates”; `UpdatePrompt`
only displays available/ready updates or version consent. Tests explicitly assert
that missing release metadata creates no global vault warning.

## Checks

`npm run e2e:native` runs `e2e/banner-stress-flow.mjs` against an actual packaged
binary, with its own temporary desktop profile. Rate-limit unit/integration tests
verify both authenticated and anonymous allowances and unchanged concurrency.
`node scripts/smoke-banner-layout.mjs EVIDENCE --update-baselines` captures reviewed
Storybook screenshots at 1440/1024/390; omit `--update-baselines` to perform the
pixel and geometry regression against those baselines. Neither command accesses
a personal vault.
