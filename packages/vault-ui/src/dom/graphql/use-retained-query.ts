import { useEffect, useRef } from "react";

// Presentation only: readers still validate and atomically publish complete revisions.
// Identity-bound details must also supply matching data and an identity key.
// An accepted empty envelope is data too. Never retain across vault/access scopes.
export function useRetainedQuery<T>(
  data: T | null | undefined,
  pending: boolean,
  scope: unknown,
  identity?: unknown,
) {
  const previous = useRef<{ scope: unknown; identity: unknown; data: T } | null>(null);
  useEffect(() => {
    if (data != null) previous.current = { scope, identity, data };
    else if (previous.current?.scope !== scope || previous.current?.identity !== identity)
      previous.current = null;
  }, [data, scope, identity]);
  const retained =
    data ??
    (previous.current && previous.current.scope === scope && previous.current.identity === identity
      ? previous.current.data
      : null);
  return {
    data: retained,
    loading: pending && retained == null,
    refreshing: pending && retained != null,
    pending,
  };
}
