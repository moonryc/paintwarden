# Phase4 smoke harness

Use **Node 22.22.2** in this isolated worktree. No runner builds or packages. Default execution writes a `NOT RUN` plan; use `--run` only after the coordinator approves stable production artifacts. Do not use personal vaults or main's development servers.

```sh
E=/Users/moon/Desktop/REPOS/PERSONAL/paint-tracker-audit/graphql-phase-4-evidence
node scripts/graphql-phase4-browser.mjs "$E/browser/ATTEMPT" --profile realistic
node scripts/graphql-phase4-browser.mjs "$E/browser/ATTEMPT" --profile stress
node scripts/graphql-phase4-native.mjs "$E/native/ATTEMPT" --app '/absolute/path/Paint Vault.app'
node scripts/graphql-phase4-docker.mjs "$E/docker/ATTEMPT" --image EXISTING_IMAGE_ID
```

Append `--run` only when approved. Browser accepts `--web-dist /absolute/production/web-dist`; server comes from `apps/paint-vault/dist`. Give each attempt its own directory; do not overwrite exploratory failures or Phase3 evidence. Native runs the actual provided macOS `.app` in **local and remote** modes and tests intentional quit/relaunch. Docker requires an existing image and daemon; it never builds/pulls or uses Compose/user volumes.

## Scope and interfaces

- One `runPhase4Scenario` checklist for browser/native-local/native-remote/Docker, including retained Home/Miniatures readiness/virtualization/keyboard probes plus every remaining screen.
- Browser `realistic` maps to unchanged Phase0 **large** baseline (4,500 paints/1,500 miniatures/300 schemes/500 templates); `stress` maps to original **stress** (30,000/10,000/3,000/5,000), then adds focused probes. Source baseline generator remains unchanged. Native/Docker use focused command-seeded fixtures, **not original large/stress vault performance measurements**. Additional focused miniatures: 360 realistic / 1,000 stress.
- `seedPhase4Fixture(page,{profile})` requires a fresh isolated vault and normal owner setup. It uses production commands and returns compatible Phase3 probe fields plus `phase4` editable scheme/template, missing wishlisted paint and linked project IDs/names. It never calls `/api/state`.
- Independent writer signature `(paintId, quantity)`: separately spawned Node process, fresh authenticated HTTP session, no renderer cookies/cache or direct SQLite writes. Packaged local endpoint discovered only from harness-owned Electron child metadata.
- UI names/roles must retain production semantics. Editable fixture scheme/template are user-owned. Settings account credentials must remain unchanged because independent clients use the fixture owner; cancellation/validation can be tested without destructive owner edits.

## Evidence and interpretation

JSON status is `PASS`, `FAIL`, `PARTIAL`, `NOT RUN`, or `N/A`. Any failure makes the overall run `FAIL`; successful targeted checks with explicit unrun exclusions remain `PARTIAL`, never imply a full control/OS/distribution pass. Early failures retain completed checks and pending rows. Reports include raw API bodies (auth bodies excluded), screenshots, exact runtime binary/server/schema/web hashes, before/after source hashes, timestamps, isolated fixture paths and owned-process logs. Source/artifact manifests are separate observations: coordinator cross-checks the final approved build; a successful web run cannot establish native success.

Zero `/api/state` is asserted across the entire recording, including fixture/setup. GraphQL errors/renderer exceptions are separately checked. Single navigation timings are observations, **not percentiles, cold-disk measurements or speedup claims**. External repository install/update, signing, Windows and every-control native dialogs remain explicit exclusions unless separately observed. Docker fixture volumes and temporary directories are retained. Only owned processes/label-verified containers are stopped; no personal connection/vault is opened or modified.

Tooling-only validation (no build/app launch):

```sh
node --test scripts/graphql-phase4-*.test.mjs
for f in scripts/graphql-phase4-*.mjs; do node --check "$f"; done
```
