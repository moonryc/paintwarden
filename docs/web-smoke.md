# Production web smoke check

Tested November 10, 2026, about 17:15 CST on macOS arm64, against the production build of commit
`dcedf871` plus the then-uncommitted vault load error and server check changes. The server ran
from `apps/paint-vault/dist` on `127.0.0.1:3391` with an isolated `DATA_DIR`; no original vault
data was used. Checks were driven by Playwright in headless Chromium at 1440×900 and at 390×844
with touch and mobile emulation. Saves were confirmed through `/api/state`, and by reloading the
page where noted.

| Check | Desktop | Phone | Evidence or remaining work |
| --- | --- | --- | --- |
| Page navigation and horizontal overflow | PASS | PASS | All eight app pages rendered with no horizontal scroll. |
| Paint add, validation, edit, mark owned, delete | PASS | PASS | Save stays disabled while empty; Return submits; edit survives reload; delete cascades substitutions. |
| Miniature add, notes, stage, delete | PASS | PASS | Notes survive reload; delete needs two clicks, and the confirmation expires. |
| Recipes and substitutions | PASS | PASS | Step and paint survive reload; substitution saved. Choosing a substitution per miniature was not run. |
| Schemes create, rename, delete | PASS | PASS | Rename survives reload. Drag reordering was not run. |
| Templates save, edit, delete | PASS | PASS | Rename survives reload. |
| Images | PASS | PASS | Upload, display, add to existing, remove (file deleted), non-image rejected, viewer zoom, pan, and reset. |
| Backups | PASS | PASS | Export downloaded; Cancel, Merge, and Replace restored matching counts; images kept; invalid file rejected. |
| Wishlist sharing | PASS | PASS | Shared text contained the wishlisted paint. The phone share sheet was stubbed. |
| Tab, Shift+Tab, Return, dropdown keys | PASS | PASS | |
| Escape dismisses form modals | PASS | **FAIL** | `Modal.tsx` gives its full-screen layout no `onClose`, so Escape does nothing below the `sm` breakpoint. The Close button works. |
| Project drawer accessible name | PASS | PASS | Failed in this pass because `aria-label` landed on the Dialog root. Fixed afterward and confirmed in the Project story at 375 px. |
| Account settings | PASS | N/A | Username, password (wrong one rejected), sign out, sign in, and turning sign-in off and on. Same dialogs as desktop. |
| Changes from another client | PASS | PASS | Added and deleted records appeared on window focus; a new record appeared from the 30-second check without focus. |
| Failed refresh | PASS | PASS | Loaded data stays with a banner; Settings says Not connected; both clear on recovery. |
| Vault load failure | PASS | PASS | HTTP 500 and an unreachable server block the app with no empty vault shown; Try again recovers. |
| Console | PASS | PASS | Only errors from deliberately failed requests and rejected sign-ins. |

Tally across both widths: **32 PASS, 1 FAIL, 1 N/A**.

Product site (`astro preview` of the production build), at both widths: Overview, How to use, FAQ,
and Download **PASS**. There was no horizontal scroll, broken image, missing `alt`, dead internal
link, or console message. The Download toggle, the copy-commands button, and the phone menu
worked. External links were not fetched.

Not run: Safari, Firefox, real phones, plugin install and upload, drag reordering, and the
packaged desktop app. See `desktop-migration-smoke.md` for the last native check, which predates
these changes.
