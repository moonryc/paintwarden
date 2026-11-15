import { Box } from "@mui/material";
import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { visuallyHiddenSx } from "../utils/visually-hidden";

const LoadingContext = createContext<(id: string, busy: boolean) => void>(() => undefined);

/** One announcement per surface, however many independent sections are pending. */
export function PageLoadingStatus({ children, loading = false }: { children: ReactNode; loading?: boolean }) {
  const { t } = useTranslation("components");
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const report = useCallback((id: string, busy: boolean) => {
    setPending((previous) => {
      if (previous.has(id) === busy) return previous;
      const next = new Set(previous);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  return (
    <LoadingContext.Provider value={report}>
      {(loading || pending.size > 0) && (
        <Box role="status" aria-live="polite" aria-atomic="true" sx={visuallyHiddenSx}>
          {t("loading")}
        </Box>
      )}
      {children}
    </LoadingContext.Provider>
  );
}

export function usePageLoading(busy: boolean) {
  const id = useId();
  const report = useContext(LoadingContext);
  useEffect(() => {
    report(id, busy);
    return () => report(id, false);
  }, [id, busy, report]);
}
