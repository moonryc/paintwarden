import { AsyncLocalStorage } from "node:async_hooks";

// A restore spans asynchronous file writes and a synchronous DB transaction. Image mutations
// must own the same lock for their entire read/write/commit/cleanup lifetime, not just each
// filesystem call. Nested helpers (including parallel asset downloads) share the outer owner.
const owner = new AsyncLocalStorage<{ active: boolean }>();
let pending: Promise<void> = Promise.resolve();

export async function withImageMutation<T>(operation: () => Promise<T>): Promise<T> {
  if (owner.getStore()?.active) return operation();
  const previous = pending;
  let release!: () => void;
  pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const context = { active: true };
  try {
    return await owner.run(context, operation);
  } finally {
    context.active = false;
    release();
  }
}

export function serializeImageMutation<Args extends unknown[], Result>(
  operation: (...args: Args) => Promise<Result>,
) {
  return (...args: Args) => withImageMutation(() => operation(...args));
}
