import { GraphQLError } from "graphql";

import { changedKeysSince, changeLogEpoch, pruneChangeLog } from "../db/change-log.ts";
import { getSqlite } from "../db/index.ts";
import { authorizeVault, hostRefused, sameOrigin } from "../lib/auth.ts";

type Cursor = { epoch: string; since: number };
export type Invalidation = { epoch: string; seq: number; reset: boolean };

// Cursor recovery uses the durable-per-process SQLite trigger log, not lossy in-memory PubSub.
// Phase 1 conservatively invalidates every GraphQL family on any logged domain change.
export function invalidationSince(cursor: Cursor): Invalidation {
  const sqlite = getSqlite();
  return sqlite.transaction(() => {
    pruneChangeLog(sqlite);
    const changes = changedKeysSince(sqlite, cursor.epoch, cursor.since);
    return { epoch: changeLogEpoch, seq: changes.seq, reset: changes.reload };
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
