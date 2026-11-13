# Settings and Plugins reads

Settings uses the existing auth status, cheap REST version endpoint, and Electron
connection/updater bridge. Opening it performs **no vault collection read**, and
it does not load installed-source metadata, licenses, or update state.

Plugins mounts `usePluginSources`, which fetches the typed `InstalledSources`
Apollo envelope. It selects installed metadata and SQL-grouped item counts, not
catalog records, recipe graphs, source asset bytes, or `State`. Source removal
previews have their own `PluginRemoval` read; private deletion ID sets are never
exposed. `PluginShareable` is deferred further until **Create plugin** is clicked
and selects only custom-authored id/name choices, not source catalog rows.

## Update checks and writes

GraphQL resolvers are local reads only. The Plugins update check keeps the REST
`GET /api/catalog-sources?versions=1` network operation and discards its payload.
That existing service records bounded, installed-source-identity-keyed results;
`PluginVersions` then reads the local cached projection through Apollo. Changed
repository, branch, installed version, or removed source cannot reuse an old
cached result. A check failure never prevents the installed/offline list from
being used. Explicit check/update controls retain their existing labels.

The former startup background `PUT /api/catalog-sources` had no badge, toast, or
other update-state consumer outside Plugins (the old provider ignored its
response, and the old snapshot path only synchronized changes). It is now
non-blocking and deferred until the Plugins installed list is usable. Settings,
Home, and other screens therefore do not invoke source endpoints eagerly.

Install/update/remove/package/upload remain REST operations. Successful source
writes call the store refresh action, invalidating all sensitive families,
including SOURCES even when a bookkeeping-only check did not advance the change
log. Auth and backup operations remain REST/bridge; connection and updater stay
on the Electron bridge. Image and binary transport are unchanged.

## Races and coverage

Source reads use `no-cache`, capture an invalidation ticket, and normalize only
an accepted complete envelope. Old generation, disposed/account-switched scope,
and dirty SOURCES revisions cannot publish late licenses or resurrect removals.
Mounted lists subscribe to SOURCES; inactive Plugins do not refetch.

`graphql/sources.test.ts` exercises local metadata/counts, compact custom choices,
removal blockers and typed errors, private-ID exclusion, and offline version
reads. `graphql/sources-loader.test.ts` exercises Apollo commits, invalidation
retries, account disposal, explicit detail reads, and Settings collection-read
exclusion. Plugins/Settings stories cover loading, errors/retry, empty/installed
states, deferred Create plugin selection, and accessible controls. Native
Electron behavior still requires a separate packaged-app smoke test.
