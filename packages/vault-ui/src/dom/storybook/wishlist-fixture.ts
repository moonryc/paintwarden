import type { WishlistFixture, WishlistProjection } from "../graphql/wishlist-hooks";
import type { State } from "../types";
import { missingShoppingPaints, shoppingRows } from "../utils/semantic-contract";
import { owns, resolvedPaintIds } from "../utils/vault-data";

// Complete snapshots are allowed in Storybook only, never in the production Wishlist.
function snapshotFixture(data: State): WishlistFixture {
  const shopping = shoppingRows(data);
  const projectsFor = (paintId: string) =>
    data.miniatures
      .filter((mini) => resolvedPaintIds(data, mini.id).includes(paintId))
      .map(({ id, title }) => ({ id, title }));
  function project(row: ReturnType<typeof missingShoppingPaints>[number]): WishlistProjection {
    const record = data.paintRecords[row.paint.id];
    const projects = projectsFor(row.paint.id);
    return {
      ...row,
      record,
      brandGroup: row.paint.isCustom ? "Custom" : row.paint.brand,
      projectCount: projects.length,
      projects: projects.slice(0, 3),
      projectsTruncated: projects.length > 3,
      restock: Boolean(
        record && (record.state === "OWNED" || record.stockLevel === "EMPTY") && !owns(record),
      ),
      reasons: row.reasons ?? [],
    };
  }
  const rows = shopping.map((row) =>
    project({ ...row, reasons: row.reasons ?? [], projectCount: row.projects.length }),
  );
  const missing = missingShoppingPaints(data).map(project);
  const filtered = (id: string | null) =>
    rows.filter((row) => !id || projectsFor(row.paint.id).some((p) => p.id === id));
  return {
    record: (id) => data.paintRecords[id],
    view: (id) => ({
      rows: filtered(id),
      missing,
      totalCount: filtered(id).length,
      missingCount: missing.length,
      counts: {
        shoppingPaints: rows.length,
        restockPaints: rows.filter((row) => row.restock).length,
        missingPaints: missing.length,
        missingStock: missing.filter((row) => row.reasons.includes("missingStock")).length,
        brokenSubstitution: missing.filter((row) => row.reasons.includes("brokenSubstitution")).length,
        listedMissingStock: rows.filter((row) => row.projectCount > 0 && row.reasons.includes("missingStock"))
          .length,
        projectCount: new Set(shopping.flatMap((row) => row.projects.map((mini) => mini.id))).size,
      },
      hasNextPage: false,
      missingHasNextPage: false,
    }),
    modelOptions: (search) =>
      data.miniatures
        .filter((mini) => mini.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
        .sort((a, b) => b.createdAt - a.createdAt || a.title.localeCompare(b.title))
        .map(({ id, title }) => ({ id, title, projectCount: filtered(id).length })),
    exportList: async (id) => {
      const selected = filtered(id);
      const title = id
        ? `Paint shopping list for ${data.miniatures.find((mini) => mini.id === id)?.title ?? "miniature"}`
        : "Paint shopping list";
      const brands = [...new Set(selected.map((row) => row.brandGroup))].sort();
      return {
        title,
        totalCount: selected.length,
        text: [
          title,
          ...brands.map(
            (brand) =>
              `\n${brand}\n${selected
                .filter((row) => row.brandGroup === brand)
                .map(({ paint }) => `• ${paint.name} (${paint.range})`)
                .join("\n")}`,
          ),
        ].join("\n"),
      };
    },
    relatedProjects: async (paintId, after) => {
      const projects = projectsFor(paintId);
      const start = after ? Number(after) : 0;
      const end = Math.min(projects.length, start + 30);
      return {
        nodes: projects.slice(start, end),
        totalCount: projects.length,
        hasNextPage: end < projects.length,
        endCursor: end < projects.length ? String(end) : null,
      };
    },
  };
}

export function createWishlistFixture(getSnapshot: () => State): WishlistFixture {
  let previous: State | undefined;
  let current: WishlistFixture;
  function fixture() {
    const data = getSnapshot();
    if (previous !== data) {
      previous = data;
      current = snapshotFixture(data);
    }
    return current;
  }
  return {
    record: (id) => getSnapshot().paintRecords[id],
    view: (id) => fixture().view(id),
    modelOptions: (search) => fixture().modelOptions(search),
    exportList: (id) => fixture().exportList(id),
    relatedProjects: (id, after) => fixture().relatedProjects(id, after),
  };
}
