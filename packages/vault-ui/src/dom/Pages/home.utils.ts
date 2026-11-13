import { fuzzyFilter } from "@paint-vault/core/fuzzy-search";

import type { Miniature, Paint, PaintingStatus, State } from "../types";
import {
  missingProjectPaintIds,
  owns,
  resolvedPaintIds,
  vaultDataIndex,
  wishlistPaintIds,
} from "../utils/vault-data";

export function readiness(data: State, miniId: string) {
  const ids = resolvedPaintIds(data, miniId);
  const index = vaultDataIndex(data);
  const paints = ids.map((id) => index.paints.get(id)).filter(Boolean) as Paint[];
  return { paints, total: ids.length, missing: ids.filter((id) => !owns(data.paintRecords[id])).length };
}

export function sortedProjects(data: State) {
  return data.miniatures
    .map((m) => ({ mini: m, ...readiness(data, m.id) }))
    .sort((a, b) => b.mini.createdAt - a.mini.createdAt || a.mini.title.localeCompare(b.mini.title));
}

export type Project = ReturnType<typeof sortedProjects>[number];
type CollectionFilter = Miniature["status"] | "ALL";
type StageFilter = PaintingStatus | "ALL";

function projectSummary(data: State) {
  const projects = sortedProjects(data);
  const statusCounts = { ALL: projects.length, OWNED: 0, WISHLIST: 0 };
  for (const { mini } of projects) statusCounts[mini.status]++;
  const missing = missingProjectPaintIds(data, "OWNED");
  const wishlist = wishlistPaintIds(data);
  return {
    projects,
    statusCounts,
    missingProjectPaints: missing.size,
    wishlistedMissingPaints: [...missing].filter((id) => wishlist.has(id)).length,
  };
}

function pageSummary(projects: Project[], workbench: boolean) {
  const pageProjects = workbench ? projects.filter(({ mini }) => mini.status === "OWNED") : projects;
  const stageCounts = {
    ALL: pageProjects.length,
    NOT_STARTED: 0,
    ASSEMBLED: 0,
    PRIMED: 0,
    IN_PROGRESS: 0,
    COMPLETE: 0,
  };
  let ready = 0;
  for (const project of pageProjects) {
    stageCounts[project.mini.paintingStatus]++;
    if (project.total > 0 && project.missing === 0) ready++;
  }
  return {
    pageProjects,
    stageCounts,
    ready,
    pct: pageProjects.length ? (ready / pageProjects.length) * 100 : 0,
  };
}

export const projectSearchText = ({ mini }: Project) =>
  `${mini.title} ${mini.notes} ${mini.manufacturer} ${mini.faction} ${mini.scale} ${mini.paintingStatus}`;

function filteredProjects(
  pageProjects: Project[],
  workbench: boolean,
  filter: CollectionFilter,
  stageFilter: StageFilter,
  q: string,
) {
  const candidates = pageProjects.filter(({ mini }) =>
    workbench
      ? stageFilter === "ALL" || mini.paintingStatus === stageFilter
      : filter === "ALL" || mini.status === filter,
  );
  return q ? fuzzyFilter(candidates, q, projectSearchText) : candidates;
}

function deriveShelf(
  summary: ReturnType<typeof projectSummary>,
  page: ReturnType<typeof pageSummary>,
  workbench: boolean,
  filter: CollectionFilter,
  stageFilter: StageFilter,
  q: string,
) {
  const visibleProjects = filteredProjects(page.pageProjects, workbench, filter, stageFilter, q);
  const shelfItems: (Project | null)[] = q ? visibleProjects : [null, ...visibleProjects];
  return { ...summary, ...page, visibleProjects, shelfItems };
}

// One selector per mounted Home, not a global collection cache. Viewport/focus changes are
// deliberately not inputs. Search/filter changes reuse readiness and counts; a new immutable
// query snapshot invalidates all vault-derived values, including substitution and stock changes.
export function createHomeDerivations() {
  let previousData: State | undefined;
  let previousWorkbench: boolean | undefined;
  let previousFilter: CollectionFilter | undefined;
  let previousStage: StageFilter | undefined;
  let previousQuery: string | undefined;
  let summary: ReturnType<typeof projectSummary>;
  let page: ReturnType<typeof pageSummary>;
  let result: ReturnType<typeof deriveShelf>;
  return (data: State, workbench: boolean, filter: CollectionFilter, stageFilter: StageFilter, q: string) => {
    const dataChanged = data !== previousData;
    if (dataChanged) summary = projectSummary(data);
    const pageChanged = dataChanged || workbench !== previousWorkbench;
    if (pageChanged) page = pageSummary(summary.projects, workbench);
    if (pageChanged || filter !== previousFilter || stageFilter !== previousStage || q !== previousQuery)
      result = deriveShelf(summary, page, workbench, filter, stageFilter, q);
    previousData = data;
    previousWorkbench = workbench;
    previousFilter = filter;
    previousStage = stageFilter;
    previousQuery = q;
    return result;
  };
}
