import { useLayoutEffect } from "react";

// Opt-in production instrumentation. The packaged perf harness enables it with
// performance.mark("paintwarden:profile-drawer"). No React profiling build needed.
// Measures boundary render-start → layout commit (not inclusive React CPU time).
export function useDrawerRenderTiming(boundary: "shell" | "content", enabled = true) {
  const start =
    enabled && performance.getEntriesByName("paintwarden:profile-drawer").length ? performance.now() : null;
  useLayoutEffect(() => {
    if (start !== null)
      performance.measure(`paintwarden:drawer:${boundary}:commit`, { start, end: performance.now() });
  });
}
