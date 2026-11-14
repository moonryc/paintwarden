# Phase 5 executable QA extensions

These **new** runners preserve the historical Phase 4 harness/artifacts. They never build, pull an image, invoke development Electron, use Compose, or read a user's vault. Use exactly Node **22.22.2**. A default invocation (or `--plan`) writes `NOT RUN`, not acceptance evidence. Run only after the coordinator approves stable production artifacts.

```sh
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
node --test scripts/graphql-phase5-runners.test.mjs

# Existing approved production server + renderer build; fresh temporary DATA_DIR.
node scripts/graphql-phase5-browser.mjs /absolute/evidence/phase5-browser --run
# Optional: --web-dist /absolute/approved/web-dist

# Existing image only, pinned internally to its immutable image ID.
node scripts/graphql-phase5-docker.mjs /absolute/evidence/phase5-docker \
  --image APPROVED_IMAGE --run

# Actual approved packaged macOS app; ONE fresh profile for the whole switch cycle.
node scripts/graphql-phase5-native.mjs /absolute/evidence/phase5-native \
  --app '/absolute/path/Paintwarden.app' --run
```

Do not reuse an evidence directory across concurrent runs. Evidence paths should be outside the repository. All commands without `--run` are plans. `--plan --run` and unknown flags fail. Runners exit nonzero on a failed check/cleanup/stability check. Unreached checks remain `NOT RUN`; one early failure does not become a broad exclusion or a pass.

## Browser and Docker acceptance

The same `graphql-phase5-support.mjs` scenario performs:

1. Independent authenticated HTTP probes prove `/api/state`, `/api/changes`, and `/api/changes?since=0` return **JSON 404**, rather than merely 401 or an SPA fallback. These intentional probes stay separate from the renderer recording.
2. Real Settings **Plugins → Upload .zip** installs a ZIP built from `examples/demo-plugin` (8 paints, 2 schemes, 1 template). A previously empty Apollo Library search then shows its paint. Upload response, installed source counts, and visible UI are asserted.
3. Real Settings **Export** produces an actual downloaded recovery ZIP. It contains custom stock/scheme/template/miniature relationships plus the demo catalog and actual images. Account/session tables are forbidden. Change sign-in policy **after export** so restore must preserve the current account setting, not the policy at export time.
4. HTTP **merge** restores a deliberately deleted paint, while preserving an existing edited paint and an additional paint. HTTP **replace** reconstructs the baseline after the demo plugin and its images were deleted via production cleanup. Compare **every table/row/field** and **every image SHA256**, ignoring only row/key order and export metadata. Owner, sign-in policy, and active session must remain unchanged.
5. Real browser file input, restore summary/radio controls, and confirmation buttons exercise **both merge and replace**, again checking actual persisted content and account preservation. No direct database writes or UI store injection.
6. Real plugin remove preview/confirmation performs the production DELETE and removes the cached Library result. A separate HTTP bearer session then installs and removes the demo ZIP **while Library stays mounted**: visible Apollo results must appear/disappear without navigation, reload, or a manual refresh.
7. With sign-in off, anonymous GraphQL reads still work. With it on, anonymous backup/plugin/GraphQL reads are denied. Settings **Sign out** and ordinary owner **Sign in** recover real UI access. Original sign-in policy is restored.
8. Complete renderer recording must have no retired-route requests, renderer exceptions, HTTP errors, or GraphQL errors. HTTP probe/anonymous-denial assertions are independent, explicitly expected checks, not error suppression.

The fixture is deliberately compact, not a large-vault performance benchmark. The complete table comparison includes empty sections; this is not a claim that every possible record type/control has a nonempty fixture. Phase 4 continues to provide the broader screen/large-fixture coverage.

## Packaged native acceptance

`graphql-phase5-native.mjs` launches the actual `.app`, with updates disabled and exactly **one** new `PAINTWARDEN_DESKTOP_DATA_DIR`. Its remote server uses another fresh `DATA_DIR` and the same app's packaged Node/server/web assets.

- First-run chooser → **Use this computer**, owner setup, unique local marker.
- Intentional window close/clean process exit → relaunch: retained local connection, normal owner sign-in, persisted marker.
- Settings **Change server** → fill **Server URL** → **Connect to server**; setup independent remote owner and a different marker. Local marker must be absent.
- Quit/relaunch → retained remote URL, normal sign-in, only remote marker.
- Settings **Change server** → **Use this computer** → normal sign-in. Original local marker must remain; remote marker must be absent.
- Final quit/relaunch → retained original local connection/owner/data; final clean intentional quit.

CDP drives ordinary controls. There is no test hook, connection-setting bridge call, localStorage mutation, or renderer injection. The production `getConnection()` bridge is used **read-only** to assert the saved mode/remote URL, alongside visible UI and real API reads. Relaunch must bypass the chooser without an automated choice. This runner adds actual same-profile switching to Phase 4's separate local/remote profiles; it does not replace that native screen sweep. Native OS save dialogs are not automated here; browser/Docker establish real backup file flows. Windows/signing are out of scope, not passes.

## Retained evidence and safety

- `*-results.json`: individual PASS/FAIL/NOT RUN rows, source manifests before/after, runtime identity, fixture paths, timestamps, and backup/file evidence.
- `*-raw-evidence.json`: complete recorder requests and errors (credentials redacted, not error statuses). Recovery ZIP and demo ZIP remain in the evidence directory. Screenshots accompany native stages and failures.
- Browser hashes the observed server/schema/web assets and Node; native hashes the complete app including symlink targets; Docker records its immutable image ID and checks its Node version. Hashes identify observations, **not** proof an arbitrary existing build matches source. The coordinator must establish the source/build link. Source or observed artifact changes during a run fail stability checks.
- Every server/desktop fixture directory and Docker fixture volume is retained. Only owned processes and the uniquely named test container are stopped/removed; the Docker volume is never deleted. No user's account/browser context/native profile is reused. Chromium uses a fresh context, so hostname-scoped cookies cannot overwrite the user's browser session.
- Logs retain failures; one-time owner setup codes and fixture passwords are redacted from final saved logs. Do not publish fixture recovery ZIPs without reviewing their synthetic contents.

## Verification performed while implementing

Source-only Node22 syntax checks and focused unit tests validate parser safety, honest plans, ZIP construction, complete-table/image mismatch detection, redaction, and native UI-only connection control contracts. **No build or production/browser/Docker/native acceptance run is implied by those unit tests.** Runtime acceptance stays pending until the approved artifacts are explicitly run.

## Two actual browser clients

```sh
node scripts/graphql-phase5-two-browser.mjs large /absolute/evidence/two-large --run
node scripts/graphql-phase5-two-browser.mjs stress /absolute/evidence/two-stress --run
```

These use the existing production build, exact Phase 0 large/stress temporary
fixtures, two separate Chromium contexts and distinct owner sessions. Both keep
the same filtered Paint Library mounted. Browser1 changes quantity2→7 using the
normal stock input, Browser2 visibly receives it through SSE; Browser2 then changes
7→9 and Browser1 receives it without navigation, reload or manual refresh. Both
complete API/renderer recordings must be error- and retired-route-free. No extra
performance claim is made from this mutation fixture.
