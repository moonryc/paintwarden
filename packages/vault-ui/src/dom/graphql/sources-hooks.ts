import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CatalogSource, SourceVersion } from "../Pages/Sources/sources.utils";

import { useVaultGraphQL } from "./provider";
import {
  readInstalledSources,
  readPluginRemoval,
  readPluginShareable,
  readPluginVersions,
} from "./sources-loader";

export function usePluginSources() {
  const scope = useVaultGraphQL();
  const serial = useRef(0);
  const [state, setState] = useState<{
    scope: typeof scope;
    sources: CatalogSource[];
    loading: boolean;
    error: string;
  }>({ scope, sources: [], loading: true, error: "" });
  const requireScope = useCallback(() => {
    if (!scope) throw new Error("The plugin connection is not available.");
    return scope;
  }, [scope]);
  const reload = useCallback(async () => {
    const request = ++serial.current;
    setState((previous) => ({ ...previous, loading: true, error: "" }));
    try {
      const view = await readInstalledSources(requireScope());
      if (serial.current !== request) return;
      // Optional GraphQL scalars use null; the legacy presentation types use undefined.
      const sources: CatalogSource[] = view.sources.map((source) => ({
        ...source,
        dependencies: source.dependencies.map((dependency) => ({
          repository: dependency.repository,
          minimumVersion: dependency.minimumVersion ?? undefined,
        })),
      }));
      setState({ scope, sources, loading: false, error: "" });
    } catch (cause) {
      if (serial.current !== request) return;
      const error = cause instanceof Error ? cause.message : "Could not load plugins";
      setState((previous) => ({ ...previous, scope, loading: false, error }));
    }
  }, [scope, requireScope]);
  useEffect(() => {
    void reload();
    const unsubscribe = scope?.controller.listen(["SOURCES"], () => void reload());
    return () => {
      serial.current += 1;
      unsubscribe?.();
    };
  }, [scope, reload]);
  const commands = useMemo(
    () => ({
      reload,
      versions: async (): Promise<SourceVersion[]> => {
        const view = await readPluginVersions(requireScope());
        return view.versions.map((version) => ({
          id: version.id,
          availableVersion: version.availableVersion ?? undefined,
          updateAvailable: version.updateAvailable ?? undefined,
          error: version.error ?? undefined,
        }));
      },
      removal: (id: string) => readPluginRemoval(requireScope(), id),
      shareable: () => readPluginShareable(requireScope()),
    }),
    [reload, requireScope],
  );
  return {
    sources: state.scope === scope ? state.sources : [],
    loading: state.scope !== scope || state.loading,
    error: state.scope === scope ? state.error : "",
    ...commands,
  };
}
