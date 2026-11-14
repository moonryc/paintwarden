# Data compatibility and recovery

## Frozen v1 baseline: forward only

The v1 application-schema baseline is `apps/paintwarden/drizzle/0000_init.sql` and its original journal entry (timestamp `1794346014629`), frozen from commit `1f1c4e9`. A database's `__drizzle_migrations` rows record the applied migration hashes and timestamps; an app release number is **not** a database schema version.

After release, never edit, renumber, remove or regenerate an applied migration, its journal entry or its schema snapshot. Append a new migration with a later timestamp, including for corrections to earlier migrations. `db/released-migrations.test.ts` checks the frozen SQL/snapshot hashes and journal prefix while permitting later migrations. When another migration is released, append its identity/hashes to the release ledger; do not regenerate the old baseline or overwrite old fixtures to make a failing test pass.

Supported v1 upgrades run forward through `migrateVault` and preserve existing rows and relationships. They must not ask an owner to delete their vault, reset its database or reinstall catalog sources as an ordinary upgrade strategy. SQLite table rebuilds are allowed, but foreign-key validation must succeed inside the same transaction as schema/data/journal updates. A failure rolls them all back and blocks startup; restarting or clicking Retry must not silently mark a failed upgrade healthy.

Database downgrades are unsupported. Do not point an older app at an upgraded database, even if it appears to open. Use a preserved full pre-upgrade data directory with the matching older app, or move forward to a corrected release. There is no reverse-migration/reset escape hatch.

Pre-release databases predating this baseline are not certified for in-place upgrades. Preserve the original data and use the previous working build's export and the legacy import path below; never delete the only working copy. The checked-in v1 database is a generated baseline compatibility fixture, not a database captured from an independently published v1 binary.

## Export/import support

| Container and version                                            | Current read rule | Limitations                                                                                  |
| ---------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| ZIP, `paintwarden-backup`, version **1**                         | Replace and Merge | `backup.json` plus original files under `images/`; Replace requires every supported section. |
| Legacy single JSON, version **3** or **4**                       | Merge only        | Owner records, not a complete vault; reinstall any referenced catalog sources first.         |
| Unknown format, future ZIP version, or other legacy JSON version | Reject            | Do not guess, relabel, or bypass the reader's version checks. Use a compatible newer app.    |

ZIP **1** and legacy JSON **3/4** are separate format histories: JSON4 is not newer than ZIP1 and is not a future ZIP manifest. `appVersion` records the exporter release and `exportedAt` its UTC export time; the container/manifest version selects the reader. Current exports are version-stamped with all three values. Keep the explicit field lists in `lib/backup-format.ts` stable; changing their meaning or stored fields requires a new backup format version and an explicit backward reader, not a silent contract change. An old app is not promised to read a newer backup.

ZIP1 contains all 19 vault-data sections, including installed source metadata, paints, inventory, schemes and their entries, templates/recipes, miniatures, substitutions and all relationships. Replace keeps the **destination owner account and sessions**; credentials, session tokens, migration history and derived change logs are intentionally not exported. Merge keeps existing records rather than overwriting them; children are imported with newly added parents. ZIPs carry referenced original images, not regenerable thumbnails. Missing originals at export can result in cleared optional references or omitted image-required rows; retain a full directory backup as well.

Legacy conversion maps owner paint/scheme IDs to `user:<uuid>`, preserves consistent foreign references, creates recipe-row/entry UUIDs, maps old required milestone prefixes to roles and expands embedded template recipes. Unsupported source/system scheme records are not imported. Legacy files did not include miniature photo bytes; those references are cleared. Embedded template images are restored with fresh keys. Omitted new fields receive current defaults, including newly generated `updatedAt` timestamps. Source-dependent imports can fail until their sources are present. Repeated legacy merges are not promised to be idempotent for IDs that require random remapping.

## Backups and recovering a failed update

Before an update, export a ZIP and keep a **stopped full copy of the entire data directory** (or Docker volume), including its database, originals in `images/`, and other configuration. For desktop, fully quit the app, not just its window. For a server/container, stop it and confirm no process is using that directory before copying. Keep credentials and personal photos private; ZIP exports do not preserve credentials or desktop connection preferences.

Before pending migrations on an existing vault, the server additionally writes a consistent SQLite `VACUUM INTO` recovery copy under `backups/`. Its filename stamps UTC time and the first pending migration, for example `paintwarden-YYYYMMDD-HHMMSS-before-0001_example.sqlite`. The copy contains the applied migration journal and includes database changes still in WAL. Only the newest five matching recovery copies are retained. These are **database-only** backups, not photo backups or a replacement for the full stopped copy.

If an upgrade fails:

1. Record the error and exact recovery-copy path from the server log (desktop: Open logs). Retry alone does not repair faulty migration SQL.
2. Fully quit the desktop app or stop the server/container. Preserve a separate copy of the **entire failed data directory**, including its database and any `-wal`/`-shm` files, before changing anything.
3. With every process stopped, copy the logged pre-migration `.sqlite` recovery file over the vault database (`paintwarden.sqlite`, or the configured database path). Remove that destination database's stale `-wal` and `-shm` sidecars **only while stopped and after preserving them**; do not copy those stale sidecars onto the recovery file. Keep `images/` and the recovery original intact.
4. Start the previous working app against its pre-upgrade copy, or use a corrected migration/release. Verify records and photos before resuming edits. Keep the failed-directory copy and recovery originals until the incident is resolved.

Do not delete/rewrite migration journal rows to force a retry, manually mark failed work applied, or run an older app against an unknown newer schema.

## Golden compatibility checks and provenance

Fixtures live in `apps/paintwarden/test-fixtures/data-compatibility/`; see its [README](../apps/paintwarden/test-fixtures/data-compatibility/README.md). All rows are synthetic and the single pixel is generated test artwork. No catalog dump, owner vault, real credential or user photo was copied. Tests always create a temporary `DATA_DIR`; no development server or production vault is used.

From `apps/paintwarden`, with Node 22.22.2 and installed dependencies:

```sh
node --import tsx --test db/released-migrations.test.ts lib/backup-golden.test.ts
```

The suite upgrades a copy of v1 SQLite through the current real migration folder, checks every historical table/column/row including synthetic account/session rows, compares the resulting application schema to a fresh current database and checks SQLite/FK integrity. It restores ZIP1 with Replace/Merge/Replace, compares every field in all 19 sections and image bytes, and verifies the destination owner survives. Legacy tests compare all supported rows/relations with only documented generated IDs, image keys and missing timestamps normalized; converted ZIPs round-trip exactly. Rejected versions/legacy Replace leave rows, owner and image files unchanged.

The authentic historical fixture is JSONv3 produced by executing the archived exporter GET body against its real historical SQLite schema and synthetic inputs. **No historical v4 writer was found in the archive's refs.** `legacy-v4-synthetic.json` is explicitly a synthetic v3-derived reader-contract fixture, not proof of a real v4 export. These checks do not certify every historical pre-release database or a downgrade.
