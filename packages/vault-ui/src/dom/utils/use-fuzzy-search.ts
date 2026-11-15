import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";

import { createFuzzySearchTask } from "./fuzzy-search-task";

export function useFuzzySearch<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
  limit?: number,
): T[] {
  const deferredQuery = useDeferredValue(query);
  const [result, setResult] = useState<{ items: T[]; matches: T[] }>();
  const task = useRef<ReturnType<typeof createFuzzySearchTask<T>> | undefined>(undefined);
  useEffect(() => {
    const current = createFuzzySearchTask(
      items,
      getText,
      typeof Worker === "undefined"
        ? undefined
        : () => new Worker(new URL("./fuzzy-search.worker.ts", import.meta.url), { type: "module" }),
    );
    task.current = current;
    return () => {
      current.dispose();
    };
  }, [items, getText]);
  useEffect(() => {
    task.current?.search(deferredQuery, limit, (matches) =>
      startTransition(() => setResult({ items, matches })),
    );
  }, [items, getText, deferredQuery, limit]);
  // Empty search needs neither indexing nor ranking; retain immediate initial UI.
  if (!query.trim()) return limit === undefined ? items : items.slice(0, limit);
  return result
    ? result.matches.filter((item) => items.includes(item))
    : limit === undefined
      ? items
      : items.slice(0, limit);
}
