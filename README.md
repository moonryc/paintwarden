# Paintwarden

Paintwarden is a miniature-paint inventory and project planner for desktop or a
self-hosted web server. It tracks paints and quantities, miniature paint recipes,
wishlists, shopping lists, project photos, and reusable color schemes.

Everything runs on your own machine. App records are stored in a SQLite file and
uploaded project photos are stored as ordinary files alongside it.

## License

Paintwarden is **source-available**, under [PolyForm Noncommercial 1.0.0](LICENSE).
It is free for personal and other non-commercial use. Forking and modifying for
non-commercial purposes are allowed. Commercial use needs permission from Ryan
Moon; for now, request it through [GitHub Issues](https://github.com/moonryc/paintwarden/issues).
The license text controls; third-party components retain their own licenses.
See also the separate [trademark policy](TRADEMARKS.md) and
[contribution terms / CLA](CONTRIBUTING.md).

[Third-party notices](THIRD_PARTY_NOTICES.txt) include the independently licensed
fonts, npm/native libraries, Node and Electron/Chromium. Read them offline in
Settings → Help & About → Open-source licenses, on the website's Licenses page,
in desktop app resources next to `LICENSE`, or at `/app/THIRD_PARTY_NOTICES.txt`
in Docker. [Maintenance and LGPL source/replacement instructions](third-party/README.txt)
cover the exact library sources and build recipes. Run `npm run notices:generate`
after lockfile changes (`-- --refresh` to collect new npm tarball notices), then
`npm run notices:check`; new license types require explicit review. Native/runtime
version updates also require reviewing `third-party/sources.json` and its full texts.

## Docker Compose setup

### Requirements

- Docker Engine
- Docker Compose v2 (`docker compose`)
- Git

### Install

```sh
git clone https://github.com/moonryc/paintwarden.git
cd paintwarden
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000).

The first request creates the database and applies all migrations. On first use,
create an owner username and password (at least 12 characters). This also applies
when upgrading an existing vault; existing paint and project data stays in place.
Later starts reuse the same data automatically.

Creating the owner also needs a one-time setup code, so nobody else on your
network can claim a new vault first. The server prints it to its log, and a new
code is printed on each start until the owner exists:

```sh
docker compose logs paintwarden
```

The desktop app's local vault, and any server listening only on loopback
(`HOST=127.0.0.1`), don't need a code.

Useful commands:

```sh
# Follow application logs
docker compose logs -f paintwarden

# Stop without deleting data
docker compose down

# Start again
docker compose up -d

# Update to the latest version
git pull
docker compose up -d --build
```

Do not run `docker compose down -v` unless you intend to delete the database and
uploaded photos.

## Configuration

The defaults work without an `.env` file. To customize the host port, create
`.env` beside `compose.yaml`:

```dotenv
PAINTWARDEN_PORT=3000
```

Apply changes with `docker compose up -d`.

The owner can require sign-in for vault access in Settings, change the password,
or turn off the sign-in requirement. Turning off sign-in makes vault data
available to anyone who can reach the server; account changes, including turning
sign-in back on, still require the owner's session or current password. Use HTTPS
when accessing the server outside a trusted network.

While sign-in is off, the server answers only when opened by its IP address or a
`localhost` name, so a web page can't point its own domain at your server and
read the vault. To use other names, such as `nas.home` or a domain behind a
reverse proxy, list them in `.env` before turning off sign-in:

```dotenv
PAINTWARDEN_ALLOWED_HOSTS=nas.home,paint.example.com
```

Password attempts are limited per client. If the server runs behind a reverse
proxy, add `PAINTWARDEN_TRUST_PROXY=1` to `.env` so each client is identified by
the last `X-Forwarded-For` address the proxy adds, rather than all sharing the
proxy's address. Leave it off when clients connect directly; otherwise a device
on your network could claim a new address for every guess.

## Storage and backups

Compose mounts the named `paintwarden-data` volume at `/data`. Its contents are
simple, portable files:

```text
/data/paintwarden.sqlite  App database
/data/images/             Uploaded photos and plugin images
/data/backups/            Copies saved before updates change the database
/data/restore-uploads/    Temporary copy of a backup while it is being restored
```

The Data & settings screen exports a backup as one `.zip` file holding the whole
vault: records, photos, and installed plugins. Restoring one either merges it
into the vault or replaces the vault with it. The owner account isn't included.
Backups are streamed, so they don't need much memory, but a restore needs free
disk space for a temporary copy of the file. A restore accepts files up to 16 GB.

When a new release needs to change an existing database, Paintwarden first saves
a copy in `backups/` beside it and keeps the five most recent copies. If an
update goes wrong, stop the server and copy the newest file over
`paintwarden.sqlite`.

Create a full backup while the app is stopped:

```sh
docker compose stop paintwarden
docker compose run --rm --no-deps paintwarden \
  tar -C /data -czf - . > paintwarden-data.tar.gz
docker compose start paintwarden
```

Store the archive somewhere outside the Docker host.

To restore it, stop Paintwarden and extract the archive into the mounted data
volume. Restoring replaces the current app state, so preserve the current volume
until you have verified the backup.

## Local development

### Requirements

- Node.js 22.13 or newer; desktop builds require the exact version in `.nvmrc`
  (run `nvm use`), because the packaged app ships a copy of that Node binary
- npm

Install and run:

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Development data stays in
the repository-root `data/` directory, which is ignored by Git.
Set `PAINTWARDEN_WEB_PORT` to use another frontend port; the API remains proxied
to NestJS on port 3175.

Common commands:

```sh
npm run dev          # Start Vite on 3000 and NestJS on 3175 with /api proxying
npm run lint         # Check backend, app, product website, shared UI, and Electron source
npm test             # Run the Node and Electron tests
npm run build        # Build the app and product website through Nx
npm run start        # Serve the built app frontend and API
npm run db:generate  # Generate a migration after changing apps/paintwarden/db/schema.ts
npm run storybook    # Browse the shared UI components at http://localhost:6006
npm run codegen      # Regenerate typed GraphQL documents and resolver types
npm run codegen:check # Reject stale generated output
```

### Storybook

Storybook shows the reusable components from
`packages/vault-ui/src/dom/Components/` with the app's dark theme and fonts. Each
component has a `*.stories.tsx` file beside it; shared sample data and story
wrappers live in `packages/vault-ui/src/dom/storybook/`. Add or update a story
when you add or change a reusable component.

`npm run storybook:test` runs every story as a test in headless Chromium through
Vitest: a story fails if it throws while rendering, its play function fails, or
it has an accessibility violation (checked with axe, including color contrast).
CI runs it too. Install the browser once with `npx playwright install chromium`.

```sh
npm run storybook        # Start Storybook at http://localhost:6006
npm run storybook:build  # Build a static Storybook in packages/vault-ui/dist/storybook/
npm run storybook:test   # Run every story as a test
```

## Product website

`apps/paintwarden-site/` is the separate Astro and React product website. It has
an overview (`/`), how-to guide (`/docs/`), FAQ (`/faq/`), and desktop and
self-hosted options (`/download/`). Astro route files live in `src/pages/`,
while React and MUI content lives in `src/site/`. The generated hero picture and
labeled illustrative app previews live in `public/images/`.

```sh
npm run site:dev    # Preview the website at http://127.0.0.1:4321
npm run site:build  # Build static files in apps/paintwarden-site/dist/
```

`npm run dev` starts the app, not the product website. The root `npm run build`
builds both. Deploy `apps/paintwarden-site/dist/` to a static host; the NestJS
app server does not serve it. Desktop download buttons open this repository's
Releases page; see [Releasing](#releasing) before presenting those buttons as
direct downloads. Keep website setup steps and feature descriptions
in sync with the app when behavior changes.

## Desktop apps

The web app and the Electron app use the same React and MUI interface from
`packages/vault-ui/`. Vite builds the web app; in production NestJS serves the
web build and `/api` from the same address.

On first desktop launch, choose **Use this computer** or connect to an existing
Paintwarden server. In local mode, Electron starts its bundled NestJS server on
the loopback interface. In remote mode, Electron runs the interface without
starting a local server and sends vault requests to the selected server. The
choice can be changed in Settings. Local vault data remains in
`~/Library/Application Support/Paintwarden/` on macOS or
`%LOCALAPPDATA%\Paintwarden\` on Windows, separate from the web server's `data/`
folder. Existing local SQLite databases and images stay in those folders.
Set `PAINTWARDEN_DESKTOP_DATA_DIR` to an absolute path before launch to use a
different data folder. Electron keeps its cache in an `electron/` subfolder.

Build the desktop app on its target operating system so the bundled SQLite
native module matches that system. After `npm ci`, run `npm run desktop` to
build the web interface and bundled server and launch Electron. Run
`npm run desktop:package` to create an installable package for the current
operating system. The `npm run macos` and `npm run windows` aliases launch the
same Electron app on their respective systems.

Database migrations are applied automatically when the app opens the database.
After changing the schema, commit both `apps/paintwarden/db/schema.ts` and the
generated files in `apps/paintwarden/drizzle/`.

Packaged desktop apps update themselves from this repository's published GitHub
releases. They check shortly after launch and every six hours. In local mode,
updates download in the background and offer to restart; a downloaded update
installs when the app quits. In remote mode, an update that differs from the
selected server's version first asks for consent, warning that updating will
disconnect this app until the server matches. **Update anyway** permits the
download; **Not now**, closing, or Escape defers it until the next scheduled or
manual check. Switching connections invalidates that consent. See the
[desktop update policy](docs/desktop-update-policy.md) for the full behavior.
Data & settings shows the app version and has
**Check for updates**. Unpackaged runs never update, and setting
`PAINTWARDEN_DISABLE_UPDATES=1` turns updates off for a packaged test run.

## Releasing

The desktop app connects only to a server of exactly its own version, so the app
and server are always released together under one version number.

1. Set the same `version` in the root manifest and every workspace manifest:
   `package.json`, `apps/paintwarden/package.json`,
   `apps/paintwarden-electron/package.json`, `apps/paintwarden-web/package.json`,
   `apps/paintwarden-site/package.json`, `packages/paint-core/package.json`,
   `packages/paint-i18n/package.json`, and `packages/vault-ui/package.json`.
   The checker discovers workspaces from root `package.json`, including future packages.
   Run `npm install --package-lock-only` with
   the Node version in `.nvmrc` to update `package-lock.json`, then run
   `node scripts/check-release-version.mjs v1.2.3` (using the intended tag).
   The checker verifies every manifest and the root/workspace lockfile versions.
   Commit the manifests and lockfile together.
2. Push a tag such as `v1.2.3`. The Release workflow checks that the tag matches
   every package version, then builds the macOS and Windows apps and uploads them
   with their update files to a draft GitHub release.
3. Review the draft and publish it. Installed apps only see published releases.

Releases need the repository to be public, because installed apps download
updates from it without credentials. macOS installs updates only for apps signed
with an Apple Developer ID and notarized, so the workflow stops unless these
repository secrets are set:

| Secret                        | Value                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `MAC_CERTIFICATE_P12_BASE64`  | The Developer ID Application certificate, exported as a `.p12` file and base64-encoded. |
| `MAC_CERTIFICATE_PASSWORD`    | The password chosen when exporting that `.p12` file.                                    |
| `APPLE_ID`                    | The Apple ID of your Apple Developer account.                                           |
| `APPLE_APP_SPECIFIC_PASSWORD` | An app-specific password for that Apple ID, from account.apple.com.                     |
| `APPLE_TEAM_ID`               | Your Apple Developer Team ID.                                                           |

macOS builds are for Apple silicon. Windows builds are unsigned, so Windows may
warn when the installer first runs; automatic updates still work.

## Plugins

Paints, color schemes, and miniature templates come from plugins the owner installs in
Settings → Plugins, from a public GitHub repository or an uploaded `.zip`. Paintwarden
bundles no catalog of its own.

- [docs/plugins.md](docs/plugins.md) explains how plugins are installed, updated, removed,
  backed up, and made.
- [docs/source-format.md](docs/source-format.md) is the formal specification of the plugin files.
- [examples/demo-plugin/](examples/demo-plugin/) is a small working plugin you can zip and
  upload to try it out.

## Architecture

- Nx manages the npm workspace, project graph, task orchestration, and build cache.
- `apps/paintwarden/` contains the NestJS server, API handlers, and SQLite schema.
- `apps/paintwarden-web/` contains the Vite web entry point and static assets.
- `apps/paintwarden-site/` contains the Astro product website and guides.
- `apps/paintwarden-electron/` contains the macOS and Windows desktop host.
- `packages/vault-ui/` contains the shared React and MUI interface rendered on web and in Electron.
- `packages/paint-core/` contains reusable paint rules and search logic.
- React, TypeScript, MUI, and MUI icons provide the shared interface.
- Apollo Client and generated typed documents load bounded screen projections from GraphQL Yoga.
- Yoga runs inside the existing Nest router; subscriptions use SSE and the durable SQLite change log.
- Zustand holds navigation/actions/credentials, not a second vault data cache.
- Drizzle ORM and `better-sqlite3` provide local database access.
- The Node.js filesystem stores uploaded images under the configured data path.
- Docker Compose packages the app for a persistent, single-owner homelab setup.

All screens use GraphQL; `/api/state` and row-delta `/api/changes` are removed.
Auth, files, plugins and streamed backup/restore remain REST. Home remains the default;
`#paints` opens Library directly. Local desktop remains offline-capable; remote mode
does not provide an offline replica or queued writes.

Developer references: [architecture](docs/architecture.md), [screen data loading](docs/data-loading.md),
[adding queries/fragments and codegen](docs/graphql-development.md), and
[final migration benchmarks](docs/benchmarks/graphql-final.md),
[localization](docs/i18n.md), and [image thumbnails](docs/image-thumbnails.md).

## Troubleshooting

### The container does not start

```sh
docker compose ps
docker compose logs --tail=200 paintwarden
```

### Port 3000 is already in use

Set another host port in `.env`:

```dotenv
PAINTWARDEN_PORT=8080
```

Run `docker compose up -d`, then open `http://localhost:8080`.

### Existing records appear missing

Check that the volume still exists:

```sh
docker volume ls
docker compose config
```

### Uploaded photos are missing after a restore

A `.zip` backup from Data & settings includes photos and plugin images, so
restoring one brings them back. Only ZIP backups are supported. If you restore
a volume archive without its photos, restore the complete volume backup,
including the `images/` directory.


### Projects and template folders

Workbench and Miniatures can organize models into nested **Projects**; Templates has its own nested folders. Use Folder view to browse breadcrumbs and folder tiles, or Flat view to see every item. Each page remembers its view on the current device. Add asks for an item or folder and creates it at the current location. Item menus and bulk selection move items through a folder picker. Deleting a folder lets you preserve its contents by moving them up, or delete its entire subtree. Search includes both folders and items; Workbench summary counts follow the current project subtree (the whole collection at root or in Flat view).

Folders use a forward-only migration and ZIP2 backups, with an explicit ZIP1 reader restoring old items at root. Keep pre-upgrade recovery copies; see [data compatibility](docs/data-compatibility.md).
