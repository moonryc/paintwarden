import { useEffect, useRef } from "react";

// Only replace a page before its first successful read. Later query/filter loads
// keep the controls mounted, and background updates keep the accepted content.
export function useInitialPageLoading(loading: boolean, hasError: boolean) {
  const loaded = useRef(false);
  useEffect(() => {
    if (!loading && !hasError) loaded.current = true;
  }, [loading, hasError]);
  return loading && !loaded.current;
}
