import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { preloadDialogs } from "../dialog-preload";

import { scheduleIdlePreload } from "./idle-preload";

const ScreenReadyContext = createContext<() => void>(() => undefined);

export function useFirstScreenReady(ready: boolean) {
  const reportReady = useContext(ScreenReadyContext);
  useEffect(() => {
    if (ready) reportReady();
  }, [ready, reportReady]);
}

// Sits inside the page Suspense boundary, so lazy screens cannot report early.
export function FirstScreenReady() {
  useFirstScreenReady(true);
  return null;
}

export function FirstScreenPreload({
  children,
  preload = preloadDialogs,
}: {
  children: ReactNode;
  preload?: () => void;
}) {
  const [ready, setReady] = useState(false);
  const reportReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    if (!ready) return;
    return scheduleIdlePreload(preload, {
      connection: (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
        .connection,
      requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
      cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
      requestIdleCallback: window.requestIdleCallback
        ? (callback, options) => window.requestIdleCallback(callback, options)
        : undefined,
      cancelIdleCallback: (id) => window.cancelIdleCallback?.(id),
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: (id) => window.clearTimeout(id),
    });
  }, [ready, preload]);
  return <ScreenReadyContext.Provider value={reportReady}>{children}</ScreenReadyContext.Provider>;
}
