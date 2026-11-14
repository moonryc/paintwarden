import { Suspense, useEffect, useState, type ReactNode } from "react";

import { DialogSkeleton, type SkeletonDialog } from "./DialogSkeletons";

function DelayedDialogSkeleton({
  kind,
  title,
  onClose,
}: {
  kind: SkeletonDialog;
  title: string;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(timer);
  }, []);
  // There is no modal to catch Escape during the brief, invisible delay.
  useEffect(() => {
    if (visible) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [visible, onClose]);
  return visible ? (
    <>
      <span hidden data-dialog-code-loading={kind} />
      <DialogSkeleton kind={kind} title={title} onClose={onClose} />
    </>
  ) : null;
}

// Rejected imports propagate to the app's existing recovery/error boundary.
// Each pending mount owns its delay, so fast/preloaded imports never flash a shell.
export function DeferredDialog({
  kind,
  title,
  onClose,
  children,
}: {
  kind: SkeletonDialog;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<DelayedDialogSkeleton kind={kind} title={title} onClose={onClose} />}>
      {children}
    </Suspense>
  );
}
