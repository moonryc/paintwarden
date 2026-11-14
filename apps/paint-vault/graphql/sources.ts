import { publicError } from "../lib/public-errors.ts";
import { GraphQLError } from "graphql";

import { getSqlite } from "../db/index.ts";
import { sourceLogoUrl } from "../lib/catalog-source-assets.ts";
import { cachedCatalogSourceVersions, previewSourceRemoval } from "../lib/catalog-sources.ts";

import { readRevision, validateText } from "./library.ts";

type SourceRow = {
  id: string;
  repository: string;
  url: string;
  name: string;
  version: string;
  license: string | null;
  attribution: string | null;
  dependencies: string;
  lastError: string | null;
  logoSvg: string | null;
  paints: number;
  schemes: number;
  templates: number;
};

// Counts stay in SQL. Reading installed plugins never materializes catalog items,
// recipes, assets, licenses from disk, or a vault snapshot.
export function readSources() {
  return getSqlite().transaction(() => {
    const rows = getSqlite()
      .prepare(
        `SELECT s.id,s.repository,s.url,s.name,s.version,
      s.license,s.attribution,s.dependencies,s.last_error AS lastError,s.logo_svg AS logoSvg,
      SUM(CASE WHEN i.kind='paint' THEN 1 ELSE 0 END) AS paints,
      SUM(CASE WHEN i.kind='scheme' THEN 1 ELSE 0 END) AS schemes,
      SUM(CASE WHEN i.kind='template' THEN 1 ELSE 0 END) AS templates
      FROM catalog_sources s LEFT JOIN catalog_source_items i ON i.source_id=s.id
      GROUP BY s.id ORDER BY s.rowid`,
      )
      .all() as SourceRow[];
    return {
      revision: readRevision(),
      sources: rows.map(({ dependencies, logoSvg, paints, schemes, templates, ...source }) => ({
        ...source,
        lastErrorInfo: source.lastError
          ? (() => {
              const error = publicError(source.lastError);
              return {
                code: error.errorCode,
                parameters: Object.entries(error.errorParameters).map(([name, value]) => ({ name, value })),
              };
            })()
          : null,
        dependencies: JSON.parse(dependencies) as { repository: string; minimumVersion?: string }[],
        logoUrl: sourceLogoUrl(source.id, logoSvg),
        counts: { paints, schemes, templates },
      })),
    };
  })();
}
// Cached local state only. REST source operations own all external network work.
export function readSourceVersions() {
  return getSqlite().transaction(() => ({
    revision: readRevision(),
    versions: cachedCatalogSourceVersions(),
  }))();
}

export function readSourceRemoval(id: string) {
  validateText(id, "id");
  if (!id) throw new GraphQLError("Source id is required", { extensions: { code: "BAD_USER_INPUT" } });
  return getSqlite().transaction(() => {
    if (!getSqlite().prepare("SELECT id FROM catalog_sources WHERE id=?").get(id))
      throw new GraphQLError("Catalog source not found", { extensions: { code: "NOT_FOUND" } });
    const { ids: _ids, ...preview } = previewSourceRemoval(id);
    return { revision: readRevision(), ...preview };
  })();
}

type ShareItem = { id: string; name: string };
// Create plugin opts into these compact user-authored choices, never catalog
// paints or full records. The binary packaging command remains REST.
export function readSourceShareable() {
  return getSqlite().transaction(() => ({
    revision: readRevision(),
    paints: getSqlite()
      .prepare(
        "SELECT id,brand || ' · ' || name AS name FROM paint_catalog WHERE id LIKE 'user:%' ORDER BY rowid",
      )
      .all() as ShareItem[],
    schemes: getSqlite()
      .prepare("SELECT id,name FROM color_schemes WHERE id LIKE 'user:%' ORDER BY rowid")
      .all() as ShareItem[],
    templates: getSqlite()
      .prepare("SELECT id,name FROM miniature_templates WHERE id LIKE 'user:%' ORDER BY rowid")
      .all() as ShareItem[],
  }))();
}
