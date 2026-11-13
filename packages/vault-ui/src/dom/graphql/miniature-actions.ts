import { useMemo } from "react";

import { useVaultStore } from "../store/hooks";
import type { Api, MiniatureFormValues, Notify, RecipeStep, Requirement } from "../types";
import { imageFormData } from "../utils/image";

import { getFragmentData } from "./generated/fragment-masking";
import {
  CreateProjectMiniatureDocument,
  DeleteProjectMiniatureDocument,
  MiniatureEditResultFragmentDoc,
  SetProjectRecipeDocument,
  SetProjectSchemesDocument,
  UpdateProjectMiniatureDocument,
  type MiniatureEditResultFragment,
  type MiniatureInput,
} from "./generated/graphql";
import type { ReadTicket } from "./invalidation";
import { useVaultGraphQL, type VaultGraphQLScope } from "./provider";

type Values = MiniatureInput | MiniatureFormValues;
type Entry = Omit<Requirement, "miniatureId">;
export type MiniatureActions = {
  create(values: MiniatureFormValues): Promise<string>;
  update(id: string, values: Values): Promise<void>;
  remove(id: string): Promise<void>;
  setRecipe(id: string, entries: Entry[], steps?: RecipeStep[]): Promise<void>;
  setSchemes(id: string, schemeIds: string[]): Promise<void>;
};

function input(values: Values): MiniatureInput {
  const {
    title,
    status,
    notes,
    manufacturer,
    faction,
    scale,
    paintingStatus,
    templateId,
    includeTemplateImage,
  } = values;
  if (status != null && status !== "OWNED" && status !== "WISHLIST")
    throw new Error("Invalid miniature collection");
  return {
    title,
    status,
    notes,
    manufacturer,
    faction,
    scale,
    paintingStatus,
    templateId,
    includeTemplateImage,
  };
}

// One queue per miniature prevents rapid recipe/stage edits from overtaking each other.
// Derived readiness is never optimistic; accepted complete detail windows replace it.
export function createMiniatureActions(
  scope: VaultGraphQLScope,
  api: Api,
  notify: Notify,
  syncLegacy: () => Promise<void>,
): MiniatureActions {
  const queues = new Map<string, Promise<unknown>>();
  let serial = 0;
  const enqueue = <T>(key: string, work: (ticket: ReadTicket) => Promise<T>): Promise<T> => {
    const ticket = scope.controller.capture();
    const task = async () => {
      if (!scope.controller.isCurrent(ticket)) throw new Error("Vault connection changed. Please try again.");
      try {
        return await work(ticket);
      } catch (error) {
        if (scope.controller.isCurrent(ticket))
          notify(error instanceof Error ? error.message : "Could not save miniature", "error");
        throw error;
      }
    };
    const result = (queues.get(key) ?? Promise.resolve()).then(task, task);
    queues.set(key, result);
    void result.then(
      () => {
        if (queues.get(key) === result) queues.delete(key);
      },
      () => {
        if (queues.get(key) === result) queues.delete(key);
      },
    );
    return result;
  };
  const committed = async (payload: MiniatureEditResultFragment | null | undefined, ticket: ReadTicket) => {
    if (!scope.controller.isCurrent(ticket)) throw new Error("Vault connection changed. Please try again.");
    if (!payload) throw new Error("Miniature save returned no result");
    scope.controller.committed(payload.revision, payload.invalidatedFamilies);
    await syncLegacy().catch(() => {
      if (scope.controller.isCurrent(ticket))
        notify("Miniature saved; another open screen could not refresh. Please retry its refresh.", "error");
    });
    if (!scope.controller.isCurrent(ticket)) throw new Error("Vault connection changed. Please try again.");
    return payload.miniatureId;
  };
  const saveImage = async (id: string, values: Values, ticket: ReadTicket) => {
    if (!scope.controller.isCurrent(ticket)) throw new Error("Vault connection changed. Please try again.");
    if (!("image" in values)) return;
    if (values.removeImage)
      await api(`/api/miniatures/${encodeURIComponent(id)}/image`, { method: "DELETE" });
    else if (values.image)
      await api(`/api/miniatures/${encodeURIComponent(id)}/image`, {
        method: "POST",
        body: await imageFormData(values.image),
      });
  };
  return {
    create: (values) =>
      enqueue("create", async (ticket) => {
        const result = await scope.client.mutate({
          mutation: CreateProjectMiniatureDocument,
          variables: { input: input(values), clientMutationId: `miniature:${++serial}` },
          fetchPolicy: "no-cache",
        });
        const id = await committed(
          getFragmentData(MiniatureEditResultFragmentDoc, result.data?.createMiniature),
          ticket,
        );
        try {
          await saveImage(id, values, ticket);
        } catch (error) {
          if (!scope.controller.isCurrent(ticket)) throw error;
          // The record exists already. Do not invite a duplicate create on retry.
          notify(
            "Miniature created, but its image could not be saved. Reopen Edit to retry the image.",
            "error",
          );
        }
        return id;
      }),
    update: (id, values) =>
      enqueue(id, async (ticket) => {
        const result = await scope.client.mutate({
          mutation: UpdateProjectMiniatureDocument,
          variables: { id, input: input(values), clientMutationId: `miniature:${++serial}` },
          fetchPolicy: "no-cache",
        });
        await committed(
          getFragmentData(MiniatureEditResultFragmentDoc, result.data?.updateMiniature),
          ticket,
        );
        await saveImage(id, values, ticket);
      }),
    remove: (id) =>
      enqueue(id, async (ticket) => {
        const result = await scope.client.mutate({
          mutation: DeleteProjectMiniatureDocument,
          variables: { id, clientMutationId: `miniature:${++serial}` },
          fetchPolicy: "no-cache",
        });
        await committed(
          getFragmentData(MiniatureEditResultFragmentDoc, result.data?.deleteMiniature),
          ticket,
        );
      }),
    setRecipe: (id, entries, steps) =>
      enqueue(id, async (ticket) => {
        const result = await scope.client.mutate({
          mutation: SetProjectRecipeDocument,
          variables: {
            id,
            entries: entries.map(({ id: entryId, paintId, step, notes, sortOrder }) => ({
              id: entryId,
              paintId,
              step,
              notes,
              sortOrder,
            })),
            steps,
            clientMutationId: `miniature:${++serial}`,
          },
          fetchPolicy: "no-cache",
        });
        await committed(
          getFragmentData(MiniatureEditResultFragmentDoc, result.data?.setMiniatureRecipe),
          ticket,
        );
      }),
    setSchemes: (id, schemeIds) =>
      enqueue(id, async (ticket) => {
        const result = await scope.client.mutate({
          mutation: SetProjectSchemesDocument,
          variables: { id, schemeIds, clientMutationId: `miniature:${++serial}` },
          fetchPolicy: "no-cache",
        });
        await committed(
          getFragmentData(MiniatureEditResultFragmentDoc, result.data?.setMiniatureSchemes),
          ticket,
        );
      }),
  };
}

const scopes = new WeakMap<VaultGraphQLScope, MiniatureActions>();
export function useMiniatureActions(): MiniatureActions {
  const scope = useVaultGraphQL();
  const api = useVaultStore((store) => store.api);
  const notify = useVaultStore((store) => store.notify);
  const syncLegacy = useVaultStore((store) => store.syncChanges);
  return useMemo(() => {
    if (!scope) throw new Error("Miniature actions require the GraphQL provider");
    let actions = scopes.get(scope);
    if (!actions) {
      actions = createMiniatureActions(scope, api, notify, syncLegacy);
      scopes.set(scope, actions);
    }
    return actions;
  }, [scope, api, notify, syncLegacy]);
}
