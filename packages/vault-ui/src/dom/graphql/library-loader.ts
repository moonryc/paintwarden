import type { ApolloClient } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";

import { LibraryPageDocument, type LibraryPageQuery } from "./generated/graphql";

export const LIBRARY_PAGE_SIZE = 48;
export const DEBUG_LIBRARY_MAX_PAGES = 5;

// Refresh the visible window using bounded requests, then replace it atomically. A failed
// refresh keeps the old rows (and scroll position). Never combine pages from two revisions.
export async function readLibraryWindow(client: ApolloClient, pages: number): Promise<LibraryPageQuery> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let combined: LibraryPageQuery | undefined;
    let after: string | null = null;
    for (let page = 0; page < Math.min(Math.max(pages, 1), DEBUG_LIBRARY_MAX_PAGES); page += 1) {
      let data: LibraryPageQuery | undefined;
      try {
        ({ data } = await client.query({
          query: LibraryPageDocument,
          variables: { first: LIBRARY_PAGE_SIZE, after },
          fetchPolicy: "no-cache",
        }));
      } catch (error) {
        if (
          CombinedGraphQLErrors.is(error) &&
          error.errors.some((entry) => entry.extensions?.code === "STALE_CURSOR")
        ) {
          combined = undefined;
          break;
        }
        throw error;
      }
      if (!data) throw new Error("Library response was empty");
      if (
        combined &&
        (combined.library.revision.epoch !== data.library.revision.epoch ||
          combined.library.revision.seq !== data.library.revision.seq)
      ) {
        combined = undefined;
        break;
      }
      combined = combined
        ? {
            library: { ...data.library, nodes: [...combined.library.nodes, ...data.library.nodes] },
          }
        : data;
      after = data.library.pageInfo.endCursor;
      if (!data.library.pageInfo.hasNextPage) break;
    }
    if (combined) return combined;
  }
  throw new Error("Library changed repeatedly while refreshing. Try again.");
}
