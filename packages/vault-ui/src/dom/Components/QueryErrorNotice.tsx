import Box from "@mui/material/Box";
import { i18n } from "@paintwarden/i18n/runtime";
import type { SxProps, Theme } from "@mui/material/styles";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AppBanner } from "./AppBanner";

// Transport owns this state. Suppression does not clear errors or loaded content;
// an unresolved query becomes visible again when the connection recovers.
export const ConnectionLostContext = createContext(false);
// The shell already presents a nonconnection global failure on the page. Dialogs
// retain their own query feedback and must not call these failures disconnections.
export const PageErrorSuppressedContext = createContext(false);

type Notice = { message: string; retry?: () => unknown };
type Register = (id: string, notice: Notice) => () => void;
const ErrorSurfaceContext = createContext<Register | null>(null);

function retryAll(notices: Notice[]) {
  for (const notice of notices) {
    // A rejected refetch remains represented by its query error, not an unhandled promise.
    try {
      void Promise.resolve(notice.retry?.()).catch(() => undefined);
    } catch {
      // Synchronous adapters can fail too; leave their notice in place.
    }
  }
}

/** One query banner per page, dialog or drawer. Nested surfaces are independent. */
export function ErrorSurface({
  children,
  bannerSx,
  showConnection = false,
}: {
  children: ReactNode;
  bannerSx?: SxProps<Theme>;
  showConnection?: boolean;
}) {
  const [notices, setNotices] = useState<Map<string, Notice>>(() => new Map());
  const connectionLost = useContext(ConnectionLostContext);
  const pageErrorSuppressed = useContext(PageErrorSuppressedContext);
  const register = useCallback<Register>((id, notice) => {
    setNotices((old) => new Map(old).set(id, notice));
    return () => {
      setNotices((old) => {
        const next = new Map(old);
        next.delete(id);
        return next;
      });
    };
  }, []);
  const entries = [...notices.entries()];
  const values = entries.map(([, notice]) => notice);
  const message = [...new Set(values.map((notice) => notice.message))].join(" ");
  const episode = JSON.stringify(entries.map(([id, notice]) => [id, notice.message]));
  return (
    <ErrorSurfaceContext.Provider value={register}>
      {connectionLost && showConnection && (
        <Box sx={bannerSx} data-connection-banner>
          <AppBanner severity="info">{i18n.t("shell:connectionLostReconnecting")}</AppBanner>
        </Box>
      )}
      {!connectionLost && (showConnection || !pageErrorSuppressed) && values.length > 0 && (
        <Box sx={bannerSx} data-query-error-banner>
          <AppBanner
            key={episode}
            severity="error"
            onRetry={values.some((notice) => notice.retry) ? () => retryAll(values) : undefined}
          >
            {message}
          </AppBanner>
        </Box>
      )}
      {children}
    </ErrorSurfaceContext.Provider>
  );
}

/** Register a query failure with the nearest surface; standalone components still work. */
export function QueryErrorNotice({
  error,
  onRetry,
}: {
  error?: string | { message: string } | null;
  onRetry?: () => unknown;
}) {
  const register = useContext(ErrorSurfaceContext);
  const connectionLost = useContext(ConnectionLostContext);
  const pageErrorSuppressed = useContext(PageErrorSuppressedContext);
  const id = useId();
  const message = typeof error === "string" ? error : error?.message;
  const retry = useRef(onRetry);
  retry.current = onRetry;
  const hasRetry = Boolean(onRetry);
  useEffect(() => {
    if (!register || !message) return;
    return register(id, { message, retry: hasRetry ? () => retry.current?.() : undefined });
  }, [register, id, message, hasRetry]);
  if (register || connectionLost || pageErrorSuppressed || !message) return null;
  return (
    <AppBanner
      key={message}
      severity="error"
      onRetry={onRetry ? () => retryAll([{ message, retry: onRetry }]) : undefined}
    >
      {message}
    </AppBanner>
  );
}
