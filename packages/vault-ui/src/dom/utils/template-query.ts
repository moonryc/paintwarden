import { queryOptions } from "@tanstack/react-query";

import type { AuthHeaders, MiniatureTemplateCatalog, MiniatureTemplateRecipe } from "../types";

// Both template consumers use the mounted vault's QueryClient. Server switching remounts that
// client; refresh and account changes invalidate these keys alongside the vault snapshot.
export const TEMPLATES_QUERY = ["miniature-templates"] as const;

async function readTemplateJson<T>(response: Response) {
  if (!response.ok) throw new Error("Could not load miniature templates");
  return (await response.json()) as T;
}

export function templateCatalogOptions(authHeaders: AuthHeaders) {
  return queryOptions({
    queryKey: [...TEMPLATES_QUERY, "catalog"],
    staleTime: Infinity,
    gcTime: Infinity,
    structuralSharing: false,
    queryFn: async ({ signal }) =>
      readTemplateJson<MiniatureTemplateCatalog>(
        await fetch("/api/miniature-templates", { headers: authHeaders(), cache: "no-store", signal }),
      ),
  });
}

export function templateRecipeOptions(id: string, authHeaders: AuthHeaders) {
  return queryOptions({
    queryKey: [...TEMPLATES_QUERY, "recipe", id],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async ({ signal }) =>
      readTemplateJson<MiniatureTemplateRecipe>(
        await fetch(`/api/miniature-templates/${encodeURIComponent(id)}/recipe`, {
          headers: authHeaders(),
          cache: "no-store",
          signal,
        }),
      ),
  });
}
