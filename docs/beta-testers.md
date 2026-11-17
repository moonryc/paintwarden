# Paintwarden beta: start here

This **1.0.0-beta.1 friends-and-family beta** is a preview, not a finished release.
Expect rough edges; please use test data or keep independent backups of anything
important. Paintwarden is source-available under [PolyForm Noncommercial 1.0.0](../LICENSE),
not an unrestricted open-source license. Personal, non-commercial testing is welcome.

## 1. Pick where your vault lives

- **Just this computer (recommended):** install the desktop app and choose **Use
  this computer**. It runs a bundled local server; you do not need Docker or a
  hosted account. Paints, projects and photos stay in this computer's vault.
- **An existing server:** ask its owner for the URL and owner login, then choose
  the server connection. The server holds the vault; the desktop app is not an
  offline copy. You can also open that server in a browser. Use HTTPS on untrusted
  networks. Desktop app and server must match **exactly: 1.0.0-beta.1**, including
  the `beta.1` part. Updating the desktop does not update a server.
- **Run a server yourself:** the optional Docker instructions below are for
  someone comfortable with Docker, backups and network access controls.

You can change the connection in Settings. Changing it does not move your data;
if a vault looks empty, first check which computer/server you selected.

Read [privacy and network activity](privacy.md) before adding personal photos or
connecting to third-party plugins. Paintwarden is independent of paint and
miniature manufacturers; their names in plugins do not imply endorsement or
permission to redistribute their catalogs or images.

## 2. Download and install

Use only [the project's beta.1 release](https://github.com/moonryc/paintwarden/releases/tag/v1.0.0-beta.1).
Check its version, platform, release notes and any checksums published there. A hash
only checks that your file matches the release; it is not a substitute for
trusting its source. **Only use platforms actually offered and accepted for this
beta on that release page.** A build workflow or these instructions alone do not
mean a package has been tested or published.

### Mac (Apple silicon, macOS 13 or later)

Choose an **arm64** Mac package, not a Windows installer. Intel Macs are not
covered by this beta. Open the DMG, drag Paintwarden to Applications, then eject
the disk image. Alternatively, extract the ZIP and move Paintwarden to
Applications. Start the installed copy, not the copy inside the download.

- **Signed/notarized build, if offered:** open normally and follow the ordinary
  downloaded-app confirmation. Signing does not guarantee that every warning
  can be ignored.
- **Unsigned build, if offered:** macOS may say the developer cannot be verified.
  After checking that this is the intended project/release, attempt to open it,
  then look in **System Settings → Privacy & Security → Open Anyway** (if macOS
  offers it), and confirm/authenticate. Apple says the option is available for
  about an hour after the attempt. Current macOS does not always offer the old
  right-click → Open exception.

If macOS says the app is **malware, revoked, damaged or tampered with**, stop and
report it rather than bypassing the warning. Do not disable Gatekeeper or run
blanket quarantine-removal commands. Both DMG and ZIP downloads may carry
quarantine; changing containers is not a safety workaround. If your system does
not offer a per-app exception, ask for help instead of weakening protection.
See [Apple's guidance](https://support.apple.com/en-us/102445).

### Windows (only if this beta release offers it)

Use the Windows installer from the same release, not a Mac package. Follow the
installer. An unsigned or low-reputation app may trigger Microsoft Defender
SmartScreen. Only after verifying the source, **More info → Run anyway** may be
available. Managed policies or Smart App Control may block it without a per-app
exception; do not turn off Windows protection. Signed apps can also receive
reputation warnings. Stop on malware or tampering warnings and ask for help.
See [Microsoft's Smart App Control FAQ](https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions).

## 3. Create the vault owner

For a new local vault, choose a username and a password of **at least 12
characters**. This is an account on this vault, not a Paintwarden cloud account.
Save the login securely. An existing server uses its existing owner's login;
do not create another account expecting to see that owner's data.

A new network server also needs the one-time setup code from its server log
(`docker compose logs paintwarden` for Docker). The local desktop vault does
not need a code. Keep sign-in required on a shared or reachable server. Turning
it off lets anyone who can reach that server read the vault.

## 4. Add your catalog

An empty catalog on first launch is expected: no manufacturer catalog is bundled.
In **Settings → Plugins**, add a compatible public GitHub plugin repository or
choose **Upload ZIP** for a plugin file you trust. **Create plugin** can package
your own paints, schemes and templates for sharing.

The repository field accepts compatible plugin repositories whose root contains
`source.json`, not arbitrary ZIP links, subfolders or the Paintwarden application
repository. Check the source, content permissions and [plugin behavior](plugins.md)
before installing a plugin.

## 5. Back up before upgrading or restoring

In **Settings → Data**, export a vault backup ZIP and store it somewhere private
outside the app's data directory. It includes records, photos and installed
plugins, **not the owner password or sessions**. Restoring **Merge** keeps existing
records; **Replace** replaces vault contents but keeps the destination owner.
Restore is not an undo button: make a fresh export first.

Also make a **full stopped copy** before updates: fully quit the desktop app
(not just its window), or stop the server/container, then copy the entire data
folder/volume, including `images/`, database and any sidecars. Keep this copy
separate and label it with the old version and date. Desktop defaults are:

- macOS: `~/Library/Application Support/Paintwarden/`
- Windows: `%LOCALAPPDATA%\Paintwarden\`
- Docker: the named `paintwarden-data` volume mounted at `/data` in the container.

A custom data-directory setting changes that location. Automatic pre-migration
copies in `backups/` contain only the database and keep just five copies; they
are **not** a substitute for photos and a full stopped backup. See
[data compatibility and recovery](data-compatibility.md) before attempting recovery.
Never open an upgraded database with an older app. Beta-to-stable is intended
to preserve your vault, not reset it, but future releases' migrations have not
all been tested yet. Keep your beta backups.

### Upgrade the desktop app

Read the new release notes first and back up as above. For an **unsigned Mac**,
updates are manual: fully quit, download the new trusted release and replace
only the app in Applications, leaving its separate data folder intact. Reopen
and check records and photos. Signing a later release does not make an unsigned
beta.1 able to auto-update to it.

Other packaged builds may check GitHub and offer automatic updates; do not
assume an unsigned Mac can install them. For remote use, coordinate the exact
new app/server version with the server owner. An update warning can be deferred
with **Not now**. See [desktop update policy](desktop-update-policy.md).

### Optional: source-built Docker beta

There is no prebuilt registry image promised for this beta. With Git, Docker
Engine and Docker Compose v2 installed:

```sh
git clone --branch v1.0.0-beta.1 --depth 1 https://github.com/moonryc/paintwarden.git
cd paintwarden
docker compose up -d --build
docker compose logs paintwarden
```

Open `http://localhost:3000` and create the owner using the logged setup code.
Compose publishes port 3000 on the host's interfaces, not only loopback: keep it
on a trusted network, restrict access with a firewall, and do not port-forward
it to the internet without appropriate HTTPS and authentication. The server
administrator is responsible for hosting and backups; see
[configuration](../README.md#configuration).

To make a full volume backup (keep the archive private and copy it off-host):

```sh
docker compose stop paintwarden
docker compose run --rm --no-deps paintwarden \
  tar -C /data -czf - . > paintwarden-data-beta.1.tar.gz
docker compose start paintwarden
```

For an upgrade, first export a ZIP and take the stopped volume backup. Fetch
and select the **specific next published version tag from its release notes**
with `git fetch --tags` and `git checkout <exact-release-tag>`, then run
`docker compose up -d --build`. The angle-bracket text is a placeholder, not a
command to copy literally. Keep the same Compose volume configuration and
coordinate any desktop clients. Check the new version and records/photos.
Do not use `git pull` as a versioned beta upgrade or run **`docker compose down -v`**:
`-v` deletes the vault volume. Do not reuse an upgraded volume with an older image.

## 6. Tell us what happened (safely)

- **Ordinary bug:** use **Settings → Help & About → Report a bug**, or
  [GitHub Issues](https://github.com/moonryc/paintwarden/issues/new?template=bug_report.yml).
  Include exact app/server version, OS, local/remote mode, language, steps,
  expected result and actual result. Say whether it repeats. Screenshots help,
  but crop/redact names, private photos, addresses and secrets. Reports are public.
- **Diagnostics are optional:** **Save support bundle** previews a summary and
  saves a file locally. Desktop ZIPs include redacted startup/server-log event
  labels; browser JSON has no server logs. Nothing attaches automatically.
  Inspect the saved file before choosing whether and where to share it. Never
  upload your whole data directory, database or backup to a public issue.
- **Security/privacy vulnerability:** do **not** post exploit details, secrets
  or private data in an issue. Use the private reporting route in
  [SECURITY.md](../SECURITY.md). GitHub private vulnerability reporting must be
  enabled for that route to work; if unavailable, do not substitute a public report.

This is an informal beta; no response time or support availability is promised.
If something looks like lost data, stop edits, keep backups and check the selected
connection before trying a restore.
