import {
  Alert,
  Button,
  Card,
  Drawer,
  IconButton,
  Snackbar,
  TextField,
  useScrollTrigger,
} from "@mui/material";
import Box from "@mui/material/Box";
import { ThemeProvider } from "@mui/material/styles";
import { isPaintAvailable } from "@paint-vault/core/paint-substitutions";
import { QueryClientProvider } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { lazy, Suspense, useMemo, useState } from "react";

import { AppErrorBoundary } from "./Components/AppErrorBoundary";
import { DeferredDialog } from "./Components/DeferredDialog";
import { LoadingWorkbench } from "./Components/LoadingWorkbench";
import { PasswordField } from "./Components/PasswordField";
import { UpdatePrompt } from "./Components/UpdatePrompt";
import { VaultLoadError } from "./Components/VaultLoadError";
import { MenuIcon } from "./icons";
import { NAV } from "./Layout/nav-items";
import { NavPanel } from "./Layout/NavPanel";
import { FALLBACK_OWNER_NAME } from "./Layout/UserAvatar";
import { Home } from "./Pages/Home";
import { useVaultStore } from "./store/hooks";
import { createVaultStore } from "./store/vault-store";
import { VaultStoreProvider } from "./store/VaultStoreProvider";
import { theme } from "./theme";
import { up } from "./theme-tokens";
import type { Paint, Tab } from "./types";
import { installBaseStyles } from "./utils/base-styles";
import { imageFormData } from "./utils/image";
import { truncateSx } from "./utils/truncate";
import { owns, resolvedPaintIds, wishlistPaintIds } from "./utils/vault-data";
import { createVaultQueryClient, useServerChecks, useVaultData } from "./utils/vault-query";

// Keep the workbench eager; other screens and overlays load only when opened.
const ColorSchemesDialog = lazy(() =>
  import("./Modals/ColorSchemesDialog").then((module) => ({ default: module.ColorSchemesDialog })),
);
const MiniatureForm = lazy(() =>
  import("./Modals/MiniatureForm").then((module) => ({ default: module.MiniatureForm })),
);
const PaintForm = lazy(() => import("./Modals/PaintForm").then((module) => ({ default: module.PaintForm })));
const ProjectDrawer = lazy(() =>
  import("./Modals/ProjectDrawer").then((module) => ({ default: module.ProjectDrawer })),
);
const PaintLibrary = lazy(() =>
  import("./Pages/PaintLibrary").then((module) => ({ default: module.PaintLibrary })),
);
const PaintToolsPage = lazy(() =>
  import("./Pages/PaintTools/PaintToolsPage").then((module) => ({ default: module.PaintToolsPage })),
);
const ColorSchemesPage = lazy(() =>
  import("./Pages/Schemes/ColorSchemesPage").then((module) => ({ default: module.ColorSchemesPage })),
);
const SettingsScreen = lazy(() =>
  import("./Pages/Settings/SettingsScreen").then((module) => ({ default: module.SettingsScreen })),
);
const PluginsModal = lazy(() =>
  import("./Pages/Sources/PluginsModal").then((module) => ({ default: module.PluginsModal })),
);
const MiniatureTemplatesPage = lazy(() =>
  import("./Pages/Templates/MiniatureTemplatesPage").then((module) => ({
    default: module.MiniatureTemplatesPage,
  })),
);
const WishlistPage = lazy(() =>
  import("./Pages/WishlistPage").then((module) => ({ default: module.WishlistPage })),
);

const LibraryDebugPanel =
  (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_GRAPHQL_LIBRARY_DEBUG === "true"
    ? lazy(() => import("./graphql/LibraryDebugPanel"))
    : null;

if (typeof document !== "undefined") installBaseStyles();

export default function Vault(props: { onChangeServer?: () => void } = {}) {
  const [queryClient] = useState(createVaultQueryClient);
  const [store] = useState(() => createVaultStore(queryClient));
  return (
    <QueryClientProvider client={queryClient}>
      <VaultStoreProvider store={store}>
        <ThemeProvider theme={theme}>
          <AppErrorBoundary>
            <VaultContent {...props} />
          </AppErrorBoundary>
        </ThemeProvider>
      </VaultStoreProvider>
    </QueryClientProvider>
  );
}

function VaultContent({ onChangeServer }: { onChangeServer?: () => void }) {
  const [authError, setError] = useState("");
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [setupCode, setSetupCode] = useState(""),
    [authBusy, setAuthBusy] = useState(false);
  const [showMiniForm, setShowMiniForm] = useState(false),
    [initialTemplateId, setInitialTemplateId] = useState<string | null>(null),
    [showPaintForm, setShowPaintForm] = useState(false),
    [showSchemeForm, setShowSchemeForm] = useState(false);
  const tab = useVaultStore((s) => s.tab);
  const go = useVaultStore((s) => s.go);
  const selectedId = useVaultStore((s) => s.selectedId);
  const pluginsOpen = useVaultStore((s) => s.pluginsOpen);
  const closePlugins = useVaultStore((s) => s.closePlugins);
  const openMini = useVaultStore((s) => s.openMini);
  const closeMini = useVaultStore((s) => s.closeMini);
  const setPaintFilter = useVaultStore((s) => s.setPaintFilter);
  const toasts = useVaultStore((s) => s.toasts);
  const dismissToast = useVaultStore((s) => s.dismissToast);
  const notify = useVaultStore((s) => s.notify);
  const api = useVaultStore((s) => s.api);
  const authHeaders = useVaultStore((s) => s.authHeaders);
  const setToken = useVaultStore((s) => s.setToken);
  const refresh = useVaultStore((s) => s.refresh);
  const syncChanges = useVaultStore((s) => s.syncChanges);
  // Large page titles hand off to the compact app bar once scrolled past.
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 48 });

  const checkServer = useVaultStore((s) => s.checkServer);
  const { auth, data, loading, loadError, loadFailed } = useVaultData(authHeaders, syncChanges);
  useServerChecks(checkServer);
  const displayName = auth?.username || FALLBACK_OWNER_NAME;
  const error = authError || loadError;

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    if (authBusy) return;
    setAuthBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${auth?.setupRequired ? "setup" : "login"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, ...(auth?.setupCodeRequired ? { setupCode } : {}) }),
      });
      const result = (await response.json()) as { token?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not sign in");
      setToken(result.token ?? "");
      setPassword("");
      setSetupCode("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in");
    } finally {
      setAuthBusy(false);
    }
  }

  const selected = data.miniatures.find((mini) => mini.id === selectedId) ?? null;
  const selectedRequirements = selected
    ? data.requirements.filter((r) => r.miniatureId === selected.id).sort((a, b) => a.sortOrder - b.sortOrder)
    : [];
  const required = selected
    ? (resolvedPaintIds(data, selected.id)
        .map((id) => data.catalog.find((p) => p.id === id))
        .filter(Boolean) as Paint[])
    : [];
  const missing = required.filter((p) => !owns(data.paintRecords[p.id]));
  const stats = useMemo(
    () => ({
      ownedMinis: data.miniatures.filter((m) => m.status === "OWNED").length,
      wishlistMinis: data.miniatures.filter((m) => m.status === "WISHLIST").length,
      ownedPaints: data.catalog.filter((paint) => isPaintAvailable(data, data.paintRecords, paint.id)).length,
      wantedPaints: Object.values(data.paintRecords).filter((r) => r.state === "WISHLIST").length,
    }),
    [data],
  );

  // Distinct paints still needed by any project — drives the Shop badge.
  const wishlistCount = useMemo(() => wishlistPaintIds(data).size, [data]);
  const counts: Partial<Record<Tab, number>> = {
    paints: stats.ownedPaints,
    wishlist: wishlistCount,
  };
  const toast = toasts.at(-1);
  const addMini = () => {
    setInitialTemplateId(null);
    setShowMiniForm(true);
  };
  const [navOpen, setNavOpen] = useState(false);
  const navProps = {
    tab,
    go,
    counts,
    displayName,
    onAddMiniature: addMini,
    onAddPaint: () => setShowPaintForm(true),
    onAddScheme: () => setShowSchemeForm(true),
    onAccount: () => go("settings"),
  };

  if (auth?.setupRequired || (auth?.requireSignIn && !auth.authenticated))
    return (
      <Box
        component="div"
        sx={{
          boxSizing: "border-box",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "var(--canvas)",
          p: 3,
        }}
      >
        <Card
          sx={{
            boxSizing: "border-box",
            width: "100%",
            maxWidth: "28rem",
            p: 3,
          }}
        >
          <Box
            component="form"
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
            onSubmit={(event) => void submitAuth(event)}
          >
            <Box
              component="h1"
              sx={{
                m: 0,
                fontFamily: "var(--font-serif)",
                letterSpacing: "-0.02em",
                fontOpticalSizing: "auto",
                fontSize: "1.5rem",
                lineHeight: 4 / 3,
                fontWeight: 600,
              }}
            >
              {auth.setupRequired ? "Set up Paint Vault" : "Sign in to Paint Vault"}
            </Box>
            <Box
              component="p"
              sx={{
                m: 0,
                fontSize: "0.875rem",
                lineHeight: 10 / 7,
                color: "var(--ink-soft)",
              }}
            >
              {auth.setupRequired
                ? "Create the owner account for this server. Existing vault data will be preserved."
                : `Sign in as ${auth.username}.`}
            </Box>
            {auth.setupCodeRequired && (
              <TextField
                required
                label="Setup code"
                autoComplete="off"
                slotProps={{ htmlInput: { autoCapitalize: "none", autoCorrect: "off", spellCheck: false } }}
                value={setupCode}
                onChange={(event) => setSetupCode(event.target.value)}
                helperText="Printed in the server log. With Docker, run: docker compose logs paint-vault"
              />
            )}
            <TextField
              required
              label="Username"
              autoComplete="username"
              slotProps={{ htmlInput: { autoCapitalize: "none", autoCorrect: "off", spellCheck: false } }}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <PasswordField
              required
              label="Password"
              autoComplete={auth.setupRequired ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              helperText={auth.setupRequired ? "Use at least 12 characters." : undefined}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" disabled={authBusy}>
              {auth.setupRequired ? "Create account" : "Sign in"}
            </Button>
            {onChangeServer && <Button onClick={onChangeServer}>Change server</Button>}
          </Box>
        </Card>
      </Box>
    );

  if (loadFailed)
    return (
      <VaultLoadError message={loadError} onRetry={() => void refresh()} onChangeServer={onChangeServer} />
    );

  return (
    <Box
      component="div"
      sx={{
        minHeight: "100vh",
        bgcolor: "var(--canvas)",
        color: "var(--ink)",
      }}
    >
      <Box
        component="div"
        sx={{
          display: "flex",
          minHeight: "100vh",
        }}
      >
        <Box
          component="aside"
          // The panel scrolls when the window is shorter than it, so its bottom section stays reachable.
          sx={[
            {
              boxSizing: "border-box",
              position: "fixed",
              insetBlock: 0,
              left: 0,
              zIndex: 40,
              display: "none",
              width: "264px",
              borderRightStyle: "solid",
              borderRightWidth: "1px",
              borderColor: "var(--line)",
              bgcolor: "var(--surface)",
              [up.lg]: {
                display: "flex",
              },
            },
            { overflowY: "auto", overscrollBehavior: "contain" },
          ]}
        >
          <NavPanel {...navProps} />
        </Box>
        {/* Phones and tablets: the same panel in a full-width drawer behind the hamburger. */}
        <Drawer
          open={navOpen}
          onClose={() => setNavOpen(false)}
          anchor="left"
          sx={{
            boxSizing: "border-box",
            [up.lg]: {
              display: "none",
            },
          }}
          slotProps={{
            paper: {
              sx: {
                boxSizing: "border-box",
                width: "100%",
                bgcolor: "var(--surface)",
              },
              "aria-label": "Navigation",
            },
          }}
        >
          <NavPanel {...navProps} onClose={() => setNavOpen(false)} />
        </Drawer>
        <Box
          component="main"
          sx={{
            minWidth: 0,
            flex: "1",
            [up.lg]: {
              ml: 33,
            },
          }}
        >
          {LibraryDebugPanel && !loading && auth && (
            <Suspense fallback={null}>
              <LibraryDebugPanel />
            </Suspense>
          )}
          {/* Same bar at every size: the page title docks here once the large title scrolls away. */}
          <Box
            component="header"
            sx={[
              {
                boxSizing: "border-box",
                position: "sticky",
                top: 0,
                zIndex: 20,
                borderBottomStyle: "solid",
                borderBottomWidth: "1px",
                bgcolor: "color-mix(in oklab, var(--canvas) 85%, transparent)",
                paddingTop: "env(safe-area-inset-top)",
                WebkitBackdropFilter: "blur(24px)",
                backdropFilter: "blur(24px)",
                transition: "border-color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
              },
              scrolled
                ? {
                    borderColor: "var(--line)",
                  }
                : {
                    borderColor: "transparent",
                  },
            ]}
          >
            <Box
              component="div"
              sx={{
                boxSizing: "border-box",
                marginInline: "auto",
                display: "flex",
                height: "3.5rem",
                maxWidth: "1280px",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                px: 2,
                [up.md]: {
                  px: 4,
                },
                [up.lg]: {
                  height: "4rem",
                  px: 5,
                },
              }}
            >
              <Box
                component="div"
                sx={{
                  display: "flex",
                  minWidth: 0,
                  alignItems: "center",
                  gap: 1.25,
                }}
              >
                <IconButton
                  onClick={() => setNavOpen(true)}
                  aria-label="Open navigation"
                  aria-expanded={navOpen}
                  sx={{
                    boxSizing: "border-box",
                    marginLeft: "-0.5rem",
                    color: "var(--ink) !important",
                    [up.lg]: {
                      display: "none !important",
                    },
                  }}
                >
                  <MenuIcon size={22} />
                </IconButton>
                <Box
                  component="h1"
                  sx={[
                    {
                      m: 0,
                      ...truncateSx,
                      fontFamily: "var(--font-serif)",
                      letterSpacing: "-0.02em",
                      fontOpticalSizing: "auto",
                      fontSize: "1.125rem",
                      lineHeight: 14 / 9,
                      fontWeight: 600,
                      transitionProperty: "all",
                      transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
                      transitionDuration: "200ms",
                    },
                    scrolled
                      ? {
                          translate: "0 0",
                          opacity: 1,
                        }
                      : {
                          translate: "0 0.25rem",
                          opacity: 0,
                        },
                  ]}
                >
                  {tab === "settings" ? "Data & settings" : NAV.find(([key]) => key === tab)![2]}
                </Box>
              </Box>
            </Box>
          </Box>
          <Box
            component="div"
            sx={{
              boxSizing: "border-box",
              marginInline: "auto",
              maxWidth: "1280px",
              px: 2,
              pt: 0.5,
              paddingBottom: "calc(6.5rem + env(safe-area-inset-bottom))",
              [up.md]: {
                px: 4,
              },
              [up.lg]: {
                px: 5,
                pt: 1,
                pb: 8,
              },
            }}
          >
            {loadError && (
              <Alert
                severity="error"
                sx={{
                  boxSizing: "border-box",
                  marginBottom: "1.5rem",
                }}
                action={
                  <Button color="inherit" size="small" onClick={() => void refresh()}>
                    Retry
                  </Button>
                }
              >
                Could not refresh your vault. Showing the last loaded data.
              </Alert>
            )}
            {loading ? (
              <LoadingWorkbench />
            ) : (
              <Box
                component="div"
                key={tab}
                sx={{
                  animation: "rise 0.25s ease",
                  "@keyframes rise": {
                    from: {
                      opacity: 0,
                      transform: "translateY(6px)",
                    },
                    to: {
                      opacity: 1,
                      transform: "none",
                    },
                  },
                  "@media (prefers-reduced-motion: reduce)": {
                    animation: "none",
                  },
                }}
              >
                <Suspense fallback={<LoadingWorkbench />}>
                  {tab === "dashboard" || tab === "miniatures" ? (
                    <Home view={tab} onAdd={addMini} />
                  ) : tab === "templates" ? (
                    <MiniatureTemplatesPage
                      onUse={(id) => {
                        setInitialTemplateId(id);
                        setShowMiniForm(true);
                      }}
                    />
                  ) : tab === "paint-tools" ? (
                    <PaintToolsPage />
                  ) : tab === "schemes" ? (
                    <ColorSchemesPage />
                  ) : tab === "wishlist" ? (
                    <WishlistPage
                      onBrowsePaints={() => {
                        setPaintFilter("ALL");
                        go("paints");
                      }}
                    />
                  ) : tab === "settings" ? (
                    <SettingsScreen auth={auth} connected={!loadError} onChangeServer={onChangeServer} />
                  ) : (
                    <PaintLibrary onAddPaint={() => setShowPaintForm(true)} />
                  )}
                </Suspense>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
      {showMiniForm && (
        <DeferredDialog title="Add miniature" onClose={() => setShowMiniForm(false)}>
          <MiniatureForm
            initialTemplateId={initialTemplateId}
            onClose={() => setShowMiniForm(false)}
            onSubmit={async ({ image, removeImage: _removeImage, ...payload }) => {
              const result = (await api("/api/miniatures", {
                method: "POST",
                body: JSON.stringify(payload),
              })) as { id?: string };
              if (image && result.id)
                await api(`/api/miniatures/${result.id}/image`, {
                  method: "POST",
                  body: await imageFormData(image),
                });
              setShowMiniForm(false);
              notify(`Added ${payload.title}`);
              if (result.id) openMini(result.id);
            }}
          />
        </DeferredDialog>
      )}
      {showPaintForm && (
        <DeferredDialog title="Add paint" onClose={() => setShowPaintForm(false)}>
          <PaintForm
            onClose={() => setShowPaintForm(false)}
            onSave={async (paint) => {
              await api("/api/catalog", { method: "POST", body: JSON.stringify({ paints: [paint] }) });
              setShowPaintForm(false);
              notify(`Added ${paint.name}`);
            }}
          />
        </DeferredDialog>
      )}
      {pluginsOpen && (
        <DeferredDialog title="Plugins" onClose={closePlugins}>
          <PluginsModal onClose={closePlugins} />
        </DeferredDialog>
      )}
      {showSchemeForm && (
        <DeferredDialog title="Add scheme" onClose={() => setShowSchemeForm(false)}>
          <ColorSchemesDialog initialId={null} onClose={() => setShowSchemeForm(false)} />
        </DeferredDialog>
      )}
      {selected && (
        <DeferredDialog key={selected.id} title={selected.title} onClose={closeMini}>
          <ProjectDrawer
            key={selected.id}
            miniature={selected}
            required={required}
            requirementRows={selectedRequirements}
            missing={missing}
            onClose={closeMini}
          />
        </DeferredDialog>
      )}
      <UpdatePrompt />
      <Snackbar
        key={toast?.id}
        open={!!toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{
          boxSizing: "border-box",
          bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
          [up.lg]: {
            bottom: "1.5rem",
          },
        }}
      >
        {toast && (
          <Alert
            severity={toast.tone === "error" ? "error" : "success"}
            variant="filled"
            sx={{
              boxSizing: "border-box",
              width: "100%",
              alignItems: "center",
              borderRadius: "1rem",
              boxShadow: "var(--shadow-lg)",
            }}
            action={
              toast.action ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    toast.action!.onClick();
                    dismissToast(toast.id);
                  }}
                  sx={{
                    boxSizing: "border-box",
                    fontWeight: "700",
                  }}
                >
                  {toast.action.label}
                </Button>
              ) : undefined
            }
          >
            {toast.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
}
