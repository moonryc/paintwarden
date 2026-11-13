import { createFuzzyIndex, searchFuzzyIndex, FUZZY_LIMITS } from "@paint-vault/core/fuzzy-search";

type SearchReply = { request: number; indices: number[] };
type SearchWorker = {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<SearchReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

// Testable input scheduler. All indexing/search runs in a worker or in a later
// task on platforms without Worker (SSR/test/older embeds), never in React render.
export function createFuzzySearchTask<T>(
  items: T[],
  getText: (item: T) => string,
  createWorker?: () => SearchWorker,
) {
  let worker: SearchWorker | undefined;
  let index: ReturnType<typeof createFuzzyIndex<T>> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest = 0;
  let disposed = false;
  let initialized = false;
  let pending: { query: string; limit?: number; done: (items: T[]) => void } | undefined;
  const fallback = () => {
    if (disposed || !pending) return;
    if (!pending.query.trim()) {
      pending.done(pending.limit === undefined ? items : items.slice(0, pending.limit));
      return;
    }
    index ??= createFuzzyIndex(items, getText);
    pending.done(searchFuzzyIndex(index, pending.query, pending.limit));
  };
  // Do not eagerly spawn one worker per unopened autocomplete (recipe rows can
  // have many). First nonempty search lazily initializes it in a later task.
  const initialize = () => {
    if (initialized) return;
    initialized = true;
    if (!createWorker) return;
    try {
      worker = createWorker();
      worker.onmessage = ({ data }) => {
        if (!disposed && data.request === latest) pending?.done(data.indices.map((i) => items[i]));
      };
      worker.onerror = () => {
        worker?.terminate();
        worker = undefined;
        clearTimeout(timer);
        timer = setTimeout(fallback, 0);
      };
      worker.postMessage({ texts: items.map((item) => getText(item).slice(0, FUZZY_LIMITS.text)) });
    } catch {
      worker?.terminate();
      worker = undefined;
    }
  };
  return {
    search(query: string, limit: number | undefined, done: (items: T[]) => void) {
      query = query.slice(0, FUZZY_LIMITS.query);
      pending = { query, limit, done };
      latest++;
      const request = latest;
      clearTimeout(timer);
      timer = setTimeout(
        () => {
          if (disposed) return;
          if (!query.trim()) {
            fallback();
            return;
          }
          initialize();
          if (worker) {
            try {
              worker.postMessage({ request, query, limit });
            } catch {
              worker.terminate();
              worker = undefined;
              fallback();
            }
          } else fallback();
        },
        query ? 80 : 0,
      );
    },
    dispose() {
      disposed = true;
      latest++;
      clearTimeout(timer);
      worker?.terminate();
    },
  };
}
