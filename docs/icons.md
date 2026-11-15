# App icon assets

The paint-pot brand comes from `apps/paintwarden-web/public/favicon.svg`. Do not add a white background, transparent canvas inset, or a second rounded tile around the artwork.

## Outputs and platform masks

`scripts/generate-icons.mjs` generates all bitmap/container outputs directly from the SVG, independently at each size (no upscaling):

- `apps/paintwarden-electron/build/icon.icon/`: genuine Icon Composer document, opaque charcoal root fill plus a 1024px transparent SVG paint-pot layer. macOS owns the background corner mask and modern appearances. The foreground SVG **must** declare 1024px dimensions; a 64px intrinsic SVG would render as a tiny pot on the full-size tile.
- `build/icon.icns`: complete legacy macOS representations, 16/32/128/256/512 points at 1x and 2x, up to 1024px. Rounded corners are transparent, but the tile reaches every canvas edge. PNG-compressed ICNS entries avoid platform-dependent conversion.
- `build/icon.png`: 1024px legacy rounded tile.
- `build/icon.ico`: Windows 32-bit RGBA PNG-compressed frames at 16, 20, 24, 32, 40, 48, 64, 96, 128 and 256px. No white or transparent inset frame.
- Web `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png`: opaque charcoal square backgrounds, because launchers apply their own corner mask. These already had no white padding; regeneration preserves their design.
- Web `icon-maskable-512.png`: opaque square, smaller centered pot from `icon-maskable.svg`; all foreground pixels fit inside the PWA 40%-radius safe circle. This intentional foreground safe area is not erroneous outer canvas padding.

The SVG favicons remain rounded standalone variants. The site favicon is unchanged.

## Reproduce and check

Use the pinned Node version from `.nvmrc` (22.22.2 at this change):

```sh
node scripts/generate-icons.mjs
node scripts/generate-icons.mjs --check --preview /tmp/paintwarden-icons/icon-contact-sheet.png
node --test scripts/generate-icons.test.mjs
```

The pixel tests check all ICNS/ICO frames, correct container offsets, canvas-edge coverage (allowing vector antialiasing), absence of white padding, PWA opacity and safe zone, committed-byte reproducibility, and the afterPack fallback replacement. Apple `iconutil -c iconset build/icon.icns` also accepts all ten generated macOS representations.

On macOS with full Xcode 26 or newer selected:

```sh
node scripts/check-native-icons.mjs --output /tmp/paintwarden-icons/native
node scripts/check-packaged-icons.mjs /path/to/Paintwarden.app
```

The first command uses the **installed electron-builder compiler**, producing `Assets.car` and Apple's fallback ICNS in the evidence directory. It invokes the selected Xcode's embedded Icon Composer renderer for Default/Dark 1024px and Default 128/64/32/16px images, asserts edge coverage/no white container and visible brand colors, then writes `native-icon-contact-sheet.png` and a JSON report. These are native **rendered assets**, not a Finder/Dock screenshot or a claim of a completed native UI smoke test. Xcode's `developer/usr/bin/ictool` is the asset compiler; the renderer is inside `Contents/Applications/Icon Composer.app/Contents/Executables/ictool`.

The packaged checker verifies `CFBundleIconName=Icon`, `CFBundleIconFile=icon.icns`, compiled catalog header, all ten correctly sized legacy representations, and equality to the tested complete fallback. It does not modify the app or validate a signature.

## Packaging integration

Use `mac.icon: "build/icon.icon"` and `win.icon: "build/icon.ico"`. Keep the complete `build/icon.icns` for legacy OS support.

Call `build/afterpack-icons.cjs` from the existing afterPack hook **before signing**. Xcode 27.2's `.icon` compiler emits a fallback with only 16/32/128/256px representations. The helper replaces `Contents/Resources/icon.icns` with the complete generated 16..1024px fallback while leaving `Assets.car` and Info.plist unchanged; non-macOS builds are skipped. Missing output paths fail rather than silently omitting the fallback.

No app minimum OS version needs to be raised merely to include a modern catalog: electron-builder's `--minimum-deployment-target 26.0` is for this catalog compilation; the complete ICNS remains the legacy fallback.

## First-party support evidence

Retrieved and inspected on 2026-11-15:

- Versioned maintainer-published package: <https://registry.npmjs.org/app-builder-lib/-/app-builder-lib-26.18.1.tgz>. Its `out/macPackager.js` SHA-256 is `6642de27bb4ce235b0e53c6a6ff63cb6aaefbb67b05debd16aa8f9d5197d9de6`, matching the installed file. `applyCommonInfo` recognizes `mac.icon` ending in `.icon`, writes compiled `Assets.car`, sets `CFBundleIconName` to `Icon`, and keeps `CFBundleIconFile`. `out/options/macOptions.d.ts` explicitly accepts `.icns` and `.icon`. `out/util/macosIconComposer.js` checks `actool >=26.0.0` and invokes `actool --platform macosx --minimum-deployment-target 26.0`. The nominal GitHub `v26.18.1` tag URL was unavailable; the exact versioned npm publication is the version-specific evidence.
- Current source for comparison: <https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/macPackager.ts>.
- Apple guidance: <https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer>. The local Xcode 27.2 macOS Icon Composer template supplies `fill`, `groups`, and `supported-platforms.squares=["macOS"]`; real `actool` compilation confirms the generated document is valid, without opening a GUI.
- Runner inventories: <https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md> and <https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md>. The retrieved macOS 15 image has Xcode 16.4 **default** despite installed Xcode 26.x; select >=26 explicitly. The retrieved macOS 26 image defaults to 26.6. Do not infer the active compiler from the `macos-latest` label.

For CI, select a supported Xcode before packaging, then print `xcodebuild -version` and `xcrun actool --version`. For example, `maxim-lobanov/setup-xcode@ed7a3b1fda3918c0306d1b724322adc0b8cc0a90` with `xcode-version: latest-stable` (commit resolved from the action's maintainer-owned `v1` annotated tag on the retrieval date). Alternatively explicitly select an installed Xcode >=26 with `xcode-select`/`DEVELOPER_DIR`. Command Line Tools alone are insufficient.
