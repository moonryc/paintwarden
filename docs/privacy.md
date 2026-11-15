# Privacy and network activity

This disclosure describes the **1.0.0-beta.1** code, not a promise that the app
never uses the network. Review the release notes when updating. The beta wording
is subject to maintainer approval before invitations.

## Where your data lives

In desktop **Use this computer** mode, Paintwarden runs its bundled server on
loopback and stores the SQLite database, uploaded photos and plugin images in
this computer's application-data folder. The desktop connection preference and
cache are separate from vault records. In **remote/server mode**, records,
credentials and uploaded images go to the server you choose. Its administrator
controls storage, access, logs and backups; the desktop app does not maintain an
offline replica. A browser also sends requests to its Paintwarden server.

Default desktop folders are `~/Library/Application Support/Paintwarden/` on
macOS and `%LOCALAPPDATA%\Paintwarden\` on Windows. Docker uses its persistent
`paintwarden-data` volume. A configured custom data directory can change these
locations. Owner passwords are stored as hashes; sessions and the owner account
are not in an exported vault ZIP. A full directory/volume backup can include
credentials, sessions and private photos: treat it as sensitive.

The owner account belongs to your vault; it is not registration with Paintwarden
or an account hosted by us. For browser and private remote access, see
[the phone access guide](phone-access.md).

## When requests leave your computer or server

- **Desktop updates:** packaged apps check this project's GitHub Releases about
  ten seconds after launch and every six hours; a manual check also contacts
  GitHub. Update downloads use GitHub and its asset delivery hosts. Local-mode
  eligible updates can download in the background. In remote mode, a version
  mismatch requires consent before downloading. Unsigned Mac packages cannot
  install native automatic updates; use manual replacement. These requests are
  distinct from sending diagnostics. Unpackaged builds do not check; the
  `PAINTWARDEN_DISABLE_UPDATES=1` environment setting disables packaged checks
  for controlled runs (it is not an in-app privacy switch).
- **Plugins:** adding a public GitHub plugin or checking/updating it sends
  requests from the vault's server to GitHub API/raw-content hosts, including
  its manifest, catalog, logo/images and declared dependencies as needed.
  Opening **Plugins** also checks versions and can automatically download and
  apply newer versions of installed repository plugins in the background. Uploading a ZIP sends it to your vault
  server; declared repository dependencies can still require GitHub. Downloading
  a plugin in your browser contacts its download host separately.
- **External images:** importing an image by URL asks the vault server to fetch
  that public URL and permitted redirects. Scheme image/thumbnail URLs can also
  be displayed directly by the interface, contacting their host from your
  browser/desktop. Uploaded local photos are served by your selected vault
  server. Do not use private or token-bearing image URLs in shared content.
- **Links you open:** project, help, license, source, donation and bug-report
  links can open your browser to third-party services. **Report a bug** opens
  GitHub with the app version, OS family, local/remote mode and language in the
  URL. It does not attach your vault or support bundle. Submitting an issue or
  attachment is your separate action and is public unless you use private
  vulnerability reporting.

The receiving services/server operators can see connection metadata such as
IP address, request time and requested resource, and apply their own policies.
Remote vault requests carry authentication where needed. Hosting, browser/OS
services, proxies and backups may have their own logging or sync behavior.
Paintwarden's code cannot guarantee what those systems collect.

## Diagnostics and analytics

The reviewed beta code has **no configured usage-analytics service or automatic
diagnostic-upload endpoint**. This is not a "zero network" claim: the requests
above still occur. Local application/server logs and OS crash reports may exist.

**Save support bundle** is optional and saves a file locally after confirmation;
it does not upload it. The desktop ZIP contains a summary (version, OS family,
mode, language, migration state, and remote server version where available), plus
redacted event labels from desktop/server logs and a list of generic recent
error labels. The exporter omits arbitrary log text, paths, URLs, SQL, identifiers
and vault content. The browser saves summary JSON without server logs. The preview
shows the summary, not a full preview of every desktop log label. Inspect the
saved archive before sharing; redaction is not a reason to upload raw logs,
a database or a backup. Only share what is necessary and remove private details
from screenshots. See [the tester guide](beta-testers.md#6-tell-us-what-happened-safely)
and [private security reporting](../SECURITY.md).

## Product website

The product website is separate from your vault. We keep aggregate visit counts
for the website and delete raw access logs within 7 days. The website stores your
chosen language in browser local storage. This website policy does not set the
retention of your own server logs, app/OS logs or third-party service logs.

## Independent project; plugin content

**Paintwarden is an independent project and is not affiliated with or endorsed
by any paint or miniature manufacturer. Brand and paint names in plugins belong
to their respective owners.** This notice does not grant permission to copy,
redistribute or use anyone's catalogs, logos or photographs. Choose plugins and
share content only where you have the necessary rights. The app bundles no
manufacturer catalog.

## Code references for this disclosure

- [Desktop storage and request bridge](../apps/paintwarden-electron/main.cjs),
  [connection preferences](../apps/paintwarden-electron/desktop-preferences.cjs),
  [update timing/download policy](../apps/paintwarden-electron/desktop-update.cjs)
- [Plugin opening/check behavior](../packages/vault-ui/src/dom/Pages/Sources/PluginsModal.tsx),
  [GitHub requests](../apps/paintwarden/lib/github-source.ts),
  [ZIP dependencies](../apps/paintwarden/lib/catalog-sources.ts)
- [URL image import](../apps/paintwarden/app/api/image-import/route.ts),
  [public fetch restrictions](../apps/paintwarden/lib/public-fetch.ts),
  [scheme image display](../packages/vault-ui/src/dom/Components/SchemePreview.tsx)
- [Desktop support exporter](../apps/paintwarden-electron/desktop-support.cjs),
  [browser reporting/export](../packages/vault-ui/src/dom/utils/support.ts),
  [backup contract](data-compatibility.md)
