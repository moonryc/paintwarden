import { useEffect, useRef } from "react";

import { usePageLoading } from "../Components/PageLoadingStatus";

import { useFirstScreenReady } from "../utils/FirstScreenPreload";

// Only replace a page before its first successful read. Later query/filter loads
// keep the controls mounted, and background updates keep the accepted content.
export function useInitialPageLoading(
  loading: boolean,
  hasError: boolean,
  screen = true,
  identity?: unknown,
) {
  const loaded = useRef({ identity, ready: false });
  if (loaded.current.identity !== identity) loaded.current = { identity, ready: false };
  useFirstScreenReady(screen && !loading && !hasError);
  useEffect(() => {
    if (!loading && !hasError) loaded.current.ready = true;
  }, [loading, hasError, identity]);
  const initialLoading = loading && !loaded.current.ready;
  usePageLoading(screen && initialLoading);
  return initialLoading;
}
