import type Database from "better-sqlite3";

// Conservative connection-scoped invalidation: total_changes catches every local
// writer (including cascades/restore/source installs), data_version catches commits
// through other connections. No TTL can serve stale edits. A rolled-back write can
// unnecessarily invalidate the cache, but can never publish uncommitted data.
export function createSqliteReadCache<T>(sqlite: Database.Database, load: () => T) {
  const changes = sqlite.prepare("SELECT total_changes()").pluck();
  const version = sqlite.prepare("PRAGMA data_version").pluck();
  let previousChanges = -1,
    previousVersion = -1;
  let cached: T;
  const read = sqlite.transaction(() => {
    const currentChanges = changes.get() as number;
    const currentVersion = version.get() as number;
    if (currentChanges !== previousChanges || currentVersion !== previousVersion) {
      cached = load();
      previousChanges = currentChanges;
      previousVersion = currentVersion;
    }
    return cached;
  });
  // Never publish an uncommitted snapshot into the shared cache, including a
  // read performed during a transaction that is subsequently rolled back.
  return () => (sqlite.inTransaction ? load() : read());
}
