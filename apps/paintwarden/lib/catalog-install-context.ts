export type InstallStage = "reading" | "checking" | "images" | "preparing" | "committing";

export type InstallContext = {
  signal?: AbortSignal;
  progress?: (stage: InstallStage, done: number, total: number) => void;
};

export function checkInstallCancelled(context: InstallContext) {
  context.signal?.throwIfAborted();
}

export function installProgress(context: InstallContext, stage: InstallStage, done: number, total: number) {
  checkInstallCancelled(context);
  context.progress?.(stage, done, total);
  checkInstallCancelled(context);
}
