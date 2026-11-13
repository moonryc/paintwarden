# Plugins

A plugin adds paints, color schemes and miniature templates to a Paint Vault. Paint Vault ships with no catalog of its own. Everything in the shared catalog comes from plugins the owner installs in **Settings → Plugins**.

This guide explains how plugins behave: how they are installed, updated, removed and backed up, and how to make one. [The catalog source format](source-format.md) is the formal specification of the files and the rules each field must follow. In the code and that specification, a plugin is called a _catalog source_.

A working example is in [`examples/demo-plugin/`](../examples/demo-plugin/). Its test, `apps/paint-vault/lib/demo-plugin.test.ts`, installs it on every test run, so it always matches the current format.

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

## Trying the demo plugin

From the repository root, pack the folder and upload it:

```bash
cd examples && zip -r ../demo-plugin.zip demo-plugin && cd ..
```

In the app, open **Settings → Plugins → Upload .zip** and choose `demo-plugin.zip`. The vault gains:

- 8 paints from a made-up brand, _Paint Vault Demo_. One is a varnish with no color, and _Old Bone_ is marked discontinued.
- 2 schemes. _Harbor Blue Armor_ has step headings, milestones, and an image with a thumbnail. _Brass and Bone_ lists two paints under one step.
- 1 template, _Demo Sentinel_. Its recipe links _Harbor Blue Armor_ and uses _Gull Grey_ in two steps.

To install it from GitHub, copy the folder's contents to the root of a new public repository and add the repository in **Settings → Plugins**.

To remove it, use the plugin's remove action in **Settings → Plugins**.

## Installing

### From GitHub

The owner enters a public repository as a URL, `owner/name`, or `github:owner/name`. Paint Vault then:

1. Remembers the repository's default branch and reads `source.json` at that branch's latest commit.
2. Installs each dependency first, following the same steps. It refuses a circular dependency, and a dependency older than its `minimumVersion`.
3. Downloads `catalog.json`, `assets.json` and the images from that same commit, so the files always come from one revision.
4. Validates everything. Any error stops the install and names the file, item and field. Each image is checked against its SHA-256 in `assets.json`.
5. Writes the plugin and its dependencies into the vault in one database transaction.

If any step fails, the vault is unchanged and images downloaded for the failed install are deleted.

The repository, in lowercase `owner/name` form, identifies the plugin. Other plugins name it in their `dependencies`. Inside the vault, each plugin also has its own UUID.

### From a .zip

**Upload .zip** installs a plugin without publishing it. The files may be at the root of the zip or inside one folder, as GitHub's **Download ZIP** packs them.

An uploaded plugin is identified by its `name`, ignoring case, accents and punctuation. It is never checked online, and other plugins can't depend on it. Its own dependencies still install from GitHub.

## Updating

**Settings → Plugins** checks each GitHub plugin for a new version when it opens, and again on **Check for updates**. Checking changes nothing. The owner applies a new version with the plugin's update action or **Update all**.

An update compares `version` in `source.json` with the installed version:

| Version in the repository | Result                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------- |
| Higher                    | The catalog and images are downloaded and replace the installed ones.                   |
| The same                  | Only `logo.svg` is refreshed. Edits to the catalog are ignored until `version` changes. |
| Lower                     | The installed version is kept, and Settings → Plugins shows an error.                   |

An uploaded plugin is updated by uploading a `.zip` with a higher version. Uploading the same version changes nothing. A lower version is refused until the installed plugin is removed.

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
3. Set `name`, `version`, `license` and `attribution` in `source.json`. Set `minimumAppVersion` when the plugin needs features from a newer Paint Vault release.
4. Put images in `images/` and record each one in `assets.json` with its hash, for example from `shasum -a 256 images/my-scheme.jpg`.
5. Test the plugin with **Upload .zip** in a test vault. It reports the first validation error with the item and field.
6. Publish it as a public GitHub repository with the files at its root.

To release a change:

- Edit the files and raise `version`. Nothing reaches users until `version` changes.
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
