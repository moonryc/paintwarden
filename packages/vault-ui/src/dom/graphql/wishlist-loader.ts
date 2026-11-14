import { i18n } from "@paint-vault/i18n/runtime";
import type { ApolloClient } from "@apollo/client";

import { WishlistPageDocument, type WishlistPageQuery } from "./generated/graphql";
import { isStaleLibraryCursor } from "./library-loader";

export const WISHLIST_PAGE_SIZE = 48;
export type WishlistWindow = { shopping: number; missing: number };
export function sameWishlistRevision(a: WishlistPageQuery, b: WishlistPageQuery) {
  return (
    a.wishlist.revision.epoch === b.wishlist.revision.epoch &&
    a.wishlist.revision.seq === b.wishlist.revision.seq
  );
}

export async function readWishlistPage(
  client: ApolloClient,
  miniatureId: string | null,
  after: string | null = null,
  missingAfter: string | null = null,
  signal?: AbortSignal,
) {
  const { data } = await client.query({
    query: WishlistPageDocument,
    variables: {
      first: WISHLIST_PAGE_SIZE,
      missingFirst: WISHLIST_PAGE_SIZE,
      miniatureId,
      after,
      missingAfter,
    },
    fetchPolicy: "no-cache",
    context: { fetchOptions: { signal }, queryDeduplication: false },
  });
  if (!data) throw new Error(i18n.t("shell:wishlistResponseWasEmpty"));
  return data;
}

// Both independent connections are read at one revision and published together. A stale
// cursor discards the whole attempted window, never retaining half of an old generation.
export async function readWishlistWindow(
  client: ApolloClient,
  miniatureId: string | null,
  pages: WishlistWindow,
  signal?: AbortSignal,
): Promise<WishlistPageQuery> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let combined: WishlistPageQuery | undefined;
    let after: string | null = null;
    let missingAfter: string | null = null;
    let shoppingDone = false;
    let missingDone = false;
    for (let page = 0; page < Math.max(1, pages.shopping, pages.missing); page += 1) {
      let next: WishlistPageQuery;
      try {
        next = await readWishlistPage(client, miniatureId, after, missingAfter, signal);
      } catch (error) {
        if (!isStaleLibraryCursor(error)) throw error;
        combined = undefined;
        break;
      }
      if (combined && !sameWishlistRevision(combined, next)) {
        combined = undefined;
        break;
      }
      const previous = combined?.wishlist;
      combined = {
        ...next,
        wishlist: {
          ...next.wishlist,
          shopping: !previous
            ? next.wishlist.shopping
            : shoppingDone
              ? previous.shopping
              : {
                  ...next.wishlist.shopping,
                  nodes: [...previous.shopping.nodes, ...next.wishlist.shopping.nodes],
                },
          missing: !previous
            ? next.wishlist.missing
            : missingDone
              ? previous.missing
              : {
                  ...next.wishlist.missing,
                  nodes: [...previous.missing.nodes, ...next.wishlist.missing.nodes],
                },
        },
      };
      shoppingDone ||= page + 1 >= pages.shopping || !next.wishlist.shopping.pageInfo.hasNextPage;
      missingDone ||= page + 1 >= pages.missing || !next.wishlist.missing.pageInfo.hasNextPage;
      if (shoppingDone && missingDone) break;
      after = shoppingDone ? null : (next.wishlist.shopping.pageInfo.endCursor ?? null);
      missingAfter = missingDone ? null : (next.wishlist.missing.pageInfo.endCursor ?? null);
      if ((!shoppingDone && !after) || (!missingDone && !missingAfter))
        throw new Error(i18n.t("shell:wishlistReturnedAnInvalidPageCursor"));
    }
    if (combined) return combined;
  }
  throw new Error(i18n.t("shell:wishlistChangedRepeatedlyWhileRefreshingTryAgain"));
}
