type Connection = { saveData?: boolean; effectiveType?: string };
export type IdlePreloadHost = {
  connection?: Connection;
  requestAnimationFrame(callback: () => void): number;
  cancelAnimationFrame(id: number): void;
  requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(id: number): void;
};

// Call only after the initial page has committed its content. Two frames let the
// browser paint it before scheduling background work (including the timer path).
export function scheduleIdlePreload(preload: () => void, host: IdlePreloadHost) {
  if (host.connection?.saveData || /^(slow-2g|2g|3g)$/.test(host.connection?.effectiveType ?? ""))
    return () => undefined;
  let cancelled = false;
  let frame: number;
  let idle: number | undefined;
  let timer: number | undefined;
  const run = () => {
    if (!cancelled) preload();
  };
  frame = host.requestAnimationFrame(() => {
    frame = host.requestAnimationFrame(() => {
      if (host.requestIdleCallback) idle = host.requestIdleCallback(run, { timeout: 2000 });
      else timer = host.setTimeout(run, 1000);
    });
  });
  return () => {
    cancelled = true;
    host.cancelAnimationFrame(frame);
    if (idle !== undefined) host.cancelIdleCallback?.(idle);
    if (timer !== undefined) host.clearTimeout(timer);
  };
}
