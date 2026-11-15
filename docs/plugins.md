# Plugins

A plugin adds paints, color schemes and miniature templates to a Paintwarden. Paintwarden ships with no catalog of its own. Everything in the shared catalog comes from plugins the owner installs in **Settings → Plugins**.

This guide explains how plugins behave: how they are installed, updated, removed and backed up, and how to make one. [The catalog source format](source-format.md) is the formal specification of the files and the rules each field must follow. In the code and that specification, a plugin is called a _catalog source_.

## What a plugin contains

A plugin is a folder, published as a public GitHub repository or packed in a `.zip`:

```
source.json     name, version, license, dependencies
catalog.json    paints, schemes and templates
assets.json     the SHA-256 hash of every image
images/         scheme and template images
logo.svg        optional logo shown in Settings → Plugins
```

Other files, such as a README, are allowed and ignored.

Every paint, scheme, template and scheme entry has a fixed UUID. Miniatures, recipes, substitutions, backups and other plugins refer to items by these IDs. The ID is what makes an update change an existing paint rather than add a second copy.

## Installing

### From GitHub

The owner enters a public repository as a URL, `owner/name`, or `github:owner/name`. Paintwarden then:

1. Remembers the repository's default branch and reads `source.json` at that branch's latest commit.
2. Installs each dependency first, following the same steps. It refuses a circular dependency, and a dependency older than its `minimumVersion`.
3. Downloads `catalog.json`, `assets.json` and the images from that same commit, so the files always come from one revision.
4. Validates everything. Any error stops the install and names the file, item and field. Each image is checked against its SHA-256 in `assets.json`.
5. Prepares the complete row data in memory, then writes the plugin and its dependencies in one short synchronous database transaction with prepared, bounded batches. Its new original images and thumbnails are promoted before that transaction commits.

### Progress, cancellation and visibility

The non-blocking progress panel shows **Reading**, **Checking**, **Images**, **Preparing data** and **Committing**, with completed/total counts and a weighted overall progress bar. The Plugins page and global indicator follow the same server-side job over the authenticated GraphQL SSE connection. Reloading or navigating away reattaches to that job rather than restarting it; closing the panel does not cancel the install. Only one install/update job runs at a time; another request receives an “install is already running” error rather than silently queuing.

Reading/checking, downloads, image hashing/thumbnail generation and row preparation run **outside** a database write transaction. Ordinary vault edits and image uploads can continue during those stages. Images are staged in a private `DATA_DIR/.plugin-staging/<job-uuid>/` directory outside the HTTP `images/` directory, on the same filesystem; neither pending catalog rows nor pending image URLs are published. This hidden work directory is excluded from logical ZIP backups, restore image cleanup, image garbage collection and HTTP/support exports. Keeping it under `DATA_DIR` supports mounted Docker volumes without cross-device copies. Uploaded ZIPs can be read from a disk-backed spool and inflate only requested entries, with compressed/expanded/entry limits checked before use.

**Cancel** stops the cancellable stages and removes staged files after outstanding workers finish. Committing is deliberately not cancellable: promotion and the SQLite commit run synchronously without yielding, so readers see either the complete previous version or the complete new version. Change-log entries become visible with the commit, producing one complete invalidation window for connected clients. No write transaction is held while images decode.

A failure or accepted cancellation leaves the previous plugin version, its rows and image bytes intact, including dependency changes prepared for that operation. **Update all** is also one atomic operation: a failure or cancellation does not leave some plugins updated. Cached images are checked again before commit, and a source changed or removed during preparation causes a retry error rather than resurrecting stale data. Edits to inventory, folder membership and dropped-item usage made while staging are respected at commit.

Every new image has an immutable UUID key; unchanged asset hashes reuse existing images without decoding/downloading again. Four asset workers share the app-wide two-decoder thumbnail limit. Only the short promotion/commit/cleanup phase owns the image-mutation mutex. A failed promotion rolls the database back and removes only this operation's fresh files. Journals track owned originals and derivatives; startup sweeps abandoned staging and unreferenced crash-time promotions, preserving images referenced by a committed vault row. A restart does not resume an interrupted install: retry it after recovery. Invalid/unsafe recovery journals fail closed rather than deleting arbitrary files.

If any step fails, the vault is unchanged and images staged for the failed install are deleted. Existing tolerance for unsupported historical image originals is unchanged; their thumbnails can remain unavailable, but checksum errors and filesystem write/promotion errors fail the install.

The repository, in lowercase `owner/name` form, identifies the plugin. Other plugins name it in their `dependencies`. Inside the vault, each plugin also has its own UUID.

### From a .zip

**Upload .zip** installs a plugin without publishing it. The files may be at the root of the zip or inside one folder, as GitHub's **Download ZIP** packs them.

An uploaded plugin is identified by its `name`, ignoring case, accents and punctuation. It is never checked online, and other plugins can't depend on it. Its own dependencies still install from GitHub.

## Updating

**Settings → Plugins** probes each GitHub plugin's version when it opens, then
runs a background update operation that can download and apply newer versions.
The **Check for updates** button only probes versions; the plugin's update action
or **Update all** also applies updates. Repository plugins can therefore change
when you open Plugins, not only when you press an update button. Uploaded ZIP
plugins have no repository to check; update them by uploading a newer ZIP.
See [privacy and network activity](privacy.md) for the requests involved.

An update compares `version` in `source.json` with the installed version:

| Version in the repository | Result                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------- |
| Higher                    | The catalog and images are downloaded and replace the installed ones.                   |
| The same                  | Only `logo.svg` is refreshed. Edits to the catalog are ignored until `version` changes. |
| Lower                     | The installed version is kept, and Settings → Plugins shows an error.                   |

An uploaded plugin is updated by uploading a `.zip` with a higher version. Uploading the same version keeps the catalog and catalog images unchanged, but refreshes `logo.svg` (or removes the installed logo if the upload omits it). A lower version is refused until the installed plugin is removed.

When a new version is installed:

- **Paints** take the new brand, range, name, type, color, discontinued flag and link.
- **Schemes** take the new name and category, and their entries are rewritten in the new order.
- **Templates** take the new details, image and recipe.
- **Images** with an unchanged hash are reused instead of downloaded again. Images the new version no longer uses are deleted, unless a scheme the vault keeps still shows them.

### Items a new version drops

An item the previous version provided and the new version leaves out is settled as follows:

- An item nothing in the vault uses is deleted.
- An item the vault still uses is kept. This covers paints in the owner's inventory or wishlist, or in miniatures, recipes, schemes or substitutions, and schemes attached to miniatures or templates. A kept paint is marked discontinued. The item stays linked to the plugin, so removing the plugin later accounts for it.
- Dropped templates are always deleted, because nothing refers to a template.

## Items shared between plugins

Two plugins may ship the same paint ID only when the paint's brand, range, name and color match. Otherwise the second install fails with an ID conflict. The first plugin to install a shared paint keeps it, and the second plugin's copy doesn't overwrite it. Scheme and template IDs can't be shared between plugins.

To build on another plugin's paints or schemes, list it in `dependencies` and refer to its IDs. Don't copy its items.

## Removing

Removing a plugin first shows a preview of the paints, schemes and templates it would delete. Items another plugin also provides are not counted, because they stay.

Removal is blocked while the vault still uses something only this plugin provides. The preview lists each blocker:

- Other plugins that depend on it.
- Miniatures that require its paints or use its schemes.
- Inventory and wishlist entries.
- Other templates and schemes that use its paints or schemes.
- Paint substitutions and miniature substitution choices.

Once nothing is blocking, removal deletes the plugin's items and any images nothing else uses.

## Backups

A vault backup includes every installed plugin with its catalog and images. Replace restore requires a complete backup with every vault section; incomplete backups can only be merged and never clear omitted sections. Restores and image changes run one at a time, and cleanup never deletes an image still used by a vault record. A restored plugin comes back at the backed-up version. A GitHub plugin stays linked to its repository and updates normally afterwards.

When a backup is merged into a vault that already has the same plugin, matched by repository, the vault keeps its own copy. The backup's items are attached to that copy.

## Sharing your own items

**Settings → Plugins → Create plugin** exports the owner's own paints, schemes and templates as a ready-to-publish plugin `.zip`.

Owner items have `user:<uuid>` IDs in the vault. The export uses the bare UUID, so exporting again later gives the same IDs. Items from GitHub plugins keep their IDs and become dependencies. Items from uploaded plugins can't be exported this way, because an uploaded plugin can't be a dependency.

## Making a plugin

1. Copy `examples/demo-plugin/` or start from a **Create plugin** export.
2. Give every paint, scheme, template and scheme entry a new random lowercase UUID, for example with `uuidgen | tr A-Z a-z`. If you start from the demo, replace all of its IDs. Otherwise your plugin conflicts with the demo, or with anyone else who copied it.
3. Set `name`, `version`, `license` and `attribution` in `source.json`. Set `minimumAppVersion` when the plugin needs features from a newer Paintwarden release.
4. Put images in `images/` and record each one in `assets.json` with its hash, for example from `shasum -a 256 images/my-scheme.jpg`.
5. Test the plugin with **Upload .zip** in a test vault. It reports the first validation error with the item and field.
6. Publish it as a public GitHub repository with the files at its root.

To release a change:

- Edit the files and raise `version`. Catalog changes reach users only when `version` changes; logos can refresh without a version bump.
- Never change or reuse a published ID, because vaults and backups refer to it.
- When a paint is no longer made, set `discontinued: true`. Removing it would delete it from vaults that don't use it.

## Limits

| What                                    | Limit  |
| --------------------------------------- | ------ |
| `catalog.json`                          | 50 MB  |
| `assets.json`                           | 5 MB   |
| Each image                              | 30 MB  |
| `logo.svg`                              | 100 KB |
| Uploaded `.zip`                         | 250 MB |
| Uploaded `.zip` contents, once unpacked | 1 GB   |
| Files in an uploaded `.zip`             | 50,000 |

Text lengths, allowed values and ID rules are in [the source format](source-format.md).

### Developer example

[`examples/demo-plugin/`](../examples/demo-plugin/) is a CC0 authoring example and
automated test fixture, not a published starter catalog. It contains eight
fictitious paints, two schemes and one template. Its backend test installs it on
every test run to keep the example aligned with the current format.

To build a ZIP for development in a test vault, run from the repository root:

```sh
node scripts/package-demo-plugin.mjs outputs/paintwarden-demo-plugin.zip
```

Replace every item ID with a new UUID before using the example as your own plugin.
