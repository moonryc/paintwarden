import { GraphQLError } from "graphql";

import { changedKeysSince, changeLogEpoch, pruneChangeLog } from "../db/change-log.ts";
import { getSqlite } from "../db/index.ts";
import { authorizeVault, hostRefused, sameOrigin } from "../lib/auth.ts";

type Cursor = { epoch: string; since: number };
export const ALL_FAMILIES = [
  "LIBRARY",
  "PAINT",
  "OPTIONS",
  "HOME",
  "MINIATURES",
  "WISHLIST",
  "SCHEMES",
  "TEMPLATES",
  "SOURCES",
] as const;
export type Family = (typeof ALL_FAMILIES)[number];
export type Invalidation = { epoch: string; seq: number; reset: boolean; families: Family[] };

const availability: Family[] = ["LIBRARY", "PAINT", "OPTIONS", "HOME", "MINIATURES", "WISHLIST", "SCHEMES"];
const familyByTable: Record<string, readonly Family[]> = {
  paintRecords: availability,
  paintSubstitutions: availability,
  paintSubstitutionIngredients: availability,
  catalog: [...availability, "TEMPLATES"],
  miniatures: ["MINIATURES", "HOME", "WISHLIST", "PAINT", "SCHEMES"],
  requirements: ["MINIATURES", "HOME", "WISHLIST", "PAINT"],
  recipeSteps: ["MINIATURES", "HOME", "WISHLIST", "PAINT"],
  miniaturePaintSubstitutions: ["MINIATURES", "HOME", "WISHLIST", "PAINT"],
  miniatureColorSchemes: ["MINIATURES", "HOME", "WISHLIST", "PAINT", "SCHEMES"],
  colorSchemes: ["SCHEMES", "MINIATURES", "TEMPLATES"],
  colorSchemePaints: ["SCHEMES", "MINIATURES", "HOME", "WISHLIST", "PAINT", "TEMPLATES"],
  colorSchemeDividers: ["SCHEMES", "MINIATURES", "TEMPLATES"],
  colorSchemeImages: ["SCHEMES", "MINIATURES", "TEMPLATES"],
};

// Cursor recovery reads durable trigger keys, including tombstones/cascades. Mapping
// is family-level where a deleted parent cannot safely be reconstructed.
export function invalidationSince(cursor: Cursor): Invalidation {
  const sqlite = getSqlite();
  return sqlite.transaction(() => {
    pruneChangeLog(sqlite);
    const changes = changedKeysSince(sqlite, cursor.epoch, cursor.since);
    const families = changes.reload
      ? [...ALL_FAMILIES]
      : [
          ...new Set<Family>([
            ...(changes.sourcesChanged ? ["SOURCES" as const] : []),
            ...changes.keys.flatMap(({ table }) => familyByTable[table] ?? ALL_FAMILIES),
          ]),
        ];
    return { epoch: changeLogEpoch, seq: changes.seq, reset: changes.reload, families };
  })();
}

export function subscribeChanges(
  request: Request,
  cursor: Cursor,
  intervalMs = 1000,
): AsyncIterableIterator<{ vaultChanges: Invalidation }> {
  let closed = false;
  let initial = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resume: (() => void) | undefined;
  const close = () => {
    closed = true;
    if (timer) clearTimeout(timer);
    resume?.();
    request.signal.removeEventListener("abort", close);
  };
  request.signal.addEventListener("abort", close, { once: true });
  if (request.signal.aborted) close();
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next() {
      while (!closed) {
        if (!initial)
          await new Promise<void>((resolve) => {
            resume = resolve;
            timer = setTimeout(resolve, intervalMs);
          });
        timer = undefined;
        resume = undefined;
        if (closed) break;
        // Session revocation, expiry, setup/reset and changed host policy terminate idle streams too.
        const denied =
          hostRefused(request) ||
          (!sameOrigin(request) ? new Response(null, { status: 403 }) : authorizeVault(request));
        if (denied) {
          close();
          throw new GraphQLError("Vault access ended", {
            extensions: { code: "UNAUTHENTICATED", http: { status: denied.status } },
          });
        }
        const event = invalidationSince(cursor);
        const emit = initial || event.reset || event.epoch !== cursor.epoch || event.seq !== cursor.since;
        initial = false;
        cursor = { epoch: event.epoch, since: event.seq };
        if (emit) return { done: false as const, value: { vaultChanges: event } };
      }
      return { done: true as const, value: undefined };
    },
    async return() {
      close();
      return { done: true as const, value: undefined };
    },
    async throw(error: unknown) {
      close();
      throw error;
    },
  };
}
