import { GraphQLError } from "graphql";

import { getSqlite } from "../db/index.ts";
import {
  replaceRequirements,
  setMiniatureSchemes,
  setRecipeSteps,
} from "../lib/commands/miniature-recipe.ts";
import {
  createMiniature,
  deleteMiniature,
  MiniatureCommandError,
  updateMiniature,
  withPreparedMiniatureImage,
} from "../lib/commands/miniatures.ts";
import { withImageMutation } from "../lib/image-mutations.ts";
import { deleteImage } from "../lib/image-store.ts";

import { invalidationSince } from "./changes.ts";
import type { GraphQLContext } from "./context.ts";
import type { Resolvers } from "./generated/resolvers.ts";
import { readRevision } from "./library.ts";

function atomic<T extends { miniatureId: string }>(operation: () => T, clientMutationId?: string | null) {
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
}

function mapError(error: unknown): never {
  if (error instanceof MiniatureCommandError)
    throw new GraphQLError(error.message, {
      extensions: {
        code: error.status === 404 ? "NOT_FOUND" : error.status === 409 ? "CONFLICT" : "BAD_USER_INPUT",
      },
    });
  throw error;
}

// Files remain REST; template-image copying and deletion retain the shared image lock.
// Only the synchronous SQL service runs inside the transaction that produces the envelope.
export const miniatureMutations: NonNullable<Resolvers<GraphQLContext>["Mutation"]> = {
  createMiniature: async (_root, args) => {
    try {
      return await withImageMutation(() =>
        withPreparedMiniatureImage(args.input, (key) =>
          atomic(() => ({ miniatureId: createMiniature(args.input, key).id }), args.clientMutationId),
        ),
      );
    } catch (error) {
      return mapError(error);
    }
  },
  updateMiniature: (_root, args) => {
    try {
      return atomic(() => {
        updateMiniature(args.id, args.input);
        return { miniatureId: args.id };
      }, args.clientMutationId);
    } catch (error) {
      return mapError(error);
    }
  },
  deleteMiniature: async (_root, args) => {
    try {
      return await withImageMutation(async () => {
        let key: string | null = null;
        const envelope = atomic(() => {
          key = deleteMiniature(args.id).imageKey;
          return { miniatureId: args.id };
        }, args.clientMutationId);
        await deleteImage(key);
        return envelope;
      });
    } catch (error) {
      return mapError(error);
    }
  },
  setMiniatureRecipe: (_root, args) => {
    try {
      return atomic(() => {
        replaceRequirements({ miniatureId: args.id, entries: args.entries });
        if (args.steps != null) setRecipeSteps({ miniatureId: args.id, steps: args.steps });
        if (args.schemeIds != null) setMiniatureSchemes({ miniatureId: args.id, schemeIds: args.schemeIds });
        return { miniatureId: args.id };
      }, args.clientMutationId);
    } catch (error) {
      return mapError(error);
    }
  },
  setMiniatureSchemes: (_root, args) => {
    try {
      return atomic(() => {
        setMiniatureSchemes({ miniatureId: args.id, schemeIds: args.schemeIds });
        return { miniatureId: args.id };
      }, args.clientMutationId);
    } catch (error) {
      return mapError(error);
    }
  },
};
