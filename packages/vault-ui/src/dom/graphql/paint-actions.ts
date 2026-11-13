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
import type { ReadTicket, Revision, VaultFamily } from "./invalidation";
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
export function createPaintCommands(
  scope: VaultGraphQLScope,
  notify: Notify,
  syncLegacy: () => Promise<void>,
): PaintCommands {
  let queue: Promise<unknown> = Promise.resolve();
  let serial = 0;
  const run = <T>(work: (ticket: ReadTicket) => Promise<T>): Promise<T> => {
    const ticket = scope.controller.capture();
    const result = queue.then(async () => {
      if (!scope.controller.isCurrent(ticket)) throw new Error("Vault connection changed. Please try again.");
      try {
        return await work(ticket);
      } catch (error) {
        if (scope.controller.isCurrent(ticket))
          notify(error instanceof Error ? error.message : "Could not save paint", "error");
        throw error;
      }
    });
    queue = result.catch(() => {});
    return result;
  };
  const committed = async <T extends Envelope>(payload: T | null | undefined, ticket: ReadTicket) => {
    if (!scope.controller.isCurrent(ticket)) throw new Error("Vault connection changed. Please try again.");
    if (!payload) throw new Error("Paint command returned no result");
    scope.controller.committed(payload.revision, payload.invalidatedFamilies);
    await syncLegacy().catch(() => {
      if (scope.controller.isCurrent(ticket))
        notify("Saved; another open screen could not refresh. Please retry its refresh.", "error");
    });
    if (!scope.controller.isCurrent(ticket)) throw new Error("Vault connection changed. Please try again.");
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
        if (!payload.substitutionId) throw new Error("Substitution save returned no id");
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
  const syncLegacy = useVaultStore((store) => store.syncChanges);
  return useMemo(() => {
    if (!scope) {
      if (fixture) return fixture;
      throw new Error("Paint commands require the GraphQL provider");
    }
    let commands = scopes.get(scope);
    if (!commands) {
      commands = createPaintCommands(scope, notify, syncLegacy);
      scopes.set(scope, commands);
    }
    return commands;
  }, [scope, fixture, notify, syncLegacy]);
}
