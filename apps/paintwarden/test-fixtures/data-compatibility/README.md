# Synthetic data compatibility fixtures

These are new-brand **synthetic pre-release fixtures**, not historical exporter artifacts, evidence of a published release, a bundled catalog or a real owner's vault. Names/text/IDs are invented. `pixel.png` is a generated 1×1 transparent PNG. SQLite account password/token hashes are literal non-credential placeholders. Fixture rows and the generated pixel are dedicated to the public domain (CC0-1.0).

| File                       | Origin / purpose                                                                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v1.sqlite`                | Frozen application schema/journal from baseline `1f1c4e9` migration 0000, newly populated synthetically; one row per vault section except two paints, plus placeholder account/session. No photos or derived change log.                        |
| `v1-tables.json`           | Explicit synthetic input rows/expected ZIP1 data; all fields represented, including nulls, booleans and JSON arrays.                                                                                                                            |
| `zip-v1.zip`               | Synthetic `paintwarden-backup` ZIP1 manifest encoded by the current ZIP writer, appVersion `1.0.0`, fixed clock, all sections, and one referenced original shared by miniature/template/source/scheme. Not captured from a historical exporter. |
| `released-migrations.json` | Immutable v1 journal identity, SQL SHA256 and Drizzle snapshot SHA256; later released migrations append to this ledger.                                                                                                                         |
| `provenance.json`          | Synthetic origin, current generator/contract source hashes, fixture hashes and fixed fixture clock. No historical-exporter claim.                                                                                                               |

## Generation and verification

Maintainer-only command from the repository root, using Node 22.22.2 and installed dependencies:

```sh
output="$(mktemp -d)"
node --import tsx scripts/generate-data-compatibility-fixtures.mjs "$output"
for file in v1.sqlite zip-v1.zip v1-tables.json pixel.png released-migrations.json provenance.json; do
  cmp "apps/paintwarden/test-fixtures/data-compatibility/$file" "$output/$file" || exit 1
done
rm -r "$output"
```

The generator requires an **empty directory outside the repository** and refuses overwrites. It reads the current frozen SQL/snapshot/journal and validates them against the unchanged baseline ledger before applying only migration 0000 to temporary SQLite. It never rewrites the SQL, snapshot, journal or release ledger. It uses explicit synthetic rows and the ZIP1 contract, not a historical checkout/archive or a running server. No personal data directories or ports are used. Temporary working files are removed on completion. The fixture clock `2023-11-14T22:13:20.000Z` is a deterministic test value, **not** a release/export date; ZIP metadata is also fixed independently of local timezone.

The pre-release rebrand explicitly replaced the synthetic backup artifacts and provenance once. This is **not** permission to refresh released fixtures when behavior changes. Preserve checked-in goldens when adding migrations. Never overwrite fixtures or rebaseline released migration hashes to make failing tests pass; new contracts require new fixtures and explicit review. Updated generator/contract source hashes require honest review even if data bytes match.

`backup-golden.test.ts` checks fixture hashes before use, restores ZIP1 with Replace/Merge/Replace, compares all fields/images and verifies destination owner/session preservation. Non-ZIP uploads, unknown identifiers and unsupported versions must reject without mutation. Database-upgrade checks preserve all original columns/rows while permitting new columns/tables and appended journal rows. Application schema equality excludes internal migration table formatting differences between Drizzle and the current transaction wrapper.

See [data compatibility policy](../../../../docs/data-compatibility.md) for forward-only migration, recovery and downgrade limitations.

## Additive folders / ZIP2 contract

`zip-v2-folders.zip` and `v2-folders-tables.json` add four invented folders (nested miniature projects and nested template folders) and membership on the original synthetic items. `provenance-v2-folders.json` records their hashes and current source hashes separately. Original ZIP1, SQLite, tables, pixel, release ledger and provenance remain unchanged. No historical exporter/release claim is made.

For the current contract, generate into an empty outside directory with:

```sh
output="$(mktemp -d)"
node --import tsx scripts/generate-folder-backup-fixtures.mjs "$output"
for file in zip-v2-folders.zip v2-folders-tables.json provenance-v2-folders.json; do
  cmp "apps/paintwarden/test-fixtures/data-compatibility/$file" "$output/$file" || exit 1
done
```

The earlier generator and recorded source hashes describe ZIP1 at its original tree; its version guard intentionally prevents using the current ZIP2 contract to overwrite ZIP1. The golden test upgrades ZIP1 explicitly to root membership and checks ZIP2 Replace/Merge/Replace, shuffled folder ordering, cycle/duplicate/wrong-kind rejection with rollback, image bytes and owner preservation.
