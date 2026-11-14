# Paintwarden rename and existing installations

The display name is **Paintwarden**, npm scope is `@paintwarden`, repository is
<https://github.com/moonryc/paintwarden>, and website canonical domain is
<https://paintwarden.com>. App directories now use `apps/paintwarden*`; generic
package directories remain unchanged. The developer's existing local checkout
folder need not be renamed.

## Desktop profile migration

**Quit the old app and any server using its data first.** Before Chromium or SQLite
opens a profile, the new app checks for the legacy `PaintVault` data root and older
`Paint Vault` Electron-only userData directory. On macOS both are under
`~/Library/Application Support`; on Windows the root uses `LOCALAPPDATA` (or
Electron appData as fallback), and Electron-only userData uses Electron appData.

- New root: `Paintwarden`; Chromium userData: `Paintwarden/electron`; logs:
  `Paintwarden/electron/logs` on every platform.
- One old root and no destination: atomically rename the whole directory, including
  database, WAL/SHM sidecars, images, connection choice, language, and Chromium files.
- An older Electron-only profile moves into `Paintwarden/electron` under an exclusive
  wrapper. Its source is untouched if the move fails.
- No old root: use the new root normally. A migrated profile is not migrated again.
- Both old and new roots, multiple legacy profiles, a non-directory/symlink profile,
  permission errors, cross-device errors, or an active/stale migration lock stop
  startup. Nothing is merged, overwritten, copied, or deleted to resolve ambiguity.
- Failure uses an ephemeral `paintwarden-recovery-*` Chromium profile, not a fresh
  vault. Open logs, Retry, support bundle and Report a bug remain available. After
  fixing the cause, successful Retry relaunches the app with the migrated profile.
  Inspect logs and preserve all profiles before resolving a conflict; do not delete
  an old profile or lock unless you have verified it is safe and every writer stopped.
- `PAINTWARDEN_DESKTOP_DATA_DIR` is an absolute isolated override. It deliberately
  disables legacy discovery, so tests/custom profiles never inspect a normal vault.

The database filename migration **reads an existing `paint-vault.sqlite` in place**
so its SQLite sidecars stay together. New vaults use `paintwarden.sqlite`. If both
files exist, startup fails rather than choosing a potentially empty database.
`DATABASE_PATH` still explicitly overrides this choice. Old JSON v3/v4 and ZIP v1
backup format identifiers remain readable; new backups identify as
`paintwarden-backup`. Immutable compatibility fixtures retain historical names.

## What does not carry over automatically

The macOS bundle ID changed from `com.paintvault.desktop` to
`com.moonryc.paintwarden`. OS-managed permissions/preferences (and any external
Keychain entries) are a new identity. The app does not store credentials in Keychain
or use `safeStorage`/keytar. Server connection URL/mode and selected language are in
`client-connection.json` and move with the root. In-memory proxy cookies do not
survive any quit. Changing the internal renderer origin from `paintvault://app` to
`paintwarden://app`, and renamed localStorage keys, means sign-in tokens and small
UI/device preferences at the old browser origin are not automatically imported;
users may need to sign in again. The vault account/password hash and vault contents
remain unchanged. This protocol is internal, not an OS-registered external link;
there were no public deep-link registrations to keep handling.

All `PAINT_VAULT_*` configuration variables are now `PAINTWARDEN_*`; update custom
launchers/proxy/container configuration, including `PAINTWARDEN_DISABLE_UPDATES`.
The generic `DATA_DIR`, `DATABASE_PATH`, `HOST`, and `PORT` variables are unchanged.

## Docker volumes

The compose service/image are `paintwarden` / `paintwarden:local`. New installations
use the named volume `paintwarden-data`. Existing Docker data is **not** renamed or
deleted automatically: stop the old container, find the actual previous volume
with `docker volume ls`, and set `PAINTWARDEN_VOLUME` to that exact existing volume
name before starting the new compose file. Confirm the existing vault before
removing any old container or volume. The server reads legacy database filenames
inside `/data` as described above.
