# Electron migration smoke check

Tested October 30, 2026, about 16:35 CDT on macOS arm64. The tested bundle was
`dist/electron/mac-arm64/Paint Vault.app`; its `Contents/Resources/app.asar` SHA-256 is
`d22a066763252664e5e7944720ef07ad92836c923cb77b737582c790a9829759`.
The packaged DMG and ZIP were produced unsigned. The desktop app used
`PAINT_VAULT_DESKTOP_DATA_DIR` under `/private/tmp`, and the separate web/server fixture used
`/private/tmp/paint-vault-migration-check` on `127.0.0.1:3387`. No original vault data was used.

| Native check | Status | Evidence or remaining work |
| --- | --- | --- |
| macOS package and bundled resources | PASS | The packaged `.app` launched; DMG and ZIP built. |
| Bundled local server and data | PASS | Local choice reached owner setup and created SQLite only in the isolated data folder. |
| Remote connection and server lifecycle | PASS | The app loaded the isolated remote Workbench; its own local server stopped in remote mode. |
| Navigation | PASS | Workbench, Paints, Schemes, and Settings rendered; scheme cards and images were visible. |
| Miniature create/edit persistence | PASS | Created a fixture miniature, edited its note, closed it, and reopened it with the saved note. |
| Backup and sharing | PARTIAL | Native backup save dialog opened and canceled; restore, export completion, and sharing were not exercised. |
| Images | PARTIAL | Existing scheme images rendered; chooser, upload, zoom, pan, and reset were not exercised. |
| Other record flows | PARTIAL | Paint/scheme edits, recipes, substitutions, deletion, validation, and repeated reordering were not exercised natively. |
| Account and sign-in | NOT RUN | Isolated native fixture was only checked through owner setup; sign-in and account settings need a separate fixture pass. |
| Keyboard and responsive native layout | NOT RUN | Tab, Shift+Tab, Return, Escape, and narrow native window checks remain. |
| Quit and relaunch | PASS | Intentional quit exited cleanly; relaunch restored the saved local choice; final quit left no bundled server running. |
| Windows executable | NOT RUN | Windows packaging is configured in CI but requires a Windows runner for an executable smoke check. |

Native tally: **6 PASS, 3 PARTIAL, 3 NOT RUN, 0 FAIL**. This is a partial desktop smoke test,
not a full interaction pass. Fixture data was retained. The isolated `3387` web test server was
stopped after the remote check.

The production web build was checked separately. The isolated browser session passed navigation,
catalog and schemes display, Settings, fixture miniature add/edit/reopen, and the 390 px Settings
layout. Its console had no reported warnings or errors. See `web-smoke.md` for the later, fuller
web pass.

## Slow-start regression (November 13, 2026)

The `dialogs-migrations` change adds targeted macOS development and unsigned packaged-app
checks; it does not replace the broader historical checklist above or certify Windows/signing.
Run after the normal build and bundled-server regeneration:

```sh
node scripts/smoke-dialogs-migrations-native.mjs /absolute/path/to/evidence
```

This creates isolated desktop data directories and runs an actual backup and schema migration
with a synchronous 45-second test delay **each**, verifies the localized updating screen,
checks the untouched recovery database, quits and relaunches, deliberately fails a backup,
exercises Retry and the logs-folder IPC, and verifies that Quit waits for protected work.
The fault-injection hook requires both `PAINT_VAULT_TEST_STARTUP=1` and
`PAINT_VAULT_TEST_STARTUP_DELAY_MS`; it is bounded at two minutes per operation and is ignored
without explicit opt-in. Never set these variables for a personal vault.

Electron now retains child stdout/stderr in its application logs directory as
`vault-server.log`, rotating at 2 MiB with three older files (8 MiB total). Files are private
on Unix; logs can include the first-run owner setup code, recovery paths and server diagnostics,
so review/redact before sharing. Isolated `PAINT_VAULT_DESKTOP_DATA_DIR` profiles keep logs at
`electron/logs` within that directory. The startup error screen offers **Open logs folder**
and **Retry** without exposing raw paths/errors in the renderer.

A normal non-migration start has a 60-second grace period. Explicit backup/migration phases
keep waiting while the child is alive, up to a 30-minute wait cap. SQLite's synchronous work
cannot send JS heartbeats; the protected-operation start/end markers are written synchronously
before/after it instead. Reaching a cap reports a recoverable error but never kills the child;
Retry joins the same operation. Quit/server switching also defers termination until startup is
known safe (including the interval before the parent's stdout parser receives a marker).
