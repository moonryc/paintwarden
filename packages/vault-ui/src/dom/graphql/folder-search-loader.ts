import type { ApolloClient } from "@apollo/client";
import { i18n } from "@paintwarden/i18n/runtime";

import {
  SearchFolderContentsDocument,
  type SearchFolderContentsQuery,
  type SearchFolderContentsQueryVariables,
} from "./generated/graphql";
import { isStaleLibraryCursor } from "./library-loader";

export type FolderSearchVariables = Omit<SearchFolderContentsQueryVariables, "first" | "after">;
export const FOLDER_SEARCH_PAGE_SIZE = 48;
export async function readFolderSearch(
  client: ApolloClient,
  variables: FolderSearchVariables,
  pages: number,
  signal?: AbortSignal,
): Promise<SearchFolderContentsQuery> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let combined: SearchFolderContentsQuery | undefined;
    let after: string | null = null;
    for (let page = 0; page < Math.max(1, pages); page += 1) {
      let data: SearchFolderContentsQuery | undefined;
      try {
        const result = await client.query({
          query: SearchFolderContentsDocument,
          variables: { ...variables, first: FOLDER_SEARCH_PAGE_SIZE, after },
          fetchPolicy: "no-cache",
          context: { fetchOptions: { signal }, queryDeduplication: false },
        });
        data = result.data;
      } catch (error) {
        if (!isStaleLibraryCursor(error)) throw error;
        combined = undefined;
        break;
      }
      if (!data) throw new Error(i18n.t("pages:folders.error"));
      const next: SearchFolderContentsQuery["folderSearch"] = data.folderSearch;
      if (
        combined &&
        (combined.folderSearch.revision.epoch !== next.revision.epoch ||
          combined.folderSearch.revision.seq !== next.revision.seq)
      ) {
        combined = undefined;
        break;
      }
      combined = combined
        ? {
            folderSearch: {
              ...next,
              results: {
                ...next.results,
                nodes: [...combined.folderSearch.results.nodes, ...next.results.nodes],
              },
            },
          }
        : data;
      if (!next.results.pageInfo.hasNextPage) break;
      const cursor = next.results.pageInfo.endCursor;
      if (!cursor || cursor === after) throw new Error(i18n.t("pages:folders.error"));
      after = cursor;
    }
    if (combined) return combined;
  }
  throw new Error(i18n.t("pages:folders.error"));
}
