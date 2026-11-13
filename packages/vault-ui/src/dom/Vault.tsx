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
import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useState, type ComponentProps, type FormEvent } from "react";

import { AppErrorBoundary } from "./Components/AppErrorBoundary";
import { DeferredDialog } from "./Components/DeferredDialog";
import { LoadingWorkbench } from "./Components/LoadingWorkbench";
import { PasswordField } from "./Components/PasswordField";
import { UpdatePrompt } from "./Components/UpdatePrompt";
import { VaultLoadError } from "./Components/VaultLoadError";
import { useMiniatureActions } from "./graphql/miniature-actions";
import { NavigationCountsProvider, useNavigationCounts } from "./graphql/navigation";
import { VaultGraphQLProvider } from "./graphql/provider";
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
import { installBaseStyles } from "./utils/base-styles";
import { needsLegacySnapshot } from "./utils/legacy-screen";
import { truncateSx } from "./utils/truncate";
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
  import("./Modals/ApolloProjectDrawer").then((module) => ({ default: module.ApolloProjectDrawer })),
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
  const legacyRequired = needsLegacySnapshot(tab, { plugins: pluginsOpen, schemeForm: showSchemeForm });
  const { auth, loading, loadError, loadFailed } = useVaultData(authHeaders, syncChanges, legacyRequired);
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

  const toast = toasts.at(-1);
  const addMini = () => {
    setInitialTemplateId(null);
    setShowMiniForm(true);
  };
  const [navOpen, setNavOpen] = useState(false);
  const navProps = {
    tab,
    go,
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
    <VaultGraphQLProvider>
      <NavigationCountsProvider enabled={Boolean(auth)}>
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
              <VaultNavPanel {...navProps} />
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
              <VaultNavPanel {...navProps} onClose={() => setNavOpen(false)} />
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
            <CreateMiniatureDialog
              initialTemplateId={initialTemplateId}
              onClose={() => setShowMiniForm(false)}
            />
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
          {selectedId && (
            <DeferredDialog key={selectedId} title="Miniature" onClose={closeMini}>
              <ProjectDrawer miniatureId={selectedId} onClose={closeMini} />
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
      </NavigationCountsProvider>
    </VaultGraphQLProvider>
  );
}

function VaultNavPanel(props: Omit<ComponentProps<typeof NavPanel>, "counts">) {
  const counts = useNavigationCounts();
  return <NavPanel {...props} counts={counts} />;
}

function CreateMiniatureDialog({
  initialTemplateId,
  onClose,
}: {
  initialTemplateId: string | null;
  onClose(): void;
}) {
  const actions = useMiniatureActions();
  const openMini = useVaultStore((store) => store.openMini);
  const notify = useVaultStore((store) => store.notify);
  return (
    <DeferredDialog title="Add miniature" onClose={onClose}>
      <MiniatureForm
        initialTemplateId={initialTemplateId}
        onClose={onClose}
        onSubmit={async (values) => {
          const id = await actions.create(values);
          onClose();
          notify(`Added ${values.title}`);
          openMini(id);
        }}
      />
    </DeferredDialog>
  );
}
