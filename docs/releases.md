# Beta and stable releases

The first release is a **beta for friends and family** on the public
[`moonryc/paintwarden` GitHub Releases](https://github.com/moonryc/paintwarden/releases).
Do the publication/privacy/security/notices checks before making the repository public.
Do not put a GitHub token in the app. The product website is separate from release hosting.

## Cut a beta

1. Use the exact Node version in `.nvmrc` (currently 22.22.2), and `npm ci`.
2. Set the same version, for example `1.0.0-beta.1`, in the root and **all** workspace
   manifests. Keep internal workspace dependency ranges prerelease-compatible (`*`).
   Run `npm install --package-lock-only --ignore-scripts` and commit the updated lockfile too.
   Do not change the frozen database migration baseline when bumping versions.
3. Write a plain-language `## [1.0.0-beta.1] - YYYY-MM-DD` section in `CHANGELOG.md`,
   above earlier releases. Use `### Added`, `### Changed`, `### Fixed` and
   `### Known limitations` as appropriate. Tell testers about backup requirements,
   incompatible data changes and signing limitations, not just technical changes.
   `Unreleased` is never used as a release body.
4. Run `node scripts/check-release-version.mjs v1.0.0-beta.1` and
   `node scripts/release-notes.mjs v1.0.0-beta.1`. Run all quality gates, production
   browser E2E and packaged launch smokes. Push the reviewed release commit.
5. From Actions, run **Release → Run workflow** on that branch. A dispatch is a
   **dry run only**, even on main: it runs Quality, builds actual DMG/ZIP/NSIS
   installers and update metadata, launches both packages, and retains artifacts;
   its publish job is unconditionally skipped. Review the artifacts and signing
   output. Unsigned builds are intentional when complete credentials are absent.
6. Only after review, an authorized maintainer creates and pushes `v1.0.0-beta.1`.
   Tag pushes run the same gates, build with `--publish never`, then a separate,
   tag-only job creates the GitHub Release with `--prerelease --latest=false`.
   The body is exactly that version's changelog section. The same notes are embedded
   in updater YAML. All uploads happen after both platforms pass, not mid-build.
   The publish job refuses to overwrite an existing Release. Do not move published tags.

The accepted release formats are stable `MAJOR.MINOR.PATCH` and beta
`MAJOR.MINOR.PATCH-beta.N` (no leading zeroes). Other prerelease channels and build
metadata are deliberately not supported yet. App and server versions must match
exactly, including `-beta.N` in remote mode.

## Update channels and promotion

- A beta app explicitly uses `channel: beta`, `allowPrerelease: true`, and
  `allowDowngrade: false`. It receives newer betas **and a subsequent stable release**.
- A stable app uses `channel: latest`, `allowPrerelease: false`, and
  `allowDowngrade: false`. It only uses GitHub's latest stable release, never a beta.
  Installing a beta is an explicit manual choice; there is no hidden opt-in toggle.
- electron-builder generates only `beta[-mac].yml` for beta builds and
  `latest[-mac].yml` for stable builds. GitHubProvider selects versions from the
  release feed or `/latest`; a beta client follows a stable promotion via its
  built-in `latest.yml` fallback. `generateUpdatesFilesForAllChannels` is off
  (GitHub's provider does not use its generic-server channel fan-out).
- Release notes appear as bounded plain text in the ready-to-restart prompt and
  remote-version consent dialog. No release-provided HTML is executed.
- An unsigned Mac app cannot auto-update; download and install the next version
  manually. Signed/notarized Mac apps and Windows apps use the normal updater.

To promote `1.0.0-beta.N` to stable, **build a new coordinated `1.0.0` release**:
change every version and the lockfile, add its own changelog section, repeat the
checks/dry run and push the new `v1.0.0` tag. Do not relabel a beta binary or simply
untick “pre-release” on an old beta Release. Stable `v1.0.0` is published as latest;
existing beta clients can graduate to it, then stop receiving beta releases.
Back up before changing versions. Automatic downgrade is disabled; an older app
may not support a newer vault's schema. See [data compatibility](data-compatibility.md).

## Signing (optional, complete sets only)

The default is **unsigned** (properly ad-hoc-signed on macOS), with no signing-secret failure. Partial credential
sets also deliberately produce unsigned builds. Check the packaging log before
sharing a build as signed. Invalid complete credentials fail signing rather than
silently downgrading security. Signed paths require a real release acceptance test;
unit tests and unsigned CI do not prove notarization or certificate trust.

macOS signing and notarization opt in when **all five** repository secrets exist:

| Secret                        | Value                                              |
| ----------------------------- | -------------------------------------------------- |
| `MAC_CERTIFICATE_P12_BASE64`  | Base64 Developer ID Application `.p12` certificate |
| `MAC_CERTIFICATE_PASSWORD`    | Certificate export password                        |
| `APPLE_ID`                    | Apple Developer account ID                         |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from account.apple.com       |
| `APPLE_TEAM_ID`               | Developer Team ID                                  |

Windows signing opts in with `WINDOWS_CERTIFICATE_P12_BASE64` and
`WINDOWS_CERTIFICATE_PASSWORD` (a code-signing certificate and its export password).
Hardware/cloud-only certificates need a separately reviewed signing integration.
No certificate/token is bundled. Local packaging uses these same environment variable
names. Automatic discovery is disabled for unsigned builds. With complete Mac
credentials, builder discovers the imported identity in its temporary keychain;
signing is required. Ambient identity names/Windows certificate aliases are cleared
or replaced with the selected credentials, so unrelated local credentials cannot
silently change the chosen policy.
The current Mac artifact targets Apple silicon; Windows targets x64.

Unsigned Mac builds explicitly use builder's `mac.identity: "-"`, rather than leaving
Electron's stale linker signature after modifying the bundle. Builder signs native
server binaries, addons, dylibs, frameworks and helpers inside-out with the existing
hardened-runtime entitlements, then seals the app. Ad-hoc signing proves bundle
integrity, **not** developer identity or notarization. The signed credential path
still requires Developer ID signing and notarization; no failure falls back to ad-hoc.
The after-sign hook and Quality CI require `codesign --verify --deep --strict`,
non-linker signatures/hardened runtime on every Mach-O, V8/native-loading entitlements,
and an explicit Gatekeeper `rejected` assessment for ad-hoc apps (never damaged).
Notices and the separate dynamically loaded libvips are checked again after signing.
Release CI additionally copies the app from a quarantined DMG to a temporary folder,
quarantines that copy, repeats signature/notices checks, launches it with an isolated
profile, and checks the ZIP copy too. Because an ad-hoc app is intentionally
rejected until a user grants Open Anyway consent, automation removes quarantine
**only from its already-verified disposable copy** before the runtime smoke. This
is not evidence of user consent or notarization; no system-wide policy is changed. Reproduce with:

```sh
node scripts/check-mac-signature.mjs dist/electron/mac-arm64/Paintwarden.app --adhoc
node scripts/check-mac-installers.mjs dist/electron
```

Mac packaging requires Xcode 26+ (`xcrun actool --version`) for the modern Icon Composer
`build/icon.icon`. It compiles to Assets.car, preventing macOS 26/27 from placing the
legacy artwork in an unwanted light container. A complete legacy `.icns` is installed
before signing for older macOS, Finder and the DMG. CI selects current stable Xcode;
missing/old tooling fails packaging rather than silently shipping the wrong icon.
See [desktop icons](icons.md) for regeneration and pixel checks.


Unsigned friends-and-family builds may require macOS **Privacy & Security → Open
Anyway**, or Windows SmartScreen **More info → Run anyway**. Do not tell testers to
disable system-wide protections. Verify the project's GitHub download source first.

## Retention

Published version tags, changelog sections, installer assets, blockmaps and updater
YAML are immutable release records; this pipeline never deletes them. Keep the
current stable release and its update metadata available. Keep beta assets at least
until the next stable release has been available for 90 days; review any later
manual cleanup for beta testers still using them and links in update metadata.
Do not reuse a version number, replace an existing asset, or delete only half a
release. A withdrawn unsafe release needs explicit maintainer review and a clear
notice, not an automatic cleanup rule. GitHub Actions diagnostic artifacts expire
after 7 days; dry-run/release build artifacts after 14 days. These expirations do
**not** delete GitHub Releases or users' local backups.

## Repeat the CI smokes locally

```sh
npm run build
npx playwright install chromium
npm run e2e:browser
node scripts/package-desktop-server.mjs electron
npm run dist --workspace paintwarden-electron -- --dir --publish never
npm run e2e:native
```

Native launch testing needs a macOS or Windows desktop session (CI runners provide
one), not Linux xvfb. Browser E2E runs headless on Linux. Tests generate synthetic
photos/data and use isolated temporary vaults; they do not use personal paths,
production ports or catalog downloads. `E2E_ARTIFACTS_DIR` changes the evidence
output directory (native default under ignored `outputs/`; browser default in the OS temp directory). Profiles, backups, traces,
logs and screenshots contain only fixture data and are retained for diagnosis.
The launch smoke is intentionally not an exhaustive native interaction/signing test.
