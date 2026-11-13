## Context

The picker reads the installed plugin catalog and user templates. No catalog is bundled or seeded. Projects, schemes, and required paints live in SQLite. The shared React UI serves web and Electron.

## Goals / Non-Goals

**Goals:** Keep all installed plugin templates visible and read-only in template management; store user templates independently; copy reusable project data into new miniatures; include templates in backups.

**Non-Goals:** Editing plugin records through user-template operations or bundling a catalog.

## Decisions

- Add a `miniature_templates` table for user records. Store ordered scheme and paint references in template recipe tables. The template holds its own image key or image URL so deleting the source project does not remove its image.
- Expose the combined catalog through the existing GET endpoint and add POST, PUT, and DELETE operations for user records. Reject user-template mutations targeting plugin IDs. Validate referenced scheme and paint IDs and preserve ordered paint steps and notes.
- Use one shared Templates page for browsing and management, and keep the existing Add miniature picker fed by the same endpoint. A saved miniature becomes a snapshot, while an empty template can be filled in by editing its fields.
- Add the new table to backup export and idempotent restore. Older backups remain accepted.

## Risks / Trade-offs

- Deleting a referenced scheme or paint can leave a stale ID in a template → filter missing references when a miniature is created.
- Local template photos are stored separately from SQLite → include their bytes in the template backup payload and restore them into the image store.

## Migration Plan

Generate and ship a Drizzle migration. Existing vaults gain an empty user template table; plugin templates come only from installed plugins. Rollback requires a database backup because SQLite migrations are one way.

## Open Questions

None.
