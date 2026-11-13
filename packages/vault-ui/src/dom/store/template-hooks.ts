import { useQuery } from "@tanstack/react-query";

import { templateCatalogOptions, templateRecipeOptions } from "../utils/template-query";

import { useVaultStore } from "./hooks";

export function useTemplateCatalog(enabled = true) {
  const authHeaders = useVaultStore((s) => s.authHeaders);
  return useQuery({ ...templateCatalogOptions(authHeaders), enabled });
}

export function useTemplateRecipe(id: string | null) {
  const authHeaders = useVaultStore((s) => s.authHeaders);
  return useQuery({ ...templateRecipeOptions(id ?? "", authHeaders), enabled: id !== null });
}
