# Paintwarden demo plugin

A small, complete plugin for trying out and learning Paintwarden plugins. It has 8 made-up paints, 2 color schemes and 1 miniature template, plus images and a logo. Together they cover every kind of entry the format allows.

Beta testers: [download the ready-made demo ZIP](https://github.com/moonryc/paintwarden/releases/download/v1.0.0-beta.1/paintwarden-demo-plugin.zip), then choose it in **Settings → Plugins → Upload .zip**. The release asset becomes available when that beta is published publicly. These are fictitious colors, not paints you can buy.

Developers can reproduce the exact ZIP with `node scripts/package-demo-plugin.mjs`. You can also copy these files to the root of a public GitHub repository and add that repository. The application repository root and raw sub-path URLs are not plugin repository roots.

[docs/plugins.md](../../docs/plugins.md) explains how plugins are installed, updated and removed. [docs/source-format.md](../../docs/source-format.md) specifies every file and field.

If you copy this folder to start your own plugin, replace every ID with a new UUID first.

`apps/paintwarden/lib/demo-plugin.test.ts` installs this plugin on every test run. When you change these files, update the image hashes in `assets.json` and the counts in that test.
