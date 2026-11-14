# Desktop update consent

The desktop API remains **exact-version compatible**. Existing newer-server /
older-server connection guidance is unchanged.

- **Local:** check 10 seconds after startup and every 6 hours; automatically
  download, offer Restart / Later, and install on ordinary quit when ready.
- **Remote:** if the offered version differs from the observed server version
  (including unknown/offline versions), do not start a download without consent.
  A localized modal names server X and update Y and warns that updating may
  disconnect the app until the server is upgraded. **Update anyway** consents;
  **Not now**, Escape and Close defer until the next manual/scheduled check.
- A remotely connected server already on the offered version is compatible
  with that update. Existing connection-mismatch guidance still applies.
- Consent is in-memory, scoped to the connection generation, server origin,
  observed server version and offered update. Switching away/back or observing
  a changed server version invalidates it. A stale modal/IPC reply cannot grant
  consent for the next connection. Relaunch asks again, including cached updates.
- Changing a connection fails closed during validation/persistence. A download
  already in flight may finish, but cannot install on quit or via Restart while
  the active connection requires new consent. Deferral survives completion.
- Once installation has begun, connection changes are ignored until exit.

## Why both electron-updater automatic flags are false

`autoDownload` is disabled and the policy explicitly calls `downloadUpdate()`
when allowed. **`autoInstallOnAppQuit` must stay false in all modes**: on macOS,
electron-updater hands a downloaded update to native Squirrel immediately if
this flag is true, staging an installation that later connection changes cannot
revoke. Toggling the flag only when switching is insufficient.

Instead, the main process's `before-quit` handler calls the same guarded install
operation as Restart, after protecting migrations/backups. This preserves local
install-on-quit behavior without native staging before the final connection
check. An explicitly consenting remote user also authorizes installation on the
next quit. A plain quit after Not now never authorizes an incompatible update.
The library flags must not be re-enabled as an optimization.

Tests inject an updater EventEmitter for policy tests. The macOS packaged smoke
uses an **in-memory injected updater** through Playwright's main-process debugger:
no production test hook, artifact modification, published feed, real installer
or signing credential is required. It checks the actual renderer/preload/main
IPC and guarded quit handler, not just the isolated policy. Real signed update
installation/notarization and Windows remain separate release certification.
