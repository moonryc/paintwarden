const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { createReadStream, createWriteStream, existsSync, mkdirSync } = require("node:fs");
const { readFile, rename, rm, stat, writeFile } = require("node:fs/promises");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { app, BrowserWindow, dialog, ipcMain, protocol, shell, Menu } = require("electron");
const {
  assetPath,
  publicErrorResult,
  shellCacheControl,
  imageRequest,
  imageProxyCacheControl,
  createImageCache,
  subscriptionRequest,
  createSubscriptionStreams,
  parsedChoice,
  serverOrigin,
  versionMismatch,
} = require("./desktop-core.cjs");
const { createServerLog, createStartupProgress, waitForServer } = require("./desktop-startup.cjs");
const { createUpdater } = require("./desktop-update.cjs");
const { t, setLanguage, getLanguage, resolveLanguage } = require("./desktop-i18n.cjs");
const { createPreferences } = require("./desktop-preferences.cjs");
const { menuTemplate } = require("./desktop-menu.cjs");

const appOrigin = "paintvault://app";
const testPort = !app.isPackaged && Number(process.env.PAINT_VAULT_DESKTOP_PORT);
// Packaged builds use the bundle icon from build/; unpackaged runs would otherwise show Electron's default.
const devIcon = app.isPackaged ? undefined : path.join(__dirname, "build", "icon.png");
const explicitPort = Number.isInteger(testPort) && testPort > 0 && testPort <= 65535 ? testPort : null;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

protocol.registerSchemesAsPrivileged([
  { scheme: "paintvault", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let mainWindow;
const dataOverride = process.env.PAINT_VAULT_DESKTOP_DATA_DIR;
if (dataOverride && !path.isAbsolute(dataOverride))
  throw new Error("PAINT_VAULT_DESKTOP_DATA_DIR must be an absolute path");
const dataDirectory = dataOverride
  ? path.normalize(dataOverride)
  : process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA || app.getPath("appData"), "PaintVault")
    : path.join(os.homedir(), "Library", "Application Support", "PaintVault");
mkdirSync(path.join(dataDirectory, "electron"), { recursive: true });
app.setPath("userData", path.join(dataDirectory, "electron"));
// Isolated desktop profiles must not write logs into the person's normal profile.
if (dataOverride) app.setAppLogsPath(path.join(dataDirectory, "electron", "logs"));
let localUrl;
let serverProcess;
let readyServer;
let startingServer;
let startupState = { phase: "idle" };
let serverProgress;
let stopWhenSafe = false;
let quitWhenSafe = false;
let serverLog;
function startupChanged(state) {
  startupState = state;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("startup:state", state);
}
function finishDeferredStop() {
  if (serverProgress?.protected()) return;
  if (quitWhenSafe) app.quit();
  else if (stopWhenSafe) stopLocalServer();
}
let connection = { mode: null };
let updater;
const cookies = new Map();
const imageCache = createImageCache();
const subscriptionStreams = createSubscriptionStreams();
// An opaque, process-local generation never contains server names or credentials. A new
// connection or session gets different image URLs, even when both vaults use the same IDs.
let imageScope = randomBytes(24).toString("hex");
let authorizationIdentity;
function rotateImageScope() {
  imageCache.clear();
  imageScope = randomBytes(24).toString("hex");
}

function freeLoopbackPort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const port = listener.address().port;
      listener.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function serverDirectory() {
  return app.isPackaged ? path.join(process.resourcesPath, "server") : path.join(__dirname, "desktop-server");
}

function webDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "web-dist")
    : path.resolve(__dirname, "../paint-vault-web/dist");
}

function connectionPath() {
  return path.join(dataDirectory, "client-connection.json");
}

let preferences;
async function readConnection() {
  const saved = await preferences.read();
  setLanguage(saved.language);
  return parsedChoice(saved);
}
async function writeConnection(choice) {
  await preferences.setConnection(choice);
}
function updateMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      menuTemplate({
        platform: process.platform,
        appName: "Paint Vault",
        t,
        openWebsite: () => shell.openExternal("https://github.com/moonryc/paint-tracker"),
      }),
    ),
  );
}

async function serverHealthy() {
  try {
    const response = await fetch(`${localUrl}/api/auth/status`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok && typeof (await response.json()).setupRequired === "boolean";
  } catch {
    return false;
  }
}

async function launchLocalServer() {
  if (serverProgress?.state().phase === "failed") stopLocalServer();
  // Retrying a slow start joins the same child: never replace a server that may be
  // inside VACUUM or a migration. This also makes retries after the cap safe.
  if (serverProcess?.exitCode === null && !serverProcess.killed) {
    startupChanged({ phase: serverProgress?.state().phase || "starting" });
    await waitForServer({ child: serverProcess, healthy: serverHealthy, progress: serverProgress });
    readyServer = serverProcess;
    startupChanged({ phase: "ready" });
    return;
  }
  startupChanged({ phase: "starting" });
  if (await serverHealthy()) {
    if (explicitPort) throw new Error(t("errors.portUsed", { port: explicitPort }));
    localUrl = `http://127.0.0.1:${await freeLoopbackPort()}`;
  }
  const directory = serverDirectory();
  const executable = path.join(directory, process.platform === "win32" ? "node.exe" : "node");
  if (!existsSync(executable) || !existsSync(path.join(directory, "server.mjs")))
    throw new Error(t("errors.missingServer"));
  serverLog ??= createServerLog(app.getPath("logs"));
  serverLog.write(`\n[${new Date().toISOString()}] Starting bundled server\n`);
  serverProgress = createStartupProgress((state) => {
    if (serverProcess !== child) return;
    // Keep Retry disabled until the shared attempt has rejected and can be retried.
    // A failed marker/exit can precede the next health-loop tick by 250ms.
    if (state.phase !== "failed" || !startingServer) startupChanged(state);
    // Do not stop synchronously on a completed backup marker: the next line may
    // start a migration. Defer until all output from this turn has been parsed.
    if (["ready", "failed"].includes(state.phase)) setImmediate(finishDeferredStop);
  });
  const child = spawn(executable, ["server.mjs"], {
    cwd: directory,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: new URL(localUrl).port,
      DATA_DIR: dataDirectory,
      PAINT_VAULT_DESKTOP: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  serverProcess = child;
  const progress = serverProgress;
  child.stdout.on("data", (chunk) => {
    try {
      serverLog.write(chunk);
    } catch (error) {
      console.error("Server log write failed:", error);
    }
    progress.accept(chunk);
  });
  child.stderr.on("data", (chunk) => {
    try {
      serverLog.write(chunk);
    } catch (error) {
      console.error("Server log write failed:", error);
    }
  });
  child.on("exit", (code, signal) => {
    try {
      serverLog.write(`\n[${new Date().toISOString()}] Server exited: ${code ?? signal}\n`);
    } catch (error) {
      console.error("Server log write failed:", error);
    }
    if (serverProcess === child) {
      readyServer = undefined;
      serverProcess = undefined;
      if (!startingServer) startupChanged({ phase: "failed" });
      if (quitWhenSafe) app.quit();
    }
  });
  child.on("error", (error) => {
    child.spawnError = error;
    try {
      serverLog.write(`\nServer spawn failed: ${error.stack || error}\n`);
    } catch (logError) {
      console.error("Server log write failed:", logError);
    }
    console.error("Paint Vault server failed to start:", error);
    // Failed spawns emit error/close, not necessarily exit. They have no live
    // database operation to protect, and Retry must be allowed to spawn again.
    if (serverProcess === child) {
      readyServer = undefined;
      serverProcess = undefined;
      if (!startingServer) startupChanged({ phase: "failed" });
      if (quitWhenSafe) app.quit();
    }
  });
  await waitForServer({ child, healthy: serverHealthy, progress });
  if (serverProcess === child) readyServer = child;
  startupChanged({ phase: "ready" });
}

function ensureLocalServer() {
  if (
    serverProcess &&
    readyServer === serverProcess &&
    serverProcess.exitCode === null &&
    !serverProcess.killed
  )
    return Promise.resolve();
  if (!startingServer) {
    startingServer = launchLocalServer()
      .catch((error) => {
        console.error("Bundled server startup:", error);
        startupChanged({ phase: "failed" });
        // Never kill on a timeout, including the overall cap. Logs and Retry
        // remain available while the child completes its protected operation.
        throw new Error(`${t("errors.startServer")} ${t("startup.failure")}`);
      })
      .finally(() => {
        startingServer = undefined;
      });
  }
  return startingServer;
}

function localStartupInProgress() {
  if (!serverProcess || serverProcess.exitCode !== null) return false;
  // Protect the pre-marker interval too: the child can write its marker and enter
  // SQLite before this process has drained stdout. A quit must not race that pipe.
  return (
    serverProgress?.protected() ||
    (readyServer !== serverProcess && !["ready", "failed"].includes(serverProgress?.state().phase))
  );
}

function stopLocalServer() {
  if (localStartupInProgress()) {
    stopWhenSafe = true;
    return;
  }
  stopWhenSafe = false;
  readyServer = undefined;
  const child = serverProcess;
  serverProcess = undefined;
  if (child && child.exitCode === null) child.kill();
  startupChanged({ phase: "idle" });
}

let changingConnection = 0;
function updaterConnection() {
  return connection.mode === "remote"
    ? { ...connection, serverVersion: versionChecks.get(connection.serverUrl)?.version ?? null }
    : connection;
}

async function setConnection(input) {
  if (updater?.isInstalling()) return connection;
  // Fail closed while a connection choice is being validated or persisted.
  changingConnection++;
  updater?.setConnection({ mode: null });
  try {
    return await chooseConnection(input);
  } finally {
    changingConnection--;
    if (!changingConnection) updater?.setConnection(updaterConnection());
  }
}

async function chooseConnection(input) {
  if (!input || typeof input !== "object") throw new Error(t("errors.connectionMode"));
  let next;
  if (input.mode === "local") {
    stopWhenSafe = false;
    await ensureLocalServer();
    next = { mode: "local" };
  } else if (input.mode === "remote") {
    const origin = serverOrigin(input.serverUrl);
    const response = await fetch(`${origin}/api/auth/status`, {
      signal: AbortSignal.timeout(6000),
      redirect: "manual",
    });
    if (!response.ok || typeof (await response.json()).setupRequired !== "boolean")
      throw new Error(t("errors.notServer"));
    const problem = await remoteVersionProblem(origin, { fresh: true });
    if (problem) throw new Error(problem.message);
    next = { mode: "remote", serverUrl: origin };
  } else throw new Error(t("errors.connectionMode"));
  await writeConnection(next);
  connection = next;
  subscriptionStreams.abortAll();
  authorizationIdentity = undefined;
  rotateImageScope();
  if (next.mode === "remote") stopLocalServer();
  return next;
}

// Remote servers must run exactly this app's version. A server that predates the version endpoint
// answers 404 and counts as older. Throws when the server can't be reached.
async function serverVersion(origin) {
  const response = await fetch(`${origin}/api/version`, {
    signal: AbortSignal.timeout(6000),
    redirect: "manual",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(t("errors.serverVersion"));
  const body = await response.json().catch(() => null);
  return body?.name === "paint-vault" && typeof body.version === "string" ? body.version : null;
}

// Results are reused for a few minutes, so a server updated while the app is open is noticed
// without a version request before every API call.
const VERSION_RECHECK_MS = 5 * 60_000;
const versionChecks = new Map();
const pendingVersionChecks = new Map();
async function remoteVersionProblem(origin, { fresh = false } = {}) {
  // Explicit refresh bypasses completed results, but still joins a check already underway.
  const pending = pendingVersionChecks.get(origin);
  if (pending) return pending;
  const cached = versionChecks.get(origin);
  if (!fresh && cached && Date.now() - cached.checkedAt < VERSION_RECHECK_MS) return cached.problem;
  const check = serverVersion(origin)
    .then((version) => {
      const problem = versionMismatch(app.getVersion(), version);
      versionChecks.set(origin, { checkedAt: Date.now(), problem, version });
      if (!changingConnection && connection.mode === "remote" && connection.serverUrl === origin)
        updater?.setConnection(updaterConnection());
      return problem;
    })
    .finally(() => pendingVersionChecks.delete(origin));
  pendingVersionChecks.set(origin, check);
  return check;
}

function rememberSession(origin, response) {
  for (const header of response.headers.getSetCookie?.() ?? []) {
    const match = /^pv_session=([^;]*)/.exec(header);
    if (!match) continue;
    const previous = cookies.get(origin);
    if (match[1]) cookies.set(origin, `pv_session=${match[1]}`);
    else cookies.delete(origin);
    if (previous !== cookies.get(origin)) rotateImageScope();
  }
}

// Posts a file with node:http because fetch reads a streamed body far ahead of the connection,
// which would hold a large backup in memory.
async function uploadFile(target, headers, file) {
  const { size } = await stat(file);
  const transport = target.startsWith("https:") ? https : http;
  return new Promise((resolve, reject) => {
    const upload = transport.request(
      target,
      { method: "POST", headers: { ...Object.fromEntries(headers), "content-length": size } },
      (reply) => {
        const chunks = [];
        reply.on("data", (chunk) => chunks.push(chunk));
        reply.on("error", reject);
        reply.on("end", () => resolve(new Response(Buffer.concat(chunks), { status: reply.statusCode })));
      },
    );
    pipeline(createReadStream(file), upload).catch(reject);
  });
}

async function proxyApi(request, requestUrl) {
  if (connection.mode === null)
    return Response.json(
      { error: t("errors.chooseServer") },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  const selected = connection;
  let subscription,
    streaming = false;
  try {
    if (selected.mode === "local") await ensureLocalServer();
    const origin = selected.mode === "local" ? localUrl : selected.serverUrl;
    if (selected.mode === "remote") {
      const problem = await remoteVersionProblem(origin);
      if (problem)
        return Response.json(
          { error: problem.message, versionProblem: problem },
          { status: 409, headers: { "cache-control": "no-store" } },
        );
    }
    if (selected !== connection)
      return new Response(t("errors.connectionChanged"), {
        status: 409,
        headers: { "cache-control": "no-store" },
      });
    const isImage = imageRequest(request.method, requestUrl.pathname);
    const headers = new Headers(request.headers);
    if (!isImage) {
      const identity = headers.get("authorization");
      if (authorizationIdentity !== identity) {
        authorizationIdentity = identity;
        rotateImageScope();
      }
    }
    const scope = imageScope;
    const scoped = requestUrl.searchParams.get("_pv_scope") === scope;
    if (isImage && requestUrl.searchParams.has("_pv_scope") && !scoped)
      return new Response(t("errors.imageSessionChanged"), {
        status: 409,
        headers: { "cache-control": "no-store" },
      });
    // This is a local cache key, never a server API parameter or a persisted image URL.
    const upstreamUrl = new URL(requestUrl);
    upstreamUrl.searchParams.delete("_pv_scope");
    const target = `${origin}${upstreamUrl.pathname}${upstreamUrl.search}`;
    for (const name of [
      "origin",
      "referer",
      "host",
      "cookie",
      "content-length",
      "connection",
      "accept-encoding",
    ])
      headers.delete(name);
    const cookie = cookies.get(origin);
    if (cookie) headers.set("cookie", cookie);
    const cacheKey = `${scope}:${upstreamUrl.pathname}${upstreamUrl.search}`;
    if (isImage && scoped) {
      const cached = imageCache.get(cacheKey);
      if (cached) return cached;
    }
    const hasBody = !["GET", "HEAD"].includes(request.method);
    // A backup can take far longer than the usual limit and is too large to hold in memory.
    const backup = requestUrl.pathname === "/api/backup";
    if (subscriptionRequest(request.method, requestUrl.pathname))
      subscription = subscriptionStreams.open(request.signal);
    const response = request.uploadFile
      ? await uploadFile(target, headers, request.uploadFile)
      : await fetch(target, {
          method: request.method,
          headers,
          body: hasBody ? await request.arrayBuffer() : undefined,
          redirect: "manual",
          signal: subscription ? subscription.signal : backup ? undefined : AbortSignal.timeout(30_000),
        });
    // A response started on a different connection must not populate the new vault or
    // replace its session. Abandon its body instead of leaving a download running.
    if (selected !== connection) {
      await response.body?.cancel();
      return new Response(t("errors.connectionChanged"), {
        status: 409,
        headers: { "cache-control": "no-store" },
      });
    }
    rememberSession(origin, response);
    if (response.status >= 300 && response.status < 400)
      return Response.json(
        { error: t("errors.redirect") },
        { status: 502, headers: { "cache-control": "no-store" } },
      );
    const responseHeaders = new Headers(response.headers);
    for (const name of ["set-cookie", "content-length", "content-encoding", "access-control-allow-origin"])
      responseHeaders.delete(name);
    responseHeaders.set("x-paint-vault-image-scope", imageScope);
    responseHeaders.set(
      "cache-control",
      imageProxyCacheControl(request.method, requestUrl.pathname, response, scoped && scope === imageScope),
    );
    const body = subscription ? subscription.wrap(response.body) : response.body;
    const reply = new Response(body, { status: response.status, headers: responseHeaders });
    streaming = Boolean(subscription);
    if (isImage && scoped && scope === imageScope) await imageCache.put(cacheKey, reply);
    return reply;
  } catch (error) {
    if (subscription && selected !== connection)
      return new Response(t("errors.connectionChanged"), {
        status: 409,
        headers: { "cache-control": "no-store" },
      });
    return Response.json(
      { error: error instanceof Error ? error.message : t("errors.unavailable") },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  } finally {
    if (!streaming) subscription?.abort();
  }
}

async function serveStatic(url) {
  const directory = webDirectory();
  const file = assetPath(directory, url.pathname);
  if (!file) return new Response(t("errors.forbidden"), { status: 403 });
  let content;
  try {
    if (!(await stat(file)).isFile()) return new Response(t("errors.notFound"), { status: 404 });
    content = await readFile(file);
  } catch {
    return new Response(t("errors.notFound"), { status: 404 });
  }
  return new Response(content, {
    headers: {
      "content-type": mimeTypes[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "content-security-policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'",
      "cache-control": shellCacheControl(url.pathname),
    },
  });
}

function allowRenderer(event) {
  if (event.senderFrame !== event.sender.mainFrame || !event.senderFrame.url.startsWith(`${appOrigin}/`))
    throw new Error(t("errors.outsideApp"));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: "Paint Vault",
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 500,
    ...(devIcon ? { icon: devIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(`${appOrigin}/`)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
  });
  await mainWindow.loadURL(`${appOrigin}/`);
}

app
  .whenReady()
  .then(async () => {
    if (devIcon) app.dock?.setIcon(devIcon);
    localUrl = `http://127.0.0.1:${explicitPort ?? (await freeLoopbackPort())}`;
    preferences = createPreferences(connectionPath(), resolveLanguage(app.getLocale()));
    connection = await readConnection();
    updateMenu();
    ipcMain.handle("language:get", (event) => {
      allowRenderer(event);
      return getLanguage();
    });
    ipcMain.handle("language:set", async (event, language) => {
      allowRenderer(event);
      if (!require("./desktop-i18n.cjs").supportedLanguages.includes(language))
        throw new Error(t("errors.invalidLanguage"));
      await preferences.setLanguage(language);
      setLanguage(language);
      versionChecks.clear();
      updateMenu();
      return getLanguage();
    });

    protocol.handle("paintvault", async (request) => {
      const url = new URL(request.url);
      if (url.protocol !== "paintvault:" || url.hostname !== "app")
        return new Response(t("errors.forbidden"), { status: 403 });
      if (url.pathname.startsWith("/api/")) return proxyApi(request, url);
      return serveStatic(url);
    });

    ipcMain.handle("startup:get", (event) => {
      allowRenderer(event);
      return startupState;
    });
    ipcMain.handle("startup:logs", (event) => {
      allowRenderer(event);
      return shell.openPath(app.getPath("logs"));
    });
    ipcMain.handle("connection:get", async (event) => {
      allowRenderer(event);
      if (connection.mode === "local") await ensureLocalServer();
      if (connection.mode !== "remote") return connection;
      // An unreachable server isn't a version problem; the vault reports it when it loads.
      const versionProblem = await remoteVersionProblem(connection.serverUrl, { fresh: true }).catch(
        () => null,
      );
      return versionProblem ? { ...connection, versionProblem } : connection;
    });
    ipcMain.handle("connection:set", async (event, choice) => {
      allowRenderer(event);
      return setConnection(choice);
    });
    ipcMain.handle("file:save-binary", async (event, input) => {
      allowRenderer(event);
      if (
        !input ||
        typeof input.filename !== "string" ||
        input.filename.length > 200 ||
        path.basename(input.filename) !== input.filename ||
        !input.filename.endsWith(".zip") ||
        !input.bytes ||
        input.bytes.byteLength > 2_000_000_000 ||
        (input.title !== undefined && (typeof input.title !== "string" || input.title.length > 100))
      )
        throw new Error(t("errors.invalidExport"));
      const result = await dialog.showSaveDialog(mainWindow, {
        title: input.title || t("dialogs.exportFile"),
        buttonLabel: t("dialogs.save"),
        defaultPath: input.filename,
        filters: [{ name: t("dialogs.zip"), extensions: ["zip"] }],
      });
      if (result.canceled || !result.filePath) return false;
      await writeFile(result.filePath, Buffer.from(input.bytes));
      return true;
    });

    // A backup goes straight from the server to the chosen file, whatever its size.
    ipcMain.handle("file:save-backup", async (event, input) => {
      allowRenderer(event);
      if (
        !input ||
        typeof input.filename !== "string" ||
        input.filename.length > 200 ||
        path.basename(input.filename) !== input.filename ||
        !input.filename.endsWith(".zip") ||
        (input.authorization !== undefined &&
          (typeof input.authorization !== "string" || input.authorization.length > 200))
      )
        throw new Error(t("errors.invalidExport"));
      const result = await dialog.showSaveDialog(mainWindow, {
        title: t("dialogs.exportBackup"),
        buttonLabel: t("dialogs.save"),
        defaultPath: input.filename,
        filters: [{ name: t("dialogs.zip"), extensions: ["zip"] }],
      });
      if (result.canceled || !result.filePath) return false;
      const url = new URL(`${appOrigin}/api/backup`);
      const headers = input.authorization ? { authorization: input.authorization } : {};
      const response = await proxyApi({ method: "GET", headers }, url);
      if (!response.ok || !response.body) throw new Error(t("errors.exportFailed"));
      // Written beside the target first, so a failed export never replaces an earlier backup.
      const partial = `${result.filePath}.part`;
      try {
        await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
        await rename(partial, result.filePath);
      } catch (error) {
        await rm(partial, { force: true });
        throw error;
      }
      return true;
    });

    // Restores stream from the chosen file here, because passing a large file body through the
    // custom protocol handler crashes the main process. Problems are returned for the UI to show.
    ipcMain.handle("file:restore-backup", async (event, input) => {
      allowRenderer(event);
      if (
        !input ||
        typeof input.path !== "string" ||
        !path.isAbsolute(input.path) ||
        !["replace", "merge"].includes(input.mode) ||
        (input.authorization !== undefined &&
          (typeof input.authorization !== "string" || input.authorization.length > 200))
      )
        throw new Error(t("errors.invalidRestore"));
      const url = new URL(`${appOrigin}/api/backup?mode=${input.mode}`);
      const response = await proxyApi(
        {
          method: "POST",
          headers: input.authorization ? { authorization: input.authorization } : {},
          uploadFile: input.path,
        },
        url,
      );
      if (response.ok) return {};
      const body = await response.json().catch(() => null);
      return publicErrorResult(body, t("errors.restoreFailed"));
    });

    // Packaged builds update themselves; smoke tests set PAINT_VAULT_DISABLE_UPDATES=1.
    updater = createUpdater({
      autoUpdater: require("electron-updater").autoUpdater,
      currentVersion: app.getVersion(),
      connection: updaterConnection(),
      enabled: app.isPackaged && process.env.PAINT_VAULT_DISABLE_UPDATES !== "1",
      onChange: (state) => mainWindow?.webContents.send("update:state", state),
      log: (error) => console.error("Update failed:", error),
    });
    ipcMain.handle("update:get", (event) => {
      allowRenderer(event);
      return updater.state();
    });
    ipcMain.handle("update:check", (event) => {
      allowRenderer(event);
      return updater.check();
    });
    ipcMain.handle("update:install", (event) => {
      allowRenderer(event);
      return updater.install();
    });
    ipcMain.handle("update:respond", (event, input) => {
      allowRenderer(event);
      return updater.respond(input);
    });

    if (connection.mode === "local") void ensureLocalServer().catch((error) => console.error(error));
    await createWindow();
    updater.start();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  })
  .catch((error) => {
    console.error(error);
    app.quit();
  });

app.on("before-quit", (event) => {
  if (localStartupInProgress()) {
    event.preventDefault();
    quitWhenSafe = true;
    startupChanged({ phase: serverProgress.state().phase });
    return;
  }
  if (updater?.installOnQuit()) {
    event.preventDefault();
    return;
  }
  subscriptionStreams.abortAll();
  stopLocalServer();
});
app.on("window-all-closed", () => app.quit());
