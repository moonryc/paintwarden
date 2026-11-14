import { useEffect, useRef } from "react";

import { useFirstScreenReady } from "../utils/FirstScreenPreload";

// Only replace a page before its first successful read. Later query/filter loads
// keep the controls mounted, and background updates keep the accepted content.
export function useInitialPageLoading(loading: boolean, hasError: boolean, screen = true) {
  const loaded = useRef(false);
  useFirstScreenReady(screen && !loading && !hasError);
  useEffect(() => {
    if (!loading && !hasError) loaded.current = true;
  }, [loading, hasError]);
  return loading && !loaded.current;
}
