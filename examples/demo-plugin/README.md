# Paintwarden demo plugin

A small, complete plugin for trying out and learning Paintwarden plugins. It has 8 made-up paints, 2 color schemes and 1 miniature template, plus images and a logo. Together they cover every kind of entry the format allows.

To install it, zip this folder and choose the zip in **Settings → Plugins → Upload .zip**. You can also copy these files to the root of a public GitHub repository and add that repository.

[docs/plugins.md](../../docs/plugins.md) explains how plugins are installed, updated and removed. [docs/source-format.md](../../docs/source-format.md) specifies every file and field.

If you copy this folder to start your own plugin, replace every ID with a new UUID first.

`apps/paintwarden/lib/demo-plugin.test.ts` installs this plugin on every test run. When you change these files, update the image hashes in `assets.json` and the counts in that test.
