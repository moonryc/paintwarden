import type { ReadTicket } from "./invalidation";
import { readMiniatureDetail, type MiniatureDetailView } from "./miniature-detail-loader";
import type { VaultGraphQLScope } from "./provider";

export const MINIATURE_DETAIL_FAMILIES = ["MINIATURES", "SCHEMES", "PAINT", "SOURCES"] as const;
type Entry = { ticket: ReadTicket; data?: MiniatureDetailView; promise: Promise<MiniatureDetailView> };
// Scope identity prevents cross-vault reuse. Keep only a small LRU of complete,
// revision-validated aggregates, never partial pages or speculative cache writes.
const resources = new WeakMap<VaultGraphQLScope, Map<string, Entry>>();
const limit = 12;
function entries(scope: VaultGraphQLScope) {
  let map = resources.get(scope);
  if (!map) resources.set(scope, (map = new Map<string, Entry>()));
  return map;
}
function current(scope: VaultGraphQLScope, entry: Entry) {
  return (
    scope.controller.isCurrent(entry.ticket) &&
    (!entry.data || scope.controller.accepts(entry.ticket, entry.data.revision, MINIATURE_DETAIL_FAMILIES))
  );
}
export function peekMiniatureDetail(scope: VaultGraphQLScope, id: string) {
  const entry = entries(scope).get(id);
  return entry && current(scope, entry) ? (entry.data ?? null) : null;
}
export function invalidateMiniatureDetail(scope: VaultGraphQLScope, id: string) {
  entries(scope).delete(id);
}
export function loadMiniatureDetail(scope: VaultGraphQLScope, id: string) {
  const map = entries(scope);
  const existing = map.get(id);
  if (existing && current(scope, existing)) {
    map.delete(id);
    map.set(id, existing);
    return existing.promise;
  }
  const ticket = scope.controller.capture();
  const entry: Entry = { ticket, promise: readMiniatureDetail(scope.client, id) };
  entry.promise = entry.promise.then(
    (data) => {
      if (scope.controller.accepts(ticket, data.revision, MINIATURE_DETAIL_FAMILIES)) entry.data = data;
      else if (map.get(id) === entry) map.delete(id);
      return data;
    },
    (error) => {
      if (map.get(id) === entry) map.delete(id);
      throw error;
    },
  );
  map.delete(id);
  map.set(id, entry);
  while (map.size > limit) map.delete(map.keys().next().value!);
  return entry.promise;
}
