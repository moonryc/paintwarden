import type { ComponentProps } from "react";

import type { ApolloProjectDrawer } from "./Modals/ApolloProjectDrawer";
import type { ColorSchemesDialog } from "./Modals/ColorSchemesDialog";
import type { MiniatureForm } from "./Modals/MiniatureForm";
import type { PaintForm } from "./Modals/PaintForm";
import type { PluginsModal } from "./Pages/Sources/PluginsModal";
import { createPreloadable, preloadOnIntent } from "./utils/preloadable";

export const dialogs = {
  paint: createPreloadable<ComponentProps<typeof PaintForm>>(() =>
    import("./Modals/PaintForm").then((m) => ({ default: m.PaintForm })),
  ),
  miniature: createPreloadable<ComponentProps<typeof MiniatureForm>>(() =>
    import("./Modals/MiniatureForm").then((m) => ({ default: m.MiniatureForm })),
  ),
  schemes: createPreloadable<ComponentProps<typeof ColorSchemesDialog>>(() =>
    import("./Modals/ColorSchemesDialog").then((m) => ({ default: m.ColorSchemesDialog })),
  ),
  plugins: createPreloadable<ComponentProps<typeof PluginsModal>>(() =>
    import("./Pages/Sources/PluginsModal").then((m) => ({ default: m.PluginsModal })),
  ),
  project: createPreloadable<ComponentProps<typeof ApolloProjectDrawer>>(() =>
    import("./Modals/ApolloProjectDrawer").then((m) => ({ default: m.ApolloProjectDrawer })),
  ),
};
export type DialogKind = keyof typeof dialogs;

export function preloadDialog(kind: DialogKind) {
  // Speculative failures stay silent; opening still reaches the error boundary.
  void dialogs[kind].preload().catch(() => undefined);
}

export function dialogPreloadHandlers(kind: DialogKind) {
  return preloadOnIntent(dialogs[kind].preload);
}

export function preloadDialogs() {
  for (const kind of Object.keys(dialogs) as DialogKind[]) preloadDialog(kind);
}
