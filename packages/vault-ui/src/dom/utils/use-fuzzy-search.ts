import { useEffect, useRef, useState } from "react";

import { createFuzzySearchTask } from "./fuzzy-search-task";

export function useFuzzySearch<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
  limit?: number,
): T[] {
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
    task.current?.search(query, limit, (matches) => setResult({ items, matches }));
  }, [items, getText, query, limit]);
  // Empty search needs neither indexing nor ranking; retain immediate initial UI.
  if (!query.trim()) return limit === undefined ? items : items.slice(0, limit);
  return result?.items === items ? result.matches : [];
}
