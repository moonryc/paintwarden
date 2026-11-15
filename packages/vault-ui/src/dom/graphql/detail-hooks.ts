import { normalizeSearch, SEARCH_DEBOUNCE_MS, useSearchResults } from "../utils/use-search-results";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { readPaintDetail, type PaintDetailView, type DetailWindow } from "./detail-loader";
import { getFragmentData, makeFragmentData } from "./generated/fragment-masking";
import {
  DetailPaintFragmentDoc,
  DetailSubstitutionFragmentDoc,
  PaintDetailsDocument,
  PaintPickerOptionsDocument,
  type DetailPaintFragment,
} from "./generated/graphql";
import type { ReadTicket, Revision, VaultFamily } from "./invalidation";
import { useVaultGraphQL } from "./provider";
import { useRetainedQuery } from "./use-retained-query";

const DETAIL_FAMILIES: readonly VaultFamily[] = ["PAINT", "MINIATURES", "SOURCES"];
const OPTION_FAMILIES: readonly VaultFamily[] = ["OPTIONS", "PAINT", "SOURCES"];
type AcceptedRead = { ticket: ReadTicket; revision: Revision };

const initialWindow = (): DetailWindow => ({ substitutions: 1, usedBy: 1, ingredients: {} });

export function usePaintDetail(id: string) {
  const graphql = useVaultGraphQL();
  const [window, setWindow] = useState(initialWindow);
  const previousId = useRef(id);
  const accepted = useRef<AcceptedRead | null>(null);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    id: string;
    scope: typeof graphql;
    data: PaintDetailView | null;
    loading: boolean;
    error: Error | null;
  }>({ id, scope: graphql, data: null, loading: true, error: null });
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    if (previousId.current !== id) {
      previousId.current = id;
      setWindow(initialWindow());
    }
  }, [id]);
  useEffect(
    () =>
      graphql?.controller.listen(DETAIL_FAMILIES, () => {
        const previous = accepted.current;
        if (
          !previous ||
          !graphql.controller.isCurrent(previous.ticket) ||
          !graphql.controller.isFresh(previous.revision, DETAIL_FAMILIES)
        )
          refresh();
      }),
    [graphql, refresh],
  );
  useEffect(() => {
    if (!graphql) return;
    let current = true;
    const ticket = graphql.controller.capture();
    setResult((old) => ({
      id,
      scope: graphql,
      data: old.id === id && old.scope === graphql ? old.data : null,
      loading: true,
      error: null,
    }));
    void readPaintDetail(graphql.client, id, window)
      .then((data) => {
        if (!current) return;
        if (!graphql.controller.accepts(ticket, data.revision, DETAIL_FAMILIES)) {
          refresh();
          return;
        }
        accepted.current = { ticket, revision: data.revision };
        // The view is already unmasked at this boundary; runtime fragment fields remain intact.
        graphql.client.writeQuery({
          query: PaintDetailsDocument,
          variables: { id },
          data: {
            paint: {
              ...data,
              paint: data.paint ? makeFragmentData(data.paint, DetailPaintFragmentDoc) : null,
              substitutions: {
                ...data.substitutions,
                nodes: data.substitutions.nodes.map((mix) =>
                  makeFragmentData(
                    {
                      ...mix,
                      ingredients: {
                        ...mix.ingredients,
                        nodes: mix.ingredients.nodes.map((row) => ({
                          ...row,
                          paint: makeFragmentData(row.paint, DetailPaintFragmentDoc),
                        })),
                      },
                    },
                    DetailSubstitutionFragmentDoc,
                  ),
                ),
              },
            },
          },
        });
        setResult({ id, scope: graphql, data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (current)
          setResult((old) => ({
            ...old,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          }));
      });
    return () => {
      current = false;
    };
  }, [graphql, id, window, version, refresh]);
  const retained = useRetainedQuery(
    result.id === id && result.scope === graphql ? result.data : null,
    result.id !== id || result.scope !== graphql || result.loading,
    graphql,
    id,
  );
  return {
    ...retained,
    error: result.id === id && result.scope === graphql ? result.error : null,
    refresh,
    loadMoreSubstitutions: () => setWindow((old) => ({ ...old, substitutions: old.substitutions + 1 })),
    loadMoreUsedBy: () => setWindow((old) => ({ ...old, usedBy: old.usedBy + 1 })),
    loadMoreIngredients: (mixId: string) =>
      setWindow((old) => ({
        ...old,
        ingredients: { ...old.ingredients, [mixId]: (old.ingredients[mixId] ?? 0) + 1 },
      })),
  };
}

export function usePaintOptions(search: string, excludeIds: string[], first = 30) {
  search = normalizeSearch(search);
  const graphql = useVaultGraphQL();
  const accepted = useRef<AcceptedRead | null>(null);
  const key = JSON.stringify([...new Set(excludeIds)].sort());
  const variables = useMemo(
    () => ({ search, excludeIds: JSON.parse(key) as string[], first }),
    [search, key, first],
  );
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    variables: typeof variables;
    scope: typeof graphql;
    items: DetailPaintFragment[];
    loading: boolean;
    error: Error | null;
  }>({ variables, scope: graphql, items: [], loading: true, error: null });
  useEffect(
    () =>
      graphql?.controller.listen(OPTION_FAMILIES, () => {
        const previous = accepted.current;
        if (
          !previous ||
          !graphql.controller.isCurrent(previous.ticket) ||
          !graphql.controller.isFresh(previous.revision, OPTION_FAMILIES)
        )
          setVersion((value) => value + 1);
      }),
    [graphql],
  );
  useEffect(() => {
    if (!graphql) return;
    const abort = new AbortController();
    let current = true;
    const ticket = graphql.controller.capture();
    setResult((old) => ({ ...old, loading: true, error: null }));
    // Retain accepted results during the debounce; exclusions are applied below.
    const timeout = setTimeout(
      () => {
        void graphql.client
          .query({
            query: PaintPickerOptionsDocument,
            variables,
            fetchPolicy: "no-cache",
            context: { fetchOptions: { signal: abort.signal }, queryDeduplication: false },
          })
          .then(({ data }) => {
            if (!current || !data) return;
            if (!graphql.controller.accepts(ticket, data.paintOptions.revision, OPTION_FAMILIES)) {
              setVersion((value) => value + 1);
              return;
            }
            accepted.current = { ticket, revision: data.paintOptions.revision };
            graphql.client.writeQuery({ query: PaintPickerOptionsDocument, variables, data });
            setResult({
              variables,
              scope: graphql,
              items: data.paintOptions.items.map((paint) => getFragmentData(DetailPaintFragmentDoc, paint)),
              loading: false,
              error: null,
            });
          })
          .catch((error: unknown) => {
            if (current)
              setResult({
                variables,
                scope: graphql,
                items: [],
                loading: false,
                error: error instanceof Error ? error : new Error(String(error)),
              });
          });
      },
      variables.search.trim() ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      current = false;
      abort.abort();
      clearTimeout(timeout);
    };
  }, [graphql, variables, version]);
  const pending = result.variables !== variables || result.scope !== graphql || result.loading;
  const items = useSearchResults(!pending ? result.items : null, pending, graphql) ?? [];
  return {
    items: items.filter((item) => !excludeIds.includes(item.id)),
    loading: result.variables !== variables || result.scope !== graphql || result.loading,
    error: result.variables === variables && result.scope === graphql ? result.error : null,
  };
}

export type { PaintDetailView } from "./detail-loader";
