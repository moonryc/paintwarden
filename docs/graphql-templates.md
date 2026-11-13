# Templates projections

Templates and the miniature form use Apollo typed documents, not the vault snapshot.

- `templates` returns a 48-row summary window (maximum page size 100), global category/source facets and exact matching total. Server-side fuzzy search covers unloaded rows; source/category filters apply before ranking. An optional exact `id` filter initializes Add miniature from a card outside page one.
- Summary rows include identity, manufacturer/faction, image URL, category/source provenance and SQL-aggregated paint/scheme counts. Neither browsing nor the summary details dialog reads recipe rows or constructs a `State`/paint graph. Metadata sorts by normalized name then ID. Search cursors are filter/revision scoped, with bounded cached result sets.
- `templateRecipe` is used only by the selected editor. Separate paint and scheme connections page to completion at one revision. Labels are joined minimal strings, not Paint or Scheme graphs. Repeated paints in different steps retain their own notes and order.
- Copy-from-miniature first searches the paginated miniature list, then uses `TemplateSourceMiniature`, selecting only the chosen model's metadata, recipe paint labels and attached scheme labels. It does not fetch missing/required paints or attached scheme details. Save sends `sourceMiniatureId`; the command copies authoritative model recipe/image data rather than trusting the preview.
- Ordinary create/update/delete use GraphQL commands backed by the same validation/transaction services as REST. Catalog templates remain read-only. Image bytes still use the existing image store/locking and are copied when making a template from a model.

Network pages use `no-cache`. Only complete, revision-consistent windows accepted by the connection generation/family watermarks are written to Apollo. A stale cursor or mixed page revision restarts the window, with bounded retries. Invalidation refetches all explicitly loaded pages; it never downloads unloaded pages. Recipe initialization occurs once so a background refresh cannot discard unsaved editor fields. Mutation receipts invalidate families without advancing the SSE cursor.

`template-loader.test.ts`, `template-actions.test.ts`, server `templates.test.ts` and Templates/Miniature form stories cover paginated global search/facets, on-demand selected recipes, REST/GraphQL parity, source provenance/copy, recipe notes across repeated steps, retries and scope changes. Story-only fixture projections live in `storybook/template-api-fixtures.ts`.
