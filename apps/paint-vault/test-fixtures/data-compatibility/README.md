# Synthetic data compatibility fixtures

These are test data, not a bundled catalog or real owner's vault. Names/text/IDs are invented. `pixel.png` is a generated 1×1 transparent PNG. The synthetic account password/token hashes in SQLite are literal non-credential placeholders. The fixture rows and generated pixel are dedicated to the public domain (CC0-1.0).

| File                       | Origin / purpose                                                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v1.sqlite`                | Real application schema/journal from `1f1c4e9` migration 0000; populated synthetically, one row in each vault section except two paints, plus placeholder account/session. No derived change log or photos stored in SQLite. |
| `v1-tables.json`           | Independent explicit input rows/expected ZIP1 data; all fields represented, including nulls, booleans and JSON arrays.                                                                                                       |
| `zip-v1.zip`               | Real ZIP1 exporter with appVersion `1.0.0`, fixed fixture clock, all sections, one referenced original shared by miniature/template/source/scheme.                                                                           |
| `legacy-v3.json`           | Genuine historical exporter output with synthetic inputs, from archive revision `47aa2781b1827ad92285fcb0fc73e39d232fcfa1` (immediately before the v1 format freeze).                                                        |
| `legacy-v4-synthetic.json` | **Synthetic reader-contract derivative**, changing only v3's version field to 4. Not an authentic v4 exporter artifact. No v4 writer was found via all-ref history searches.                                                 |
| `released-migrations.json` | Immutable v1 journal identity, SQL SHA256 and Drizzle snapshot SHA256; later released migrations append to this ledger.                                                                                                      |
| `provenance.json`          | SHA256 of every fixture and the archived source/full GET body, source revision, and fixed fixture clock.                                                                                                                     |

## Generation

Maintainer-only command from the repository root, using Node 22.22.2 and the installed dependencies:

```sh
node --import tsx scripts/generate-data-compatibility-fixtures.mjs /path/to/paint-tracker-archive
```

This **overwrites baseline artifacts**, so do not run it as a test or to accept changed behavior. Preserve the checked-in goldens when adding migrations. The script checks that the backup implementation/contract still match `1f1c4e9` and appVersion is still `1.0.0`; after exporter changes, use an isolated baseline checkout with this generator available, not a new exporter silently writing old goldens. Never rebaseline a released migration hash. Historical source must remain accessible by the recorded revision.

The script reads only tracked archive source via `git show`/`git ls-tree`; it never opens the archive's `data/`, quarantined data or old catalog files. It creates temporary SQLite databases and a temporary `DATA_DIR`, does not start a server or use ports, and removes its own temporary directory on completion. Date is pinned to `2023-11-14T22:13:20.000Z` for fixture stability; this is **not** the historical release/export date.

For the v3 artifact it applies all SQL migrations from that exact archive revision to a temporary database, loads that revision's real Drizzle schema, and inserts the synthetic rows. The exact historical `GET` function body is executed unchanged. Only surrounding imports are rebound to that historical schema, an injected temporary DB accessor and the synthetic pixel image loader; the unused POST/restore imports are omitted. Source/body hashes record this boundary. Consequently v3 is historical **exporter-produced**, not JSON handcrafted to satisfy today's converter. Old standalone recipe templates are empty; embedded miniature-template recipes and images, inventory, schemes/dividers, model recipe/steps and substitution relationships are nonempty. JSONv4's provenance remains explicitly weaker.

`backup-golden.test.ts` verifies fixture hashes before use. It does not regenerate expected values from the restore converter. New default timestamps in legacy rows must fall within the actual restore interval; preserved historical timestamps and every other persisted field are exact. Randomly allocated UUIDs/image keys are checked for validity and image byte identity before normalization. Database-upgrade checks preserve all original columns/rows while permitting new columns/tables and appended journal rows. Application schema equality excludes the internal migration table's formatting differences between Drizzle and the current transaction wrapper.

See [data compatibility policy](../../../../docs/data-compatibility.md) for forward-only migration, backup versions, recovery and downgrade limitations.
