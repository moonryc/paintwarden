# Catalog source format, version 1

This is the formal specification of the plugin files. [Plugins](plugins.md) explains how the app installs, updates and removes them. [`examples/demo-plugin/`](../examples/demo-plugin/) is a complete example.

A catalog source (shown in the app as a plugin) adds paints, color schemes and miniature templates to Paintwarden. It is a public GitHub repository with these files at its root:

| File           | Required | Contents                                                    |
| -------------- | -------- | ----------------------------------------------------------- |
| `source.json`  | Yes      | The manifest: name, version and dependencies.               |
| `catalog.json` | Yes      | The paints, schemes and templates.                          |
| `assets.json`  | Yes      | A record of every image the catalog uses.                   |
| `images/`      | If used  | The image files listed in `assets.json`.                    |
| `logo.svg`     | No       | A standalone SVG document, up to 100 KB, shown as the logo. |

Paintwarden reads the default branch. It downloads `catalog.json` and the images only when `version` in `source.json` changes.

## Versions and updates

An installed plugin only moves forward:

- **From GitHub.** The repository identifies the plugin. A higher `version` updates it; the same version changes nothing. If the repository's `version` drops below the installed one, Paintwarden keeps the installed version and shows an error in Settings → Plugins.
- **From a .zip.** The same files can be uploaded as a .zip, at its root or inside one folder. The plugin's `name` identifies it, ignoring case, accents and punctuation, so `My Schemes` and `my-schemes` are the same plugin. A .zip with a higher `version` replaces the installed plugin, the same version changes nothing, and a lower version is refused. To go back to an older version, remove the plugin first. A plugin installed from a .zip is never checked online, and other plugins can't list it in `dependencies`.

## Validation rules

Paintwarden rejects a source that breaks any rule below, and shows which item and field is wrong. There are no warnings and nothing is skipped:

- Every object may contain only the fields listed for it. An unknown field is an error, so a field that a later format adds can never be ignored silently by an older app.
- Required fields must be present. Optional fields may be left out or, where noted, set to `null`.
- Text fields must be strings within the stated length. Fields marked _non-empty_ must contain more than whitespace.

A source that needs features from a newer Paintwarden release should set `minimumAppVersion`. Older apps then explain that they need updating instead of rejecting the source as invalid.

## IDs

Every paint, scheme, template and scheme entry has an ID. Recipes, backups and other sources refer to these IDs, so **never change an ID after publishing it**.

- An ID is a random UUID in lowercase, such as `0f8b3c1e-2d4a-4b6c-9e7f-1a2b3c4d5e6f`. Generate a new one for each item (for example with `uuidgen | tr A-Z a-z` or `crypto.randomUUID()`); don't derive them from names, so two sources never collide by accident.
- Paintwarden stores the owner's own items as `user:` followed by a UUID. Sources use bare UUIDs, so they can never take one of those IDs.

Two sources may ship the same paint ID only when the paint's brand, range, name and color match. To build on another source's paints or schemes, list that source in `dependencies` and refer to its IDs.

## source.json

```json
{
  "formatVersion": 1,
  "name": "My grimdark schemes",
  "version": "1.0.0",
  "license": "CC-BY-4.0",
  "attribution": "Recipes by Jane Painter",
  "minimumAppVersion": "1.0.0",
  "dependencies": [{ "repository": "github:example/citadel-paints", "minimumVersion": "1.2.0" }],
  "catalog": "catalog.json",
  "assets": "assets.json"
}
```

| Field               | Required | Rules                                                                                   |
| ------------------- | -------- | --------------------------------------------------------------------------------------- |
| `formatVersion`     | Yes      | `1`.                                                                                    |
| `name`              | Yes      | Non-empty text, up to 120 characters.                                                   |
| `version`           | Yes      | `major.minor.patch`. Increase it whenever the catalog or images change.                 |
| `license`           | No       | Up to 100 characters, such as an SPDX identifier. Shown in Settings → Plugins.          |
| `attribution`       | No       | Up to 1,000 characters crediting the data's authors. Shown in Settings → Plugins.       |
| `minimumAppVersion` | No       | `major.minor.patch`. Older Paintwarden releases refuse the source with a clear message. |
| `dependencies`      | Yes      | A list, possibly empty. Each item has `repository` and optionally `minimumVersion`.     |
| `catalog`           | Yes      | `"catalog.json"`.                                                                       |
| `assets`            | Yes      | `"assets.json"`.                                                                        |

A dependency's `repository` is a GitHub URL or `owner/name` shorthand, and `minimumVersion` is `major.minor.patch`. Paintwarden installs dependencies first.

## catalog.json

The file is an object with exactly three lists: `paints`, `schemes` and `templates`. Any list may be empty.

### Paints

```json
{
  "id": "6c1d2a4e-8f3b-4c7a-9d2e-5b1f0a3c4d8e",
  "brand": "Citadel",
  "range": "Base",
  "name": "Abaddon Black",
  "type": "BASE",
  "colorHex": "#171717",
  "sourceUrl": "https://www.warhammer.com/",
  "sourceLabel": "Citadel catalog"
}
```

| Field          | Required | Rules                                                                                                                               |
| -------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | Yes      | An ID.                                                                                                                              |
| `brand`        | Yes      | Non-empty, up to 120 characters.                                                                                                    |
| `range`        | Yes      | Non-empty, up to 120 characters. The brand's own range name.                                                                        |
| `name`         | Yes      | Non-empty, up to 200 characters.                                                                                                    |
| `type`         | No       | One of `PRIMER`, `BASE`, `LAYER`, `SHADE`, `CONTRAST`, `TECHNICAL`, `DRY`, `AIR`, `METALLIC`, `VARNISH`, `INK`, `OTHER`, or `null`. |
| `discontinued` | No       | `true` when the paint is no longer made. Defaults to `false`.                                                                       |
| `colorHex`     | No       | `#rrggbb`, or `null`.                                                                                                               |
| `sourceUrl`    | No       | An `https` URL, or `null`.                                                                                                          |
| `sourceLabel`  | No       | Up to 200 characters, or `null`. Defaults to the source's name.                                                                     |

`type` maps each brand's range onto a shared list, so filters work across brands. For example, Vallejo Game Color Wash and Citadel Shade are both `SHADE`.

### Schemes

```json
{
  "id": "a3e9c7b1-5d2f-4e8a-b6c4-1f7d9e2a0b3c",
  "name": "Ultramarines",
  "category": "BLUE",
  "entries": [
    { "id": "e1b4c8d2-3a6f-4b9e-8c1d-7f2a5e0b9c4d", "type": "MILESTONE", "label": "GET READY!" },
    { "id": "4f7a2c9e-1b5d-4e3a-a8c6-9d0b2e7f1a5c", "type": "STEP", "label": "BASECOAT" },
    {
      "id": "9c2e5a8b-7d1f-4a4c-b3e9-6f0d1c8a2b7e",
      "type": "PAINT",
      "paintId": "d8b3f1a6-2c9e-4d5b-a7f2-3e6c0b9d1a4f"
    },
    { "id": "2b8d6f3a-9e4c-4c1b-8f5d-0a7e3c2b6d9f", "type": "IMAGE", "imageUrl": "images/ultramarines.jpg" }
  ]
}
```

| Field      | Required | Rules                                                                                                                                                   |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`       | Yes      | An ID.                                                                                                                                                  |
| `name`     | Yes      | Non-empty, up to 200 characters.                                                                                                                        |
| `category` | Yes      | One of `RED`, `PINK`, `ORANGE`, `YELLOW`, `GREEN`, `TURQUOISE`, `BLUE`, `PURPLE`, `BROWN`, `BLACK`, `GREY`, `WHITE`, `GOLD`, `SILVER`, `BONE`, `FLESH`. |
| `entries`  | Yes      | An ordered list of entries.                                                                                                                             |

Every entry has an `id` (a UUID, unique within its scheme) and a `type`. The other fields depend on the type:

| `type`      | Fields                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `STEP`      | `label`: a recipe step (listed below).                                                                                                        |
| `PAINT`     | `paintId`: the ID of a paint in this source or a dependency. A paint must come after a `STEP`, with no `MILESTONE` in between.                |
| `MILESTONE` | `label`: `GET READY!`, `YOU'RE READY!`, `GET BATTLE READY!`, `YOU'RE BATTLE READY!`, `GET PARADE READY!` or `YOU'RE PARADE READY!`.           |
| `IMAGE`     | `imageUrl`: an image path. Optional: `thumbnailUrl` (an image path or `null`), and `imageType` and `method` (up to 40 characters, or `null`). |

The recipe steps, in painting order, are `PRIMER`, `UNDERCOAT`, `SPRAY`, `BASECOAT`, `APPLY`, `SHADE`, `WASH`, `LAYER`, `DRYBRUSH`, `GLAZE`, `HIGHLIGHT`, `EDGE_HIGHLIGHT`, `DETAIL`, `TECHNICAL`, `BASING`, `VARNISH` and `OTHER`.

### Templates

```json
{
  "id": "7e4a1c9d-3b8f-4f2e-9a6c-5d1b8e0f2a7c",
  "name": "Intercessor",
  "manufacturer": "Games Workshop",
  "faction": "Space Marines",
  "categories": ["Warhammer 40,000"],
  "imageUrl": "images/intercessor.jpg",
  "schemeIds": ["a3e9c7b1-5d2f-4e8a-b6c4-1f7d9e2a0b3c"],
  "paints": [
    {
      "paintId": "d8b3f1a6-2c9e-4d5b-a7f2-3e6c0b9d1a4f",
      "step": "BASECOAT",
      "notes": "Two thin coats",
      "sortOrder": 0
    }
  ]
}
```

| Field          | Required | Rules                                                                                                                                                        |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`           | Yes      | An ID.                                                                                                                                                       |
| `name`         | Yes      | Non-empty, up to 200 characters.                                                                                                                             |
| `manufacturer` | Yes      | Up to 200 characters; may be empty.                                                                                                                          |
| `faction`      | Yes      | Up to 200 characters; may be empty.                                                                                                                          |
| `categories`   | Yes      | A list of non-empty labels, up to 120 characters each.                                                                                                       |
| `imageUrl`     | No       | An image path, or `null`.                                                                                                                                    |
| `schemeIds`    | Yes      | IDs of schemes in this source or a dependency, each listed once.                                                                                             |
| `paints`       | Yes      | The template's recipe. Each item has exactly `paintId`, `step` (a recipe step), `notes` (up to 2,000 characters; may be empty) and `sortOrder` (an integer). |

A template may use the same paint in several steps, but only once within a step.

## assets.json and images

`assets.json` maps each image path to a record. Every image path used in `catalog.json` must appear here.

```json
{
  "images/ultramarines.jpg": {
    "sha256": "4f0c…64 hex characters…",
    "originalUrl": "https://example.com/ultramarines.jpg"
  }
}
```

- An image path is `images/` followed by a file name of letters, digits, `.`, `_` and `-`, ending in `.avif`, `.gif`, `.jpg`, `.jpeg`, `.png` or `.webp`.
- `sha256` is required: the file's SHA-256 hash, in hex. Paintwarden checks it after downloading.
- `originalUrl` is optional text recording where the image came from.

## Sharing from the app

**Settings → Plugins → Create plugin** exports your own paints, schemes and templates as a ready-to-publish repository in this format. Your items keep the UUID from their `user:` ID, so exporting again gives the same IDs. Items from other sources keep their IDs and become dependencies.

## Installing from a .zip

**Settings → Plugins → Upload .zip** installs a source without publishing it. The zip holds the same files as a repository: either at its root, as **Create plugin** exports them, or inside one folder, as GitHub's **Download ZIP** packs a repository. The source's `name` identifies it, so uploading a zip with the same name and a newer `version` updates it. Dependencies are still installed from GitHub. An uploaded source isn't linked to a repository, so the app never checks it for updates.
