import { useCallback, useEffect, useRef, useState } from "react";

import { makeFragmentData } from "./generated/fragment-masking";
import { DetailPaintFragmentDoc, ProjectMiniatureDetailsDocument } from "./generated/graphql";
import type { ReadTicket, Revision, VaultFamily } from "./invalidation";
import { readMiniatureDetail, type MiniatureDetailView } from "./miniature-detail-loader";
import { useVaultGraphQL } from "./provider";
import { useRetainedQuery } from "./use-retained-query";

const FAMILIES: readonly VaultFamily[] = ["MINIATURES", "SCHEMES", "PAINT", "SOURCES"];

export function useMiniatureDetail(id: string) {
  const scope = useVaultGraphQL();
  const [version, setVersion] = useState(0);
  const accepted = useRef<{ ticket: ReadTicket; revision: Revision } | null>(null);
  const [result, setResult] = useState<{
    id: string;
    scope: typeof scope;
    data: MiniatureDetailView | null;
    loading: boolean;
    error: Error | null;
  }>({ id, scope, data: null, loading: true, error: null });
  const refresh = useCallback(() => setVersion((old) => old + 1), []);
  useEffect(
    () =>
      scope?.controller.listen(FAMILIES, () => {
        const previous = accepted.current;
        if (
          !previous ||
          !scope.controller.isCurrent(previous.ticket) ||
          !scope.controller.isFresh(previous.revision, FAMILIES)
        )
          refresh();
      }),
    [scope, refresh],
  );
  useEffect(() => {
    if (!scope) return;
    let active = true;
    const ticket = scope.controller.capture();
    setResult((old) => ({
      id,
      scope,
      data: old.id === id && old.scope === scope ? old.data : null,
      loading: true,
      error: null,
    }));
    void readMiniatureDetail(scope.client, id)
      .then((data) => {
        if (!active) return;
        if (!scope.controller.accepts(ticket, data.revision, FAMILIES)) {
          refresh();
          return;
        }
        accepted.current = { ticket, revision: data.revision };
        // Cache publication happens only after every page and attached scheme has
        // the same accepted revision. No partial entity writes from network pages.
        scope.client.writeQuery({
          query: ProjectMiniatureDetailsDocument,
          variables: { id },
          data: {
            miniature: {
              ...data,
              recipe: {
                ...data.recipe,
                nodes: data.recipe.nodes.map((row) => ({
                  ...row,
                  paint: makeFragmentData(row.paint, DetailPaintFragmentDoc),
                })),
              },
              missing: {
                ...data.missing,
                nodes: data.missing.nodes.map((row) => ({
                  ...row,
                  paint: makeFragmentData(row.paint, DetailPaintFragmentDoc),
                })),
              },
              required: {
                ...data.required,
                nodes: data.required.nodes.map((paint) => makeFragmentData(paint, DetailPaintFragmentDoc)),
              },
            },
          },
        });
        setResult({ id, scope, data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (active)
          setResult((old) => ({
            ...old,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          }));
      });
    return () => {
      active = false;
    };
  }, [scope, id, version, refresh]);
  const retained = useRetainedQuery(
    result.id === id && result.scope === scope ? result.data : null,
    result.id !== id || result.scope !== scope || result.loading,
    scope,
    id,
  );
  return {
    ...retained,
    error: result.id === id && result.scope === scope ? result.error : null,
    refresh,
  };
}
