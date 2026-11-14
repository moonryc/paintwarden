## Why

Installed plugins provide miniature templates for starting projects, but painters also need to save a reusable model of their own. A dedicated template library makes installed templates discoverable and lets people reuse their own miniature setup. Paintwarden bundles no catalog; plugin installation is optional.

## What Changes

- Add a Templates page that lists and searches all installed plugin templates and user templates.
- Allow user templates to be created from scratch or copied from an existing miniature, then edited and deleted.
- Allow user templates in the Add miniature picker and copy their reusable image, schemes, and paints into new projects.
- Include user templates in vault backups and restores. Plugin catalog entries remain read-only in template management.

## Capabilities

### New Capabilities

- `miniature-templates`: Browse, create, manage, back up, and instantiate miniature templates.

### Modified Capabilities

None.

## Impact

Database schema and migration, template and miniature API routes, backup route, shared React navigation and screens, and API tests.
