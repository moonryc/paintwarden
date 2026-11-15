import { randomUUID } from "node:crypto";

import { publicError } from "./public-errors";

import type { InstallContext, InstallStage } from "./catalog-install-context";

export type PluginInstallStage = Uppercase<InstallStage> | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type PluginInstallJob = {
  id: string;
  stage: PluginInstallStage;
  done: number;
  total: number;
  percent: number;
  cancellable: boolean;
  error: string | null;
  errorCode: string | null;
  errorParameters: { name: string; value: string }[];
};

// One latest snapshot, not persistent bookkeeping. Reloads reattach to the server's live job.
// A restart cannot resume an install: the startup staging sweep discards its uncommitted files.
let latest: PluginInstallJob | null = null;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();
const weights: Record<InstallStage, [number, number]> = {
  reading: [0, 5],
  checking: [5, 5],
  images: [10, 75],
  preparing: [85, 10],
  committing: [95, 5],
};
const emit = () => listeners.forEach((listener) => listener());
export const currentPluginInstallJob = () => latest && { ...latest };
export const pluginInstallRunning = () => controller !== null;
export class PluginInstallBusyError extends Error {
  constructor() {
    super("A plugin install is already running");
  }
}
export function startPluginInstall(operation: (context: InstallContext) => Promise<unknown>) {
  if (controller) throw new PluginInstallBusyError();
  const abort = new AbortController();
  controller = abort;
  const id = randomUUID();
  latest = {
    id,
    stage: "READING",
    done: 0,
    total: 0,
    percent: 0,
    cancellable: true,
    error: null,
    errorCode: null,
    errorParameters: [],
  };
  const initial = { ...latest };
  emit();
  const progress: NonNullable<InstallContext["progress"]> = (stage, done, total) => {
    abort.signal.throwIfAborted();
    const [base, weight] = weights[stage];
    latest = {
      id,
      stage: stage.toUpperCase() as Uppercase<InstallStage>,
      done,
      total,
      percent: Math.max(latest?.percent ?? 0, Math.min(99, base + (total ? done / total : 0) * weight)),
      cancellable: stage !== "committing",
      error: null,
      errorCode: null,
      errorParameters: [],
    };
    emit();
  };
  // Capture the operation independently of the initiating HTTP connection. Navigating away or
  // reloading only closes that subscription, not the server-side job.
  void Promise.resolve()
    .then(() => operation({ signal: abort.signal, progress }))
    .then(
      () => {
        latest = {
          id,
          stage: "SUCCEEDED",
          done: 1,
          total: 1,
          percent: 100,
          cancellable: false,
          error: null,
          errorCode: null,
          errorParameters: [],
        };
      },
      (error: unknown) => {
        const failure = pluginInstallFailure(error);
        latest = {
          id,
          stage: abort.signal.aborted ? "CANCELLED" : "FAILED",
          done: latest?.done ?? 0,
          total: latest?.total ?? 0,
          percent: latest?.percent ?? 0,
          cancellable: false,
          error: abort.signal.aborted ? null : failure.error,
          errorCode: abort.signal.aborted ? null : failure.errorCode,
          errorParameters: abort.signal.aborted
            ? []
            : Object.entries(failure.errorParameters).map(([name, value]) => ({ name, value })),
        };
      },
    )
    .finally(() => {
      controller = null;
      emit();
    });
  return initial;
}

export function cancelPluginInstall(id: string) {
  if (!latest || latest.id !== id) return null;
  if (controller && latest.cancellable) {
    // Do not announce CANCELLED until cleanup has actually finished.
    latest = { ...latest, cancellable: false };
    controller.abort(new Error("Plugin install cancelled"));
    emit();
  }
  return currentPluginInstallJob();
}

// Event-driven, coalescing bounded snapshots. The heartbeat also lets the GraphQL adapter
// revalidate access while idle. There is never an unbounded queue per subscriber.
export function watchPluginInstall(signal: AbortSignal, heartbeatMs = 1000) {
  let closed = signal.aborted;
  let seen: PluginInstallJob | null | undefined;
  let resume: (() => void) | undefined;
  const changed = () => resume?.();
  const close = () => {
    closed = true;
    changed();
    listeners.delete(changed);
    signal.removeEventListener("abort", close);
  };
  listeners.add(changed);
  signal.addEventListener("abort", close, { once: true });
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next(): Promise<IteratorResult<PluginInstallJob | null>> {
      if (!closed && seen === latest) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(done, heartbeatMs);
          function done() {
            clearTimeout(timer);
            resume = undefined;
            resolve();
          }
          resume = done;
          if (closed || seen !== latest) done();
        });
      }
      if (closed) return { done: true, value: undefined };
      seen = latest;
      return { done: false, value: currentPluginInstallJob() };
    },
    async return(): Promise<IteratorResult<PluginInstallJob | null>> {
      close();
      return { done: true, value: undefined };
    },
  };
}

export function pluginInstallFailure(error: unknown) {
  const message =
    error && typeof error === "object" && "code" in error && error.code === "ENOSPC"
      ? "There is not enough disk space to install this plugin"
      : error instanceof Error
        ? error.message
        : "Plugin install failed";
  const translated = publicError(message);
  return {
    error: translated.errorCode === "REQUEST_FAILED" ? "Plugin install failed" : message,
    ...translated,
  };
}
