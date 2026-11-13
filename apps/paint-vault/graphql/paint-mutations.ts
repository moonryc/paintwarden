import { GraphQLError } from "graphql";

import { getSqlite } from "../db/index.ts";
import {
  createSubstitution,
  deleteSubstitution,
  updateSubstitution,
} from "../lib/commands/paint-substitutions.ts";
import {
  deleteCustomPaint,
  importCustomPaints,
  PaintCommandError,
  updateCustomPaint,
} from "../lib/commands/paints.ts";

import { invalidationSince } from "./changes.ts";
import type { GraphQLContext } from "./context.ts";
import type { Resolvers } from "./generated/resolvers.ts";
import { readRevision } from "./library.ts";

// Command writes and the resulting trigger-derived revision/families commit together.
// clientMutationId is correlation only, not an idempotency key: creates must not be retried.
function atomic<T extends object>(operation: () => T, clientMutationId?: string | null) {
  try {
    return getSqlite().transaction(() => {
      const before = readRevision();
      const result = operation();
      const changes = invalidationSince({ epoch: before.epoch, since: before.seq });
      return {
        ...result,
        revision: { epoch: changes.epoch, seq: changes.seq },
        clientMutationId,
        invalidatedFamilies: changes.families,
      };
    })();
  } catch (error) {
    if (error instanceof PaintCommandError)
      throw new GraphQLError(error.message, {
        extensions: {
          code: error.status === 404 ? "NOT_FOUND" : error.status === 403 ? "FORBIDDEN" : "BAD_USER_INPUT",
        },
      });
    throw error;
  }
}

export const paintMutations: NonNullable<Resolvers<GraphQLContext>["Mutation"]> = {
  importCustomPaints: (_root, args) =>
    atomic(() => importCustomPaints({ paints: args.paints }), args.clientMutationId),
  updateCustomPaint: (_root, args) =>
    atomic(() => {
      updateCustomPaint(args.id, args.input);
      return { paintId: args.id };
    }, args.clientMutationId),
  deleteCustomPaint: (_root, args) =>
    atomic(() => {
      deleteCustomPaint(args.id);
      return { paintId: args.id };
    }, args.clientMutationId),
  createSubstitution: (_root, args) =>
    atomic(() => ({ substitutionId: createSubstitution(args.input).id }), args.clientMutationId),
  setSubstitutionDefault: (_root, args) =>
    atomic(() => {
      updateSubstitution({ action: "default", id: args.id, enabled: args.enabled });
      return { substitutionId: args.id };
    }, args.clientMutationId),
  deleteSubstitution: (_root, args) =>
    atomic(() => {
      deleteSubstitution(args.id);
      return { substitutionId: args.id };
    }, args.clientMutationId),
  selectPaintSubstitution: (_root, args) =>
    atomic(() => {
      updateSubstitution({ action: "select", ...args });
      return {
        substitutionId: args.useOriginal ? null : args.substitutionId,
        miniatureId: args.miniatureId,
        paintId: args.targetPaintId,
      };
    }, args.clientMutationId),
};
