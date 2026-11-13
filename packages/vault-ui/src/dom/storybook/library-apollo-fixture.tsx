// Real Apollo/client hook coverage without an HTTP server or the production snapshot path.
import { ApolloClient, ApolloLink, Observable } from "@apollo/client";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { createVaultCache } from "../graphql/cache";
import { VaultInvalidationController } from "../graphql/invalidation";
import { ALL_LIBRARY_SOURCES, NO_LIBRARY_SOURCE, LibraryFixtureContext } from "../graphql/library-hooks";
import { VaultGraphQLContext } from "../graphql/provider";
import { useVault } from "../store/hooks";

import { fixtureLibraryView } from "./library-fixtures";

export function LibraryApolloFixture({
  children,
  pageDelay = 25,
}: {
  children: ReactNode;
  pageDelay?: number;
}) {
  const data = useVault();
  const latest = useRef(data);
  latest.current = data;
  const [scope] = useState(() => {
    const controller = new VaultInvalidationController();
    const client = new ApolloClient({
      cache: createVaultCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            const variables = operation.variables as {
              search?: string;
              brand?: string;
              noSource?: boolean;
              sourceName?: string;
              filter?: "ALL" | "OWNED" | "WISHLIST" | "UNTRACKED";
              after?: string;
              first: number;
            };
            const view = fixtureLibraryView(latest.current, {
              search: variables.search ?? "",
              brand: variables.brand ?? "ALL",
              plugin: variables.noSource ? NO_LIBRARY_SOURCE : (variables.sourceName ?? ALL_LIBRARY_SOURCES),
              inventory: variables.filter ?? "ALL",
            });
            const start = Number(variables.after ?? 0);
            const end = Math.min(start + variables.first, view.rows.length);
            const nodes = view.rows
              .slice(start, end)
              .map(({ paint, record, available, substitution, broken }) => ({
                __typename: "Paint",
                ...paint,
                sourceName: paint.sourceName ?? null,
                sourceLogoUrl: paint.sourceLogoUrl ?? null,
                type: null,
                discontinued: false,
                inventory: record ? { __typename: "Inventory", ...record } : null,
                available,
                activeSubstitution: substitution
                  ? { __typename: "ActiveSubstitution", ...substitution }
                  : null,
                brokenSubstitution: broken,
                brokenReason: broken ? "EMPTY" : null,
                missingStock: !available,
              }));
            const timer = setTimeout(() => {
              observer.next({
                data: {
                  library: {
                    __typename: "PaintConnection",
                    nodes,
                    totalCount: view.totalCount,
                    catalogCount: view.catalogCount,
                    availableCount: view.availableCount,
                    explicitWishlistCount: view.wishlistCount,
                    facets: {
                      __typename: "LibraryFacets",
                      brands: view.brands,
                      sources: view.sources,
                      inventory: view.inventory,
                    },
                    pageInfo: {
                      __typename: "PageInfo",
                      hasNextPage: end < view.rows.length,
                      endCursor: String(end),
                    },
                    revision: { __typename: "VaultRevision", epoch: "storybook", seq: "1" },
                  },
                },
              });
              observer.complete();
            }, pageDelay);
            return () => clearTimeout(timer);
          }),
      ),
    });
    return { client, controller };
  });
  useEffect(
    () => () => {
      scope.client.stop();
      scope.controller.dispose();
    },
    [scope],
  );
  return (
    <LibraryFixtureContext.Provider value={null}>
      <VaultGraphQLContext.Provider value={scope}>{children}</VaultGraphQLContext.Provider>
    </LibraryFixtureContext.Provider>
  );
}
