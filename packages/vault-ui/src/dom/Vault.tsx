import { Alert, Button, Card, IconButton, TextField } from "@mui/material";
import Box from "@mui/material/Box";
import { i18n, translateServerError } from "@paintwarden/i18n/runtime";
import { lazy, Suspense, useState, type ComponentProps, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { AppBanner } from "./Components/AppBanner";
import { AppErrorBoundary } from "./Components/AppErrorBoundary";
import { ContentSnackbar } from "./Components/ContentSnackbar";
import { DeferredDialog } from "./Components/DeferredDialog";
import { PageSkeleton } from "./Components/PageSkeletons";
import { PasswordField } from "./Components/PasswordField";
import { UpdatePrompt } from "./Components/UpdatePrompt";
import { VaultLoadError } from "./Components/VaultLoadError";
import { dialogs } from "./dialog-preload";
import { NavigationCountsProvider, useNavigationCounts } from "./graphql/navigation";
import { usePaintCommands } from "./graphql/paint-actions";
import { PluginInstallStatus } from "./graphql/plugin-install-hooks";
import { VaultGraphQLProvider, VaultGraphQLStatus } from "./graphql/provider";
import { LanguageProvider } from "./i18n";
import { X } from "./icons";
import { AppContent } from "./Layout/AppContent";
import { NAV } from "./Layout/nav-items";
import { NavPanel } from "./Layout/NavPanel";
import { FALLBACK_OWNER_NAME } from "./Layout/UserAvatar";
import { VaultLayout } from "./Layout/VaultLayout";
import { CreateMiniatureDialog } from "./Modals/CreateMiniatureDialog";
import { Home } from "./Pages/Home";
import { useVaultStore } from "./store/hooks";
import { createVaultStore } from "./store/vault-store";
import { VaultStoreProvider } from "./store/VaultStoreProvider";
import { useAuthStatus, useServerChecks } from "./utils/auth-hooks";
import { installBaseStyles } from "./utils/base-styles";
import { FirstScreenPreload, FirstScreenReady } from "./utils/FirstScreenPreload";
import { PublicError, publicErrorMessage } from "./utils/public-error";

// Keep the workbench eager; screens stay lazy and dialogs share idle/intent preloads.
const PaintForm = dialogs.paint.Component;
const ProjectDrawer = dialogs.project.Component;
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
const PluginsModal = dialogs.plugins.Component;
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
  const [store] = useState(() => createVaultStore());
  return (
    <VaultStoreProvider store={store}>
      <LanguageProvider>
        <AppErrorBoundary>
          <FirstScreenPreload>
            <VaultContent {...props} />
            <UpdatePrompt />
          </FirstScreenPreload>
        </AppErrorBoundary>
      </LanguageProvider>
    </VaultStoreProvider>
  );
}

function VaultContent({ onChangeServer }: { onChangeServer?: () => void }) {
  const { t: pagesT } = useTranslation("pages");
  const [authError, setError] = useState("");
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [setupCode, setSetupCode] = useState(""),
    [authBusy, setAuthBusy] = useState(false);
  const [showMiniForm, setShowMiniForm] = useState(false),
    [initialTemplateId, setInitialTemplateId] = useState<string | null>(null),
    [showPaintForm, setShowPaintForm] = useState(false);
  const tab = useVaultStore((s) => s.tab);
  const go = useVaultStore((s) => s.go);
  const selectedId = useVaultStore((s) => s.selectedId);
  const pluginsOpen = useVaultStore((s) => s.pluginsOpen);
  const closePlugins = useVaultStore((s) => s.closePlugins);
  const closeMini = useVaultStore((s) => s.closeMini);
  const setPaintFilter = useVaultStore((s) => s.setPaintFilter);
  const toasts = useVaultStore((s) => s.toasts);
  const dismissToast = useVaultStore((s) => s.dismissToast);
  const setToken = useVaultStore((s) => s.setToken);
  const refresh = useVaultStore((s) => s.refresh);

  const checkServer = useVaultStore((s) => s.checkServer);
  const { auth, loading, loadError, loadFailed } = useAuthStatus();
  useServerChecks(checkServer);
  const displayName = auth?.username || pagesT(FALLBACK_OWNER_NAME);
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
      if (!response.ok) throw new PublicError(translateServerError(result));
      setToken(result.token ?? "");
      setPassword("");
      setSetupCode("");
      await refresh();
    } catch (cause) {
      setError(publicErrorMessage(cause, i18n.t("shell:couldNotSignIn")));
    } finally {
      setAuthBusy(false);
    }
  }

  const toast = toasts.at(-1);

  const navProps = {
    tab,
    go,
    displayName,
    onAccount: () => go("settings"),
  };

  if (auth?.setupRequired || (auth?.requireSignIn && !auth.authenticated))
    return (
      <Box
        component="main"
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
              {auth.setupRequired ? i18n.t("shell:setUpPaintwarden") : i18n.t("shell:signInToPaintwarden")}
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
                ? i18n.t("shell:createTheOwnerAccountForThisServerExistingVault")
                : i18n.t("shell:signInAs", { value1: auth.username })}
            </Box>
            {auth.setupCodeRequired && (
              <TextField
                required
                label={i18n.t("shell:setupCode")}
                autoComplete="off"
                slotProps={{ htmlInput: { autoCapitalize: "none", autoCorrect: "off", spellCheck: false } }}
                value={setupCode}
                onChange={(event) => setSetupCode(event.target.value)}
                helperText={i18n.t("shell:printedInTheServerLogWithDockerRunDocker")}
              />
            )}
            <TextField
              required
              label={i18n.t("shell:username")}
              autoComplete="username"
              slotProps={{ htmlInput: { autoCapitalize: "none", autoCorrect: "off", spellCheck: false } }}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <PasswordField
              required
              label={i18n.t("shell:password")}
              autoComplete={auth.setupRequired ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              helperText={auth.setupRequired ? i18n.t("shell:useAtLeastCharacters") : undefined}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" disabled={authBusy}>
              {auth.setupRequired ? i18n.t("shell:createAccount") : i18n.t("shell:signIn")}
            </Button>
            {onChangeServer && <Button onClick={onChangeServer}>{i18n.t("shell:changeServer")}</Button>}
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
          <VaultLayout
            navigation={(onClose) => <VaultNavPanel {...navProps} onClose={onClose} />}
            title={
              tab === "settings" ? i18n.t("shell:dataSettings") : pagesT(NAV.find(([key]) => key === tab)![2])
            }
            status={
              !pluginsOpen && (
                <AppContent compact>
                  <PluginInstallStatus compact />
                </AppContent>
              )
            }
          >
            <VaultGraphQLStatus />
            {loadError && (
              <AppBanner severity="error" onRetry={() => void refresh()}>
                {i18n.t("shell:couldNotRefreshYourVaultShowingTheLastLoaded")}
              </AppBanner>
            )}
            {loading ? (
              <PageSkeleton page={tab === "dashboard" ? "home" : tab} />
            ) : (
              <Box
                component="div"
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
                <Suspense fallback={<PageSkeleton page={tab === "dashboard" ? "home" : tab} />}>
                  {tab === "dashboard" || tab === "miniatures" ? (
                    <Home view={tab} />
                  ) : tab === "templates" ? (
                    <MiniatureTemplatesPage
                      onUse={(id) => {
                        setInitialTemplateId(id);
                        setShowMiniForm(true);
                      }}
                    />
                  ) : tab === "paint-tools" ? (
                    <>
                      <PaintToolsPage />
                      <FirstScreenReady />
                    </>
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
                    <>
                      <SettingsScreen auth={auth} connected={!loadError} onChangeServer={onChangeServer} />
                      <FirstScreenReady />
                    </>
                  ) : (
                    <PaintLibrary onAddPaint={() => setShowPaintForm(true)} />
                  )}
                </Suspense>
              </Box>
            )}
          </VaultLayout>
          {showMiniForm && (
            <CreateMiniatureDialog
              initialFolderId={null}
              initialTemplateId={initialTemplateId}
              onClose={() => setShowMiniForm(false)}
            />
          )}
          {showPaintForm && <CreatePaintDialog onClose={() => setShowPaintForm(false)} />}
          {pluginsOpen && (
            <DeferredDialog kind="plugins" title={i18n.t("shell:plugins")} onClose={closePlugins}>
              <PluginsModal onClose={closePlugins} />
            </DeferredDialog>
          )}
          {selectedId && (
            <DeferredDialog
              key={selectedId}
              kind="project"
              title={i18n.t("shell:miniature")}
              onClose={closeMini}
            >
              <ProjectDrawer miniatureId={selectedId} onClose={closeMini} />
            </DeferredDialog>
          )}
          <ContentSnackbar key={toast?.id} open={!!toast}>
            {toast && (
              <Alert
                onClose={() => dismissToast(toast.id)}
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
                    <>
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
                      <IconButton
                        color="inherit"
                        size="small"
                        aria-label={i18n.t("common:close")}
                        onClick={() => dismissToast(toast.id)}
                      >
                        <X size={18} />
                      </IconButton>
                    </>
                  ) : undefined
                }
              >
                {toast.message}
              </Alert>
            )}
          </ContentSnackbar>
        </Box>
      </NavigationCountsProvider>
    </VaultGraphQLProvider>
  );
}

function VaultNavPanel(props: Omit<ComponentProps<typeof NavPanel>, "counts">) {
  const counts = useNavigationCounts();
  return <NavPanel {...props} counts={counts} />;
}

function CreatePaintDialog({ onClose }: { onClose(): void }) {
  const commands = usePaintCommands();
  const notify = useVaultStore((store) => store.notify);
  return (
    <DeferredDialog kind="paint" title={i18n.t("shell:addPaint")} onClose={onClose}>
      <PaintForm
        onClose={onClose}
        onSave={async (paint) => {
          await commands.importPaints([paint]);
          onClose();
          notify(i18n.t("shell:added", { value1: paint.name }));
        }}
      />
    </DeferredDialog>
  );
}
