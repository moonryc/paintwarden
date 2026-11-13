import type { ApolloClient } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";

import {
  LibraryPageDocument,
  type LibraryPageQuery,
  type LibraryPageQueryVariables,
} from "./generated/graphql";

export const LIBRARY_PAGE_SIZE = 48;
export type LibraryVariables = Omit<LibraryPageQueryVariables, "first" | "after">;

export function isStaleLibraryCursor(error: unknown) {
  return (
    CombinedGraphQLErrors.is(error) && error.errors.some((entry) => entry.extensions?.code === "STALE_CURSOR")
  );
}

export function sameLibraryRevision(a: LibraryPageQuery, b: LibraryPageQuery) {
  return (
    a.library.revision.epoch === b.library.revision.epoch && a.library.revision.seq === b.library.revision.seq
  );
}

export function appendLibraryPage(previous: LibraryPageQuery, next: LibraryPageQuery): LibraryPageQuery {
  return { library: { ...next.library, nodes: [...previous.library.nodes, ...next.library.nodes] } };
}

// Network results must not enter the normalized cache until the caller's generation guard
// accepts them. In particular, a late request must not overwrite a stock mutation.
export async function readLibraryPage(
  client: ApolloClient,
  variables: LibraryVariables = {},
  after: string | null = null,
) {
  const { data } = await client.query({
    query: LibraryPageDocument,
    variables: { ...variables, first: LIBRARY_PAGE_SIZE, after },
    fetchPolicy: "no-cache",
  });
  if (!data) throw new Error("Library response was empty");
  return data;
}

// Refetch all loaded pages, then replace them atomically (Q4). On a revision change,
// restart at the beginning; never publish a mixture of old and new pages. There is no
// page-count ceiling: each request is bounded, but the final paint remains reachable.
export async function readLibraryWindow(
  client: ApolloClient,
  pages: number,
  variables: LibraryVariables = {},
): Promise<LibraryPageQuery> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let combined: LibraryPageQuery | undefined;
    let after: string | null = null;
    for (let page = 0; page < Math.max(pages, 1); page += 1) {
      let data: LibraryPageQuery;
      try {
        data = await readLibraryPage(client, variables, after);
      } catch (error) {
        if (isStaleLibraryCursor(error)) {
          combined = undefined;
          break;
        }
        throw error;
      }
      if (combined && !sameLibraryRevision(combined, data)) {
        combined = undefined;
        break;
      }
      combined = combined ? appendLibraryPage(combined, data) : data;
      after = data.library.pageInfo.endCursor;
      if (!data.library.pageInfo.hasNextPage) break;
      if (!after) throw new Error("Library returned an invalid page cursor");
    }
    if (combined) return combined;
  }
  throw new Error("Library changed repeatedly while refreshing. Try again.");
}
