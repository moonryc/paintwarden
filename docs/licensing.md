# Project licensing maintenance

Paint Vault is source-available under [PolyForm Noncommercial 1.0.0](../LICENSE),
not under an OSI-approved license. The [trademark policy](../TRADEMARKS.md) is separate.
See [CONTRIBUTING.md](../CONTRIBUTING.md) for the Contributor License Agreement.
Third-party components retain their own licenses; the project license does not
replace those licenses.

## Official text provenance

The official PolyForm project supplied the text:

- Repository: <https://github.com/polyformproject/polyform-licenses>
- Immutable source: <https://raw.githubusercontent.com/polyformproject/polyform-licenses/76a278c402bc43b8d2b561da140b0f3e17263015/PolyForm-Noncommercial-1.0.0.md>
- Original file SHA-256: `c0ea4a896d2c8c394b29f9427589996db826cd501c512279ff0ed3ef48fabbe5`

`LICENSE` contains those exact bytes followed by a blank line and the project's
`Required Notice:` line, as described in the license's Notices section. Do not
reformat the official text. `scripts/check-project-license.test.mjs` verifies its
hash, the notice, workspace metadata, and distribution configuration.

The canonical PolyForm webpage returned HTTP 404 when retrieved on 2026-11-14;
the official repository was used instead. The URL inside the license is kept
unchanged.

## Distribution

- Every root/workspace `package.json` and corresponding lock entry carries SPDX
  identifier `PolyForm-Noncommercial-1.0.0`, including Electron app metadata.
- The desktop package copies `LICENSE` into its Resources directory.
- Docker copies it to `/app/LICENSE`.
- Settings → Help & About imports the same root file as bundled text, so reading
  it requires no network access. Legal text stays English; surrounding UI strings
  are translated into all 13 supported languages.
- The website footer links the repository's `LICENSE` and summarizes noncommercial
  use in all 13 languages.

## Dependency compatibility screen

Use `npm ls --omit=dev --all --json --long` after `npm ci` to inspect the installed
production npm dependency tree, and inspect non-dev entries in `package-lock.json` for
other target platforms. Read the actual license file when metadata is missing.
In the 2026-11-14 review, `busboy` and `streamsearch` had no license field but their
LICENSE files contained MIT terms.

The production npm screen found permissive licenses, OFL font licenses, MPL-2.0
file-level copyleft, and LGPL-3.0-or-later native libvips components; no GPL/AGPL
npm dependency was found. sharp is Apache-2.0 and dynamically links libvips.
These components keep their own terms, and do not require Paint Vault's own code
to be distributed under GPL. Do not apply PolyForm restrictions to third-party
components or their separately licensed source files.

This screen is not the complete third-party notices or LGPL compliance work.
The separate LEG-1 task still needs to cover all actually shipped npm/native
libraries, fonts, Electron/Chromium, Node, and WASM, including required notices
and source/relinking materials. Do not treat this license change as satisfying
those obligations.

This document and the implementation report are not legal advice. Consider a
legal review before commercializing the project.
