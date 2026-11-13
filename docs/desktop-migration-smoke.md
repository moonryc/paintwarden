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
