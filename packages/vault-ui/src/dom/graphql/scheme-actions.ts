import { i18n } from "@paint-vault/i18n/runtime";
import { useMemo } from "react";

import { useVaultStore } from "../store/hooks";
import type { Notify } from "../types";

import { getFragmentData } from "./generated/fragment-masking";
import {
  CreateColorSchemeDocument,
  DeleteColorSchemeDocument,
  SchemeEditResultFragmentDoc,
  UpdateColorSchemeDocument,
  type SchemeEditResultFragment,
  type SchemeInput,
} from "./generated/graphql";
import type { CommandTicket } from "./invalidation";
import { useVaultGraphQL, type VaultGraphQLScope } from "./provider";

export type { SchemeInput } from "./generated/graphql";
export type SchemeActions = {
  create(input: SchemeInput): Promise<string>;
  update(id: string, input: SchemeInput): Promise<void>;
  remove(id: string): Promise<void>;
};

// Serialize commands per record. Never optimistically invent scheme readiness,
// attachment usage, or recipe entries: every reader replaces its accepted window.
export function createSchemeActions(scope: VaultGraphQLScope, notify: Notify): SchemeActions {
  const queues = new Map<string, Promise<unknown>>();
  let serial = 0;
  const enqueue = <T>(key: string, work: (ticket: CommandTicket) => Promise<T>): Promise<T> => {
    const ticket = scope.controller.captureCommand();
    const task = async () => {
      if (!scope.controller.isCommandCurrent(ticket))
        throw new Error(i18n.t("shell:vaultConnectionChangedPleaseTryAgain"));
      try {
        return await work(ticket);
      } catch (error) {
        if (scope.controller.isCommandCurrent(ticket))
          notify(error instanceof Error ? error.message : i18n.t("shell:couldNotSaveColorScheme"), "error");
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
  const committed = async (payload: SchemeEditResultFragment | null | undefined, ticket: CommandTicket) => {
    if (!scope.controller.isCommandCurrent(ticket))
      throw new Error(i18n.t("shell:vaultConnectionChangedPleaseTryAgain"));
    if (!payload) throw new Error(i18n.t("shell:schemeSaveReturnedNoResult"));
    if (!scope.controller.commitCommand(ticket, payload.revision, payload.invalidatedFamilies))
      throw new Error(i18n.t("shell:vaultConnectionChangedPleaseTryAgain"));
    if (!scope.controller.isCommandCurrent(ticket))
      throw new Error(i18n.t("shell:vaultConnectionChangedPleaseTryAgain"));
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
  return useMemo(() => {
    if (!scope) throw new Error(i18n.t("shell:schemeActionsRequireTheGraphqlProvider"));
    let actions = scopes.get(scope);
    if (!actions) {
      actions = createSchemeActions(scope, notify);
      scopes.set(scope, actions);
    }
    return actions;
  }, [scope, notify]);
}
