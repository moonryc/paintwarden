import { COLOR_CATEGORIES } from "@paintwarden/core/color-categories";
import { useMemo, useState } from "react";

import { useSchemeOptions } from "../graphql/miniature-scheme-hooks";

import {
  SchemePickerDialogView,
  type SchemePickerDialogProps,
  type SchemePickerFilter,
  type SchemePickerOption,
} from "./SchemePickerDialog";

// Selection lives in the view, not in the paginated result, so searching and loading
// another page never drops a staged choice.
export function ApolloSchemePickerDialog(props: SchemePickerDialogProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SchemePickerFilter>("ALL");
  const options = useSchemeOptions(
    search,
    filter === "ALL" || filter === "SELECTED" ? null : filter,
    props.attachedIds,
  );
  const schemes = useMemo(
    () =>
      options.items.map((scheme): SchemePickerOption => ({
        id: scheme.id,
        name: scheme.name,
        category: COLOR_CATEGORIES.find((category) => category === scheme.category) ?? null,
        availableCount: scheme.availableCount,
        paintCount: scheme.paintCount,
        colors: scheme.previewSwatches.map((swatch) => swatch.colorHex),
        imageUrl: scheme.thumbnailUrl ?? scheme.imageUrl,
      })),
    [options.items],
  );
  return (
    <SchemePickerDialogView
      {...props}
      schemes={schemes}
      search={search}
      onSearchChange={setSearch}
      onFilterChange={setFilter}
      totalCount={options.categories.reduce((sum, facet) => sum + facet.count, 0)}
      categoryCounts={COLOR_CATEGORIES.flatMap((category) => {
        const facet = options.categories.find((value) => value.key === category);
        return facet ? [{ category, count: facet.count }] : [];
      })}
      loading={options.loading}
      error={options.error}
      onRetry={options.refetch}
      hasMore={options.hasNextPage}
      onLoadMore={options.loadMore}
    />
  );
}
