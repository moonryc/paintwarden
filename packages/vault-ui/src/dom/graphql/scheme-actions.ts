import { useMemo } from "react";

import { useVaultStore } from "../store/hooks";
import type { Notify } from "../types";

import { getFragmentData } from "./generated/fragment-masking";
import {
  CreateColorSchemeDocument,
  UpdateColorSchemeDocument,
  DeleteColorSchemeDocument,
  SchemeEditResultFragmentDoc,
  type SchemeInput,
  type SchemeEditResultFragment,
} from "./generated/graphql";
import type { ReadTicket } from "./invalidation";
import { useVaultGraphQL, type VaultGraphQLScope } from "./provider";

export type { SchemeInput } from "./generated/graphql";
export type SchemeActions = {
  create(input: SchemeInput): Promise<string>;
  update(id: string, input: SchemeInput): Promise<void>;
  remove(id: string): Promise<void>;
};

// Serialize commands per record. Never optimistically invent scheme readiness,
// attachment usage, or recipe entries: every reader replaces its accepted window.
export function createSchemeActions(
  scope: VaultGraphQLScope,
  notify: Notify,
  syncLegacy: () => Promise<void>,
): SchemeActions {
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
          notify(error instanceof Error ? error.message : "Could not save color scheme", "error");
        throw error;
      }
    };
    const result = (queues.get(key) ?? Promise.resolve()).then(task, task);
    queues.set(key, result);
    const release = () => {
      if (queues.get(key) === result) queues.delete(key);
    };
    void result.then(release, release);
    return result;
  };
  const committed = async (payload: SchemeEditResultFragment | null | undefined, ticket: ReadTicket) => {
    if (!scope.controller.isCurrent(ticket)) throw new Error("Vault connection changed. Please try again.");
    if (!payload) throw new Error("Scheme save returned no result");
    scope.controller.committed(payload.revision, payload.invalidatedFamilies);
    await syncLegacy().catch(() => {
      if (scope.controller.isCurrent(ticket))
        notify("Scheme saved; another open screen could not refresh. Please retry its refresh.", "error");
    });
    if (!scope.controller.isCurrent(ticket)) throw new Error("Vault connection changed. Please try again.");
    return payload.schemeId;
  };
  return {
    create: (input) =>
      enqueue("create", async (ticket) => {
        const result = await scope.client.mutate({
          mutation: CreateColorSchemeDocument,
          variables: { input, clientMutationId: `scheme:${++serial}` },
          fetchPolicy: "no-cache",
        });
        return committed(getFragmentData(SchemeEditResultFragmentDoc, result.data?.createScheme), ticket);
      }),
    update: (id, input) =>
      enqueue(id, async (ticket) => {
        const result = await scope.client.mutate({
          mutation: UpdateColorSchemeDocument,
          variables: { id, input, clientMutationId: `scheme:${++serial}` },
          fetchPolicy: "no-cache",
        });
        await committed(getFragmentData(SchemeEditResultFragmentDoc, result.data?.updateScheme), ticket);
      }),
    remove: (id) =>
      enqueue(id, async (ticket) => {
        const result = await scope.client.mutate({
          mutation: DeleteColorSchemeDocument,
          variables: { id, clientMutationId: `scheme:${++serial}` },
          fetchPolicy: "no-cache",
        });
        await committed(getFragmentData(SchemeEditResultFragmentDoc, result.data?.deleteScheme), ticket);
      }),
  };
}

const scopes = new WeakMap<VaultGraphQLScope, SchemeActions>();
export function useSchemeActions(): SchemeActions {
  const scope = useVaultGraphQL();
  const notify = useVaultStore((store) => store.notify);
  const syncLegacy = useVaultStore((store) => store.syncChanges);
  return useMemo(() => {
    if (!scope) throw new Error("Scheme actions require the GraphQL provider");
    let actions = scopes.get(scope);
    if (!actions) {
      actions = createSchemeActions(scope, notify, syncLegacy);
      scopes.set(scope, actions);
    }
    return actions;
  }, [scope, notify, syncLegacy]);
}
