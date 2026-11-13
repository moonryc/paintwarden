// Cache namespaces are transport-only: never put them in vault state, recipe edits or backups.
// The desktop proxy supplies a fresh opaque scope for each server/account generation. Web
// URLs remain unchanged and unscoped desktop requests deliberately remain no-store.
let scope = "";

export function rememberImageScope(response: Response) {
  scope = response.headers.get("x-paint-vault-image-scope") ?? "";
}

export function imageUrl(source: string): string {
  if (typeof location === "undefined" || location.protocol !== "paintvault:" || !scope) return source;
  if (
    !/^\/api\/(?:miniatures\/[^/]+\/image|miniature-templates\/[^/]+\/image|catalog-source-(?:images|logos)\/[^/?]+)(?:\?|$)/.test(
      source,
    )
  )
    return source;
  const url = new URL(source, location.href);
  url.searchParams.set("_pv_scope", scope);
  return `${url.pathname}${url.search}${url.hash}`;
}
