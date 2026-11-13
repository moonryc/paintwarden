// Authentication is intentionally REST. Server row data belongs exclusively to Apollo.
import { useEffect } from "react";

import { useVaultStore } from "../store/hooks";

import { rememberImageScope } from "./image-cache";

export async function readJson<T>(response: Response, message: string) {
  rememberImageScope(response);
  if (!response.ok) throw new Error(message);
  return (await response.json()) as T;
}

export function useAuthStatus() {
  const auth = useVaultStore((store) => store.auth);
  const loading = useVaultStore((store) => store.authLoading);
  const loadError = useVaultStore((store) => store.authError);
  const generation = useVaultStore((store) => store.authGeneration);
  const checkServer = useVaultStore((store) => store.checkServer);
  useEffect(() => {
    void checkServer();
  }, [checkServer, generation]);
  return { auth, loading, loadError, loadFailed: Boolean(loadError && !auth) };
}

// Focus/online/polling also run while signed out. The mounted Apollo provider owns
// revision reconciliation; this check only establishes access to that scope.
export function useServerChecks(checkServer: () => Promise<void>) {
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") void checkServer();
    };
    const timer = setInterval(check, 30_000);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [checkServer]);
}
