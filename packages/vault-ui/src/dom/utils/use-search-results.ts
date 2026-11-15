import { useEffect, useRef } from "react";

/** Retain only previously accepted reads from the same connection while searching.
 * Never write stale data back to Apollo, cross vaults, or hide a settled empty result.
 */
export function useSearchResults<T>(data: T | null, pending: boolean, scope: unknown): T | null {
  const previous = useRef<{ scope: unknown; data: T } | null>(null);
  useEffect(() => {
    if (data !== null) previous.current = { scope, data };
    else if (!pending || previous.current?.scope !== scope) previous.current = null;
  }, [data, pending, scope]);
  return (
    data ??
    (pending && previous.current !== null && previous.current.scope === scope ? previous.current.data : null)
  );
}

export const SEARCH_DEBOUNCE_MS = 250;

/** Shared threshold for bounded dropdown/dialog pagination. */
export function nearSearchBottom(list: HTMLElement): boolean {
  return list.scrollHeight - list.scrollTop - list.clientHeight <= 80;
}

/** Match the server search budget without discarding the user's displayed input. */
export function normalizeSearch(search: string): string {
  return search.trim().slice(0, 128);
}
