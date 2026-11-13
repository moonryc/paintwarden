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
import type { VaultFamily } from "./invalidation";
import { useVaultGraphQL } from "./provider";

const DETAIL_FAMILIES: readonly VaultFamily[] = ["PAINT", "MINIATURES", "SOURCES"];
const OPTION_FAMILIES: readonly VaultFamily[] = ["OPTIONS", "PAINT", "SOURCES"];
const initialWindow = (): DetailWindow => ({ substitutions: 1, usedBy: 1, ingredients: {} });

export function usePaintDetail(id: string) {
  const graphql = useVaultGraphQL();
  const [window, setWindow] = useState(initialWindow);
  const previousId = useRef(id);
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
  useEffect(() => graphql?.controller.listen(DETAIL_FAMILIES, refresh), [graphql, refresh]);
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
  return {
    data: result.id === id && result.scope === graphql ? result.data : null,
    loading: result.id !== id || result.scope !== graphql || result.loading,
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
  const graphql = useVaultGraphQL();
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
    () => graphql?.controller.listen(OPTION_FAMILIES, () => setVersion((value) => value + 1)),
    [graphql],
  );
  useEffect(() => {
    if (!graphql) return;
    let current = true;
    const ticket = graphql.controller.capture();
    setResult((old) => ({ ...old, loading: true, error: null }));
    // Debounce typing without allowing an older query/exclusion set to remain selectable.
    const timeout = setTimeout(() => {
      void graphql.client
        .query({ query: PaintPickerOptionsDocument, variables, fetchPolicy: "no-cache" })
        .then(({ data }) => {
          if (!current || !data) return;
          if (!graphql.controller.accepts(ticket, data.paintOptions.revision, OPTION_FAMILIES)) {
            setVersion((value) => value + 1);
            return;
          }
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
    }, 120);
    return () => {
      current = false;
      clearTimeout(timeout);
    };
  }, [graphql, variables, version]);
  return {
    items: result.variables === variables && result.scope === graphql && !result.loading ? result.items : [],
    loading: result.variables !== variables || result.scope !== graphql || result.loading,
    error: result.variables === variables && result.scope === graphql ? result.error : null,
  };
}

export type { PaintDetailView } from "./detail-loader";
