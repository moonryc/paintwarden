import type { ApolloClient } from "@apollo/client";
import type { RecipeStep } from "@paint-vault/core/recipe-steps";
import { i18n } from "@paint-vault/i18n/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getFragmentData } from "../graphql/generated/fragment-masking";
import {
  CreateReusableTemplateDocument,
  DeleteReusableTemplateDocument,
  SelectedTemplateRecipeDocument,
  TemplateCommandResultFragmentDoc,
  TemplateSourceMiniatureDocument,
  TemplateSummariesDocument,
  TemplateSummaryFieldsFragmentDoc,
  UpdateReusableTemplateDocument,
  type TemplateCommandResultFragment,
  type TemplateInput,
} from "../graphql/generated/graphql";
import type { CommandTicket, ReadTicket, Revision, VaultFamily } from "../graphql/invalidation";
import { useVaultGraphQL, type VaultGraphQLScope } from "../graphql/provider";
import {
  readTemplateRecipe,
  readTemplateSourceMiniature,
  readTemplateSummaries,
  TEMPLATE_PAGE_SIZE,
  type TemplateVariables,
} from "../graphql/template-loader";
import type { MiniatureTemplate } from "../types";

import { useVaultStore } from "./hooks";

const TEMPLATE_FAMILIES: readonly VaultFamily[] = ["TEMPLATES", "SOURCES"];
const SOURCE_FAMILIES: readonly VaultFamily[] = ["MINIATURES", "SCHEMES", "PAINT", "SOURCES"];
type WindowState<T> = {
  key: string;
  scope: VaultGraphQLScope | null;
  data: T | null;
  loading: boolean;
  error: Error | null;
};

// Network pages are no-cache. A full revision-consistent loaded window is the
// sole publication unit, after the scope generation and family watermarks pass.
function useTemplateWindow<T>(
  key: string,
  enabled: boolean,
  families: readonly VaultFamily[],
  read: (client: ApolloClient, pages: number) => Promise<T>,
  revision: (data: T) => Revision,
  write: (client: ApolloClient, data: T) => void,
  hasMore: (data: T) => boolean,
) {
  const scope = useVaultGraphQL();
  const [state, setState] = useState<WindowState<T>>({
    key,
    scope,
    data: null,
    loading: enabled,
    error: null,
  });
  const commands = useRef({ refetch: () => {}, more: () => {} });
  useEffect(() => {
    commands.current = { refetch: () => {}, more: () => {} };
    if (!enabled || !scope) {
      setState({
        key,
        scope,
        data: null,
        loading: false,
        error: enabled ? new Error(i18n.t("shell:requestFailed")) : null,
      });
      return;
    }
    let active = true;
    let running = false;
    let pending = true;
    let pages = 1;
    let current: T | null = null;
    let accepted: ReadTicket | null = null;
    const { client, controller } = scope;
    const run = async () => {
      if (!active || running) return;
      running = true;
      setState({ key, scope, data: current, loading: true, error: null });
      try {
        while (active && pending) {
          pending = false;
          const ticket = controller.capture();
          const next = await read(client, pages);
          if (!active) return;
          if (!controller.accepts(ticket, revision(next), families)) {
            pending = true;
            continue;
          }
          write(client, next);
          current = next;
          accepted = ticket;
          setState({ key, scope, data: next, loading: pending, error: null });
        }
      } catch (error) {
        if (active)
          setState({
            key,
            scope,
            data: current,
            loading: false,
            error: error instanceof Error ? error : new Error(i18n.t("shell:requestFailed")),
          });
      } finally {
        running = false;
      }
    };
    const refetch = () => {
      pending = true;
      void run();
    };
    commands.current = {
      refetch,
      more: () => {
        if (running || !current || !hasMore(current)) return;
        pages += 1;
        refetch();
      },
    };
    const unsubscribe = controller.listen(families, () => {
      if (
        current &&
        accepted &&
        controller.isCurrent(accepted) &&
        controller.isFresh(revision(current), families)
      )
        return;
      refetch();
    });
    setState({ key, scope, data: null, loading: true, error: null });
    const timer = setTimeout(() => void run(), 80);
    return () => {
      clearTimeout(timer);
      active = false;
      unsubscribe();
    };
  }, [scope, key, enabled, families, read, revision, write, hasMore]);
  const matches = state.key === key && state.scope === scope;
  return {
    data: enabled && matches ? state.data : null,
    loading: enabled && (!matches || state.loading),
    error: matches ? state.error : null,
    refetch: useCallback(() => commands.current.refetch(), []),
    loadMore: useCallback(() => commands.current.more(), []),
  };
}

const summaryRevision = (data: Awaited<ReturnType<typeof readTemplateSummaries>>) => data.templates.revision;
const summaryHasMore = (data: Awaited<ReturnType<typeof readTemplateSummaries>>) =>
  data.templates.templates.pageInfo.hasNextPage;
export function useTemplateCatalog(enabled = true, filters: TemplateVariables = {}) {
  const scope = useVaultGraphQL();
  const facets = useRef<{
    scope: VaultGraphQLScope | null;
    categoryCounts: Array<{ key: string; label: string; count: number }>;
    sourceCounts: Array<{ key: string; label: string; count: number }>;
  }>({ scope, categoryCounts: [], sourceCounts: [] });
  const key = JSON.stringify({
    id: filters.id ?? null,
    search: filters.search?.trim() || null,
    category: filters.category || null,
    sourceId: filters.sourceId || null,
    noSource: filters.noSource ?? false,
  });
  const variables = useMemo(() => JSON.parse(key) as TemplateVariables, [key]);
  const read = useCallback(
    (client: ApolloClient, pages: number) => readTemplateSummaries(client, variables, pages),
    [variables],
  );
  const write = useCallback(
    (client: ApolloClient, data: Awaited<ReturnType<typeof readTemplateSummaries>>) => {
      client.writeQuery({
        query: TemplateSummariesDocument,
        variables: { ...variables, first: TEMPLATE_PAGE_SIZE, after: null },
        data,
      });
    },
    [variables],
  );
  const result = useTemplateWindow(
    key,
    enabled,
    TEMPLATE_FAMILIES,
    read,
    summaryRevision,
    write,
    summaryHasMore,
  );
  if (result.data)
    facets.current = {
      scope,
      categoryCounts: result.data.templates.categoryCounts,
      sourceCounts: result.data.templates.sourceCounts,
    };
  if (facets.current.scope !== scope) facets.current = { scope, categoryCounts: [], sourceCounts: [] };
  const data = useMemo(
    () =>
      result.data
        ? {
            sourceVersion: null,
            categories: result.data.templates.categoryCounts.map((facet) => facet.key),
            categoryCounts: result.data.templates.categoryCounts,
            sourceCounts: result.data.templates.sourceCounts,
            templates: getFragmentData(
              TemplateSummaryFieldsFragmentDoc,
              result.data.templates.templates.nodes,
            ).map((row): MiniatureTemplate => ({
              ...row,
              kind: row.kind === "user" ? "user" : "source",
              sourceName: row.sourceName ?? undefined,
            })),
            totalCount: result.data.templates.templates.totalCount,
            hasNextPage: result.data.templates.templates.pageInfo.hasNextPage,
          }
        : undefined,
    [result.data],
  );
  return {
    ...result,
    data,
    revision: result.data?.templates.revision,
    categories: facets.current.categoryCounts.map((facet) => facet.key),
    categoryCounts: facets.current.categoryCounts,
    sourceCounts: facets.current.sourceCounts,
    isStale: result.loading,
  };
}

const recipeRevision = (data: Awaited<ReturnType<typeof readTemplateRecipe>>) => data.templateRecipe.revision;
const sourceRevision = (data: Awaited<ReturnType<typeof readTemplateSourceMiniature>>) =>
  data.miniature.revision;
const noMore = () => false;
export function useTemplateRecipe(id: string | null) {
  const read = useCallback((client: ApolloClient) => readTemplateRecipe(client, id!), [id]);
  const write = useCallback(
    (client: ApolloClient, data: Awaited<ReturnType<typeof readTemplateRecipe>>) => {
      client.writeQuery({
        query: SelectedTemplateRecipeDocument,
        variables: { id: id!, paintAfter: null, schemeAfter: null },
        data,
      });
    },
    [id],
  );
  const result = useTemplateWindow(
    id ?? "",
    id !== null,
    TEMPLATE_FAMILIES,
    read,
    recipeRevision,
    write,
    noMore,
  );
  const data = useMemo(
    () =>
      result.data
        ? {
            revision: result.data.templateRecipe.revision,
            schemeIds: result.data.templateRecipe.schemes.nodes.map((row) => row.schemeId),
            schemeOptions: result.data.templateRecipe.schemes.nodes.map((row) => ({
              id: row.schemeId,
              name: row.name,
            })),
            paints: result.data.templateRecipe.paints.nodes.map((row) => ({
              paintId: row.paintId,
              step: row.step as RecipeStep,
              notes: row.notes,
              sortOrder: row.sortOrder,
            })),
            paintOptions: result.data.templateRecipe.paints.nodes.map((row) => ({
              id: row.paintId,
              name: row.paintName,
              brand: row.paintBrand,
            })),
          }
        : undefined,
    [result.data],
  );
  return { ...result, data, isStale: result.loading };
}

export function useTemplateSourceMiniature(id: string | null) {
  const read = useCallback((client: ApolloClient) => readTemplateSourceMiniature(client, id!), [id]);
  const write = useCallback(
    (client: ApolloClient, data: Awaited<ReturnType<typeof readTemplateSourceMiniature>>) => {
      client.writeQuery({
        query: TemplateSourceMiniatureDocument,
        variables: { id: id!, paintAfter: null, schemeAfter: null },
        data,
      });
    },
    [id],
  );
  const result = useTemplateWindow(
    id ?? "",
    id !== null,
    SOURCE_FAMILIES,
    read,
    sourceRevision,
    write,
    noMore,
  );
  const data = useMemo(
    () =>
      result.data
        ? {
            miniature: result.data.miniature.miniature,
            schemeIds: result.data.miniature.schemes.nodes.map((row) => row.scheme.id),
            schemeOptions: result.data.miniature.schemes.nodes.map((row) => row.scheme),
            paints: result.data.miniature.recipe.nodes.map((row) => ({
              paintId: row.paint.id,
              step: row.step as RecipeStep,
              notes: row.notes,
              sortOrder: row.sortOrder,
            })),
            paintOptions: result.data.miniature.recipe.nodes.map((row) => row.paint),
          }
        : undefined,
    [result.data],
  );
  return { ...result, data, isStale: result.loading };
}

export function createTemplateActions(scope: VaultGraphQLScope) {
  let serial = 0;
  const queues = new Map<string, Promise<unknown>>();
  const enqueue = <T>(id: string, work: (ticket: CommandTicket) => Promise<T>) => {
    const ticket = scope.controller.captureCommand();
    const run = async () => {
      if (!scope.controller.isCommandCurrent(ticket))
        throw new Error(i18n.t("shell:vaultConnectionChangedPleaseTryAgain"));
      return work(ticket);
    };
    const result = (queues.get(id) ?? Promise.resolve()).then(run, run);
    queues.set(id, result);
    void result
      .finally(() => {
        if (queues.get(id) === result) queues.delete(id);
      })
      .catch(() => {});
    return result;
  };
  const committed = (payload: TemplateCommandResultFragment | null | undefined, ticket: CommandTicket) => {
    if (!scope.controller.isCommandCurrent(ticket))
      throw new Error(i18n.t("shell:vaultConnectionChangedPleaseTryAgain"));
    if (!payload) throw new Error(i18n.t("shell:requestFailed"));
    if (!scope.controller.commitCommand(ticket, payload.revision, payload.invalidatedFamilies))
      throw new Error(i18n.t("shell:vaultConnectionChangedPleaseTryAgain"));
    return payload.templateId;
  };
  return {
    create: (input: TemplateInput) =>
      enqueue("create", async (ticket) => {
        const result = await scope.client.mutate({
          mutation: CreateReusableTemplateDocument,
          variables: { input, clientMutationId: `template:${++serial}` },
          fetchPolicy: "no-cache",
        });
        return committed(
          getFragmentData(TemplateCommandResultFragmentDoc, result.data?.createTemplate),
          ticket,
        );
      }),
    update: (id: string, input: TemplateInput) =>
      enqueue(id, async (ticket) => {
        const result = await scope.client.mutate({
          mutation: UpdateReusableTemplateDocument,
          variables: { id, input, clientMutationId: `template:${++serial}` },
          fetchPolicy: "no-cache",
        });
        committed(getFragmentData(TemplateCommandResultFragmentDoc, result.data?.updateTemplate), ticket);
      }),
    remove: (id: string) =>
      enqueue(id, async (ticket) => {
        const result = await scope.client.mutate({
          mutation: DeleteReusableTemplateDocument,
          variables: { id, clientMutationId: `template:${++serial}` },
          fetchPolicy: "no-cache",
        });
        committed(getFragmentData(TemplateCommandResultFragmentDoc, result.data?.deleteTemplate), ticket);
      }),
  };
}
const actionScopes = new WeakMap<VaultGraphQLScope, ReturnType<typeof createTemplateActions>>();
export function useTemplateActions() {
  const scope = useVaultGraphQL();
  const notify = useVaultStore((store) => store.notify);
  return useMemo(() => {
    if (!scope) throw new Error(i18n.t("shell:requestFailed"));
    let actions = actionScopes.get(scope);
    if (!actions) {
      actions = createTemplateActions(scope);
      actionScopes.set(scope, actions);
    }
    const report = async <T>(work: () => Promise<T>) => {
      const ticket = scope.controller.captureCommand();
      try {
        return await work();
      } catch (error) {
        if (scope.controller.isCommandCurrent(ticket))
          notify(error instanceof Error ? error.message : i18n.t("shell:requestFailed"), "error");
        throw error;
      }
    };
    return {
      create: (input: TemplateInput) => report(() => actions.create(input)),
      update: (id: string, input: TemplateInput) => report(() => actions.update(id, input)),
      remove: (id: string) => report(() => actions.remove(id)),
    };
  }, [scope, notify]);
}
