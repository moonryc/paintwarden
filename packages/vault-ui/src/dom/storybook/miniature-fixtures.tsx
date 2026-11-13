// Storybook-only projection of complete sample vaults. Production list reads never import this.
import { useMemo, type ReactNode } from "react";

import {
  MiniatureFixtureContext,
  type MiniatureListFilters,
  type MiniatureListView,
} from "../graphql/miniature-list-hooks";
import type { MiniatureTileProjection } from "../graphql/miniature-list-model";
import { createHomeDerivations } from "../Pages/home.utils";
import { useVault } from "../store/hooks";
import type { State } from "../types";

const readers = new WeakMap<State, (filters: MiniatureListFilters) => MiniatureListView>();

export function fixtureMiniatureView(data: State, filters: MiniatureListFilters): MiniatureListView {
  let read = readers.get(data);
  if (!read) {
    const derive = createHomeDerivations();
    const catalogCount = data.catalog.length;
    const projections = new Map<string, MiniatureTileProjection>();
    const views = new Map<string, MiniatureListView>();
    read = (next) => {
      const key = JSON.stringify(next);
      const cached = views.get(key);
      if (cached) return cached;
      const result = derive(data, next.workbench, next.ownership, next.stage, next.search.trim());
      const rows = result.visibleProjects.map((project) => {
        let projection = projections.get(project.mini.id);
        if (!projection) {
          projection = {
            mini: {
              id: project.mini.id,
              title: project.mini.title,
              status: project.mini.status,
              imageUrl: project.mini.imageUrl,
            },
            swatches: project.paints.map((paint) => ({ colorHex: paint.colorHex ?? null })),
            total: project.total,
            missing: project.missing,
          };
          projections.set(project.mini.id, projection);
        }
        return projection;
      });
      const view: MiniatureListView = {
        rows,
        totalCount: rows.length,
        collectionCount: result.pageProjects.length,
        statusCounts: result.statusCounts,
        stageCounts: result.stageCounts,
        owned: result.statusCounts.OWNED,
        ready: result.ready,
        missingProjectPaints: result.missingProjectPaints,
        wishlistedMissingPaints: result.wishlistedMissingPaints,
        catalogCount,
        hasNextPage: false,
      };
      views.set(key, view);
      return view;
    };
    readers.set(data, read);
  }
  return read(filters);
}

export function MiniatureFixtureProvider({ children }: { children: ReactNode }) {
  const data = useVault();
  const read = useMemo(() => (filters: MiniatureListFilters) => fixtureMiniatureView(data, filters), [data]);
  return <MiniatureFixtureContext.Provider value={read}>{children}</MiniatureFixtureContext.Provider>;
}
