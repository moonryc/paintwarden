// Storybook-only sample-data projections. It projects complete sample vaults; the production
// Library never imports this module or manufactures a partial State.
import { createFuzzyIndex, searchFuzzyIndex } from "@paint-vault/core/fuzzy-search";
import {
  defaultSubstitution,
  isPaintAvailable,
  resolvePaintChoice,
} from "@paint-vault/core/paint-substitutions";
import { useMemo, type ReactNode } from "react";

import {
  ALL_LIBRARY_SOURCES,
  LibraryFixtureContext,
  NO_LIBRARY_SOURCE,
  type LibraryFilters,
  type LibraryView,
} from "../graphql/library-hooks";
import type { LibraryPaintProjection } from "../graphql/library-model";
import type { State } from "../types";

import { useStoryFixtureState } from "./story-fixture";

export function fixtureLibraryView(data: State, filters: LibraryFilters): LibraryView {
  const all: LibraryPaintProjection[] = data.catalog.map((paint) => ({
    paint,
    record: data.paintRecords[paint.id],
    substitution: defaultSubstitution(data, paint.id) ?? null,
    available: isPaintAvailable(data, data.paintRecords, paint.id),
    broken: resolvePaintChoice(data, "", paint.id).broken,
  }));
  const search = filters.search.trim();
  const searched = search
    ? searchFuzzyIndex(
        createFuzzyIndex(
          all,
          ({ paint }) => `${paint.isCustom ? "Custom " : ""}${paint.brand} ${paint.range} ${paint.name}`,
        ),
        search,
      )
    : all;
  const narrowed = searched.filter(
    ({ paint }) =>
      (filters.brand === "ALL" || (paint.isCustom ? "Custom" : paint.brand) === filters.brand) &&
      (filters.plugin === ALL_LIBRARY_SOURCES ||
        (filters.plugin === NO_LIBRARY_SOURCE ? !paint.sourceName : paint.sourceName === filters.plugin)),
  );
  const matches = (row: LibraryPaintProjection, inventory: string) =>
    inventory === "ALL" ||
    (inventory === "OWNED"
      ? row.available
      : inventory === "WISHLIST"
        ? row.record?.state === "WISHLIST"
        : !row.available && row.record?.state !== "WISHLIST");
  const facets = (keys: string[]) =>
    [...new Set(keys)]
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({ key, label: key, count: keys.filter((item) => item === key).length }));
  const rows = narrowed.filter((row) => matches(row, search ? "ALL" : filters.inventory));
  return {
    rows,
    totalCount: rows.length,
    catalogCount: all.length,
    availableCount: all.filter((row) => row.available).length,
    wishlistCount: all.filter((row) => row.record?.state === "WISHLIST").length,
    brands: facets(all.map(({ paint }) => (paint.isCustom ? "Custom" : paint.brand))),
    sources: facets(all.map(({ paint }) => paint.sourceName ?? "")),
    inventory: ["ALL", "OWNED", "WISHLIST", "UNTRACKED"].map((key) => ({
      key,
      label: key,
      count: narrowed.filter((row) => matches(row, key)).length,
    })),
    hasNextPage: false,
  };
}

export function LibraryFixtureProvider({ children }: { children: ReactNode }) {
  const data = useStoryFixtureState();
  const read = useMemo(() => (filters: LibraryFilters) => fixtureLibraryView(data, filters), [data]);
  return <LibraryFixtureContext.Provider value={read}>{children}</LibraryFixtureContext.Provider>;
}
