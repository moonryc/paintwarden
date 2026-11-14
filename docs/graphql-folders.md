# Nested folders and Projects

`folders` is a shared hierarchy with immutable kind (`miniature` or `template`), a nullable parent, sort order, and creation/update timestamps. An item has one nullable `folderId`. Database FKs and triggers enforce existence, same-kind membership and acyclicity; server mutations validate moves before writing. Migration 0002 is additive and leaves released migration 0000 untouched.

## Reads and consistency

`folderBrowser` pages compact folder metadata with direct/recursive item counts and a descendant cover thumbnail. Its cursors are revision- and scope-bound. The client collects complete hierarchy pages at one accepted revision before publishing the tree; no result cap silently hides authored folders. Folder counts are cached per server data generation and rolled upward without loading item recipes.

Normal Home/Miniatures/Templates paging accepts a folder scope and flat flag. Folder-mode tiles use direct contents. Workbench counts always include the current project's full subtree, independent of search, stage and loaded window. At root and in Flat view they cover the entire collection. Existing unscoped callers retain their original unrestricted default.

`folderSearch` returns a paged, revision-stamped union of folder and item results. A non-null folder scope searches its subtree; null searches the collection. Item filters retain their existing semantics. UI results distinguish folders with MUI Folder icons and open them into folder view. Query/page/input cost limits apply to folders and mixed search as they do to other projections.

## Commands and invalidation

Create, rename and move folder mutations and bounded bulk item moves commit atomically. Folder kinds cannot change. A folder cannot move beneath itself or any descendant. Delete supports `MOVE_UP` (direct items and child folders move to the deleted folder's parent/root) and `DELETE_CONTENTS` (recursive deletion). Image cleanup runs under the shared image mutation lock and respects references retained elsewhere.

SQLite change triggers include folders and item memberships. Folder writes conservatively invalidate all projection families; item changes invalidate their existing families. The UI uses the existing no-cache ticket/accepted-revision and command-ack controller, preserving SSE/reset/access recovery rather than introducing a second synchronization mechanism.

## Device UI and backups

Folder/flat preferences are independent for Workbench, Miniatures and Templates and stored per device. Page locations remain UI state, not vault data. Shared Modal dialogs provide Add choice, folder forms, deletion choices and the folder picker. Folder tiles, breadcrumbs, pickers and loading states have Storybook coverage; UI strings live in all 13 catalogs.

ZIP2 adds a folders section and item membership. ZIP1 remains an explicitly supported backward read contract with root membership. Original v1 SQLite/ZIP1 goldens are preserved; additive ZIP2 nested-folder fixtures and upgrade/rollback checks are documented in [data compatibility](data-compatibility.md).
