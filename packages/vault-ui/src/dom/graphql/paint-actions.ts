import { i18n } from "@paint-vault/i18n/runtime";
import { createContext, useContext, useMemo } from "react";

import type { PaintFormValues } from "../Modals/PaintForm";
import { useVaultStore } from "../store/hooks";
import type { Notify } from "../types";

import {
  CreateSubstitutionDocument,
  DeleteCustomPaintDocument,
  DeleteSubstitutionDocument,
  ImportCustomPaintsDocument,
  SetSubstitutionDefaultDocument,
  UpdateCustomPaintDocument,
} from "./generated/graphql";
import type { CommandTicket, Revision, VaultFamily } from "./invalidation";
import { useVaultGraphQL, type VaultGraphQLScope } from "./provider";

type SubstitutionInput = {
  targetPaintId: string;
  name: string;
  ingredients: { paintId: string; parts: number }[];
};
export type PaintCommands = {
  importPaints(paints: PaintFormValues[]): Promise<{ imported: number; skipped: number }>;
  updatePaint(id: string, values: PaintFormValues): Promise<void>;
  deletePaint(id: string): Promise<void>;
  createSubstitution(input: SubstitutionInput): Promise<string>;
  setSubstitutionDefault(id: string, enabled: boolean): Promise<void>;
  deleteSubstitution(id: string): Promise<void>;
};
type Envelope = { revision: Revision; invalidatedFamilies: readonly VaultFamily[] };

// Commands only invalidate server-derived projections; never synthesize catalog/mix state.
// A shared queue also orders default switches affecting different mixes of the same paint.
export function createPaintCommands(scope: VaultGraphQLScope, notify: Notify): PaintCommands {
  let queue: Promise<unknown> = Promise.resolve();
  let serial = 0;
  const run = <T>(work: (ticket: CommandTicket) => Promise<T>): Promise<T> => {
    const ticket = scope.controller.captureCommand();
    const result = queue.then(async () => {
      if (!scope.controller.isCommandCurrent(ticket))
        throw new Error(i18n.t("shell:vaultConnectionChangedPleaseTryAgain"));
      try {
        return await work(ticket);
      } catch (error) {
        if (scope.controller.isCommandCurrent(ticket))
          notify(error instanceof Error ? error.message : i18n.t("shell:couldNotSavePaint"), "error");
        throw error;
      }
    });
    queue = result.catch(() => {});
    return result;
  };
  const committed = async <T extends Envelope>(payload: T | null | undefined, ticket: CommandTicket) => {
    if (!scope.controller.isCommandCurrent(ticket))
      throw new Error(i18n.t("shell:vaultConnectionChangedPleaseTryAgain"));
    if (!payload) throw new Error(i18n.t("shell:paintCommandReturnedNoResult"));
    if (!scope.controller.commitCommand(ticket, payload.revision, payload.invalidatedFamilies))
      throw new Error(i18n.t("shell:vaultConnectionChangedPleaseTryAgain"));
    if (!scope.controller.isCommandCurrent(ticket))
      throw new Error(i18n.t("shell:vaultConnectionChangedPleaseTryAgain"));
    return payload;
  };
  const mutationId = () => `paint:${++serial}`;
  const input = ({ brand, range, name, colorHex, sourceUrl }: PaintFormValues) => ({
    brand,
    range,
    name,
    colorHex,
    sourceUrl,
  });
  return {
    importPaints: (paints) =>
      run(async (ticket) => {
        const result = await scope.client.mutate({
          mutation: ImportCustomPaintsDocument,
          variables: { paints: paints.map(input), clientMutationId: mutationId() },
          fetchPolicy: "no-cache",
        });
        const payload = await committed(result.data?.importCustomPaints, ticket);
        return { imported: payload.imported, skipped: payload.skipped };
      }),
    updatePaint: (id, values) =>
      run(async (ticket) => {
        const result = await scope.client.mutate({
          mutation: UpdateCustomPaintDocument,
          variables: { id, input: input(values), clientMutationId: mutationId() },
          fetchPolicy: "no-cache",
        });
        await committed(result.data?.updateCustomPaint, ticket);
      }),
    deletePaint: (id) =>
      run(async (ticket) => {
        const result = await scope.client.mutate({
          mutation: DeleteCustomPaintDocument,
          variables: { id, clientMutationId: mutationId() },
          fetchPolicy: "no-cache",
        });
        await committed(result.data?.deleteCustomPaint, ticket);
      }),
    createSubstitution: (values) =>
      run(async (ticket) => {
        const { targetPaintId, name, ingredients } = values;
        const result = await scope.client.mutate({
          mutation: CreateSubstitutionDocument,
          variables: {
            input: {
              targetPaintId,
              name,
              ingredients: ingredients.map(({ paintId, parts }) => ({ paintId, parts })),
            },
            clientMutationId: mutationId(),
          },
          fetchPolicy: "no-cache",
        });
        const payload = await committed(result.data?.createSubstitution, ticket);
        if (!payload.substitutionId) throw new Error(i18n.t("shell:substitutionSaveReturnedNoId"));
        return payload.substitutionId;
      }),
    setSubstitutionDefault: (id, enabled) =>
      run(async (ticket) => {
        const result = await scope.client.mutate({
          mutation: SetSubstitutionDefaultDocument,
          variables: { id, enabled, clientMutationId: mutationId() },
          fetchPolicy: "no-cache",
        });
        await committed(result.data?.setSubstitutionDefault, ticket);
      }),
    deleteSubstitution: (id) =>
      run(async (ticket) => {
        const result = await scope.client.mutate({
          mutation: DeleteSubstitutionDocument,
          variables: { id, clientMutationId: mutationId() },
          fetchPolicy: "no-cache",
        });
        await committed(result.data?.deleteSubstitution, ticket);
      }),
  };
}

// Explicit adapter for fixture-only renders, never a REST command fallback.
export const PaintCommandsContext = createContext<PaintCommands | null>(null);
const scopes = new WeakMap<VaultGraphQLScope, PaintCommands>();
export function usePaintCommands(): PaintCommands {
  const scope = useVaultGraphQL();
  const fixture = useContext(PaintCommandsContext);
  const notify = useVaultStore((store) => store.notify);
  return useMemo(() => {
    if (!scope) {
      if (fixture) return fixture;
      throw new Error(i18n.t("shell:paintCommandsRequireTheGraphqlProvider"));
    }
    let commands = scopes.get(scope);
    if (!commands) {
      commands = createPaintCommands(scope, notify);
      scopes.set(scope, commands);
    }
    return commands;
  }, [scope, fixture, notify]);
}
