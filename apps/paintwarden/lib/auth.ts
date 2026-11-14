import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

import { getSqlite } from "../db/index.ts";

import { PasswordCheckBusyError, hashPassword, needsRehash, verifyPassword } from "./password-hash.ts";
import { isPublicAddress } from "./public-fetch.ts";

type Account = {
  username: string;
  password_hash: string;
  require_sign_in: number;
  credential_generation: number;
};
type PasswordOperations = {
  hashPassword: typeof hashPassword;
  verifyPassword: typeof verifyPassword;
};
const lifetime = 30 * 24 * 60 * 60 * 1000;

// The server sets this header itself on every request, replacing anything the client sent.
export const CLIENT_ADDRESS_HEADER = "x-paintwarden-client";

// Whether the owner has said a reverse proxy sits in front of the server, so its forwarded
// headers can be believed.
export const trustProxy = () => process.env.PAINTWARDEN_TRUST_PROXY === "1";

const desktopServer = () => process.env.PAINTWARDEN_DESKTOP === "1";
const allowedHostsSetting = () =>
  (process.env.PAINTWARDEN_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

// A web page can point its own domain at this server's address (DNS rebinding), and the browser
// then treats the page as the server's own origin. Rebinding needs a domain name, so addresses
// and localhost names are always safe; other names must be listed in PAINTWARDEN_ALLOWED_HOSTS.
// The desktop app's own server is reached only as 127.0.0.1.
export function hostAllowed(hostname: string, desktop = desktopServer(), allowed = allowedHostsSetting()) {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (desktop) return host === "127.0.0.1" || host === "localhost";
  return Boolean(isIP(host)) || host === "localhost" || host.endsWith(".localhost") || allowed.includes(host);
}

// Rebinding matters only when the browser needs no credentials: sign-in is off, or a server with
// no setup code has no owner yet. With sign-in on, the session cookie belongs to the real name.
function rebindingRisk() {
  if (desktopServer()) return true;
  const owner = account();
  return owner ? !owner.require_sign_in : !setupCodeNeeded();
}

export function hostRefused(request: Request) {
  const { hostname } = new URL(request.url);
  if (hostAllowed(hostname) || !rebindingRisk()) return null;
  return error(
    `Open this server by its IP address, or add ${hostname} to PAINTWARDEN_ALLOWED_HOSTS. Other names are refused while sign-in is off`,
    403,
  );
}

// The peer is the client unless the owner says a reverse proxy sits in front of the server
// (PAINTWARDEN_TRUST_PROXY=1). Then a peer on a private address is that proxy, and the last
// forwarded entry is the one it added, so a client can't forge it. Without the setting, a device
// on the same network could send a new forwarded address with every guess.
export function clientAddress(
  peer: string | undefined,
  forwardedFor: string | undefined,
  trusted = trustProxy(),
) {
  const address = peer ?? "unknown";
  if (!trusted || isPublicAddress(address)) return addressNetwork(address);
  return addressNetwork(forwardedFor?.split(",").at(-1)?.trim() || address);
}

// One IPv6 connection is usually given a whole /64, so all of it counts as a single client.
function addressNetwork(address: string) {
  if (isIP(address) !== 6 || /^::ffff:/i.test(address)) return address;
  const [head, tail] = address
    .split("%")[0]
    .split("::")
    .map((part) => part.split(":").filter(Boolean));
  const groups = [
    ...head,
    ...Array<string>(8 - head.length - (tail?.length ?? 0)).fill("0"),
    ...(tail ?? []),
  ];
  return `${groups
    .slice(0, 4)
    .map((group) => parseInt(group, 16).toString(16))
    .join(":")}::/64`;
}

const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW = 15 * 60_000;
const MAX_TRACKED_CLIENTS = 10_000;
// Password attempts are counted per client, so one client's guesses never lock out another.
const attempts = new Map<string, { count: number; until: number }>();
const attemptClient = (request: Request) => request.headers.get(CLIENT_ADDRESS_HEADER) ?? "unknown";

// Counted before the password is checked, so parallel guesses can't all get under the limit.
function beginAttempt(client: string) {
  const now = Date.now();
  const entry = attempts.get(client);
  const count = entry && entry.until > now ? entry.count : 0;
  if (count >= MAX_ATTEMPTS) return false;
  // Re-adding keeps the map oldest first, so the oldest client is the one dropped at the cap.
  attempts.delete(client);
  if (attempts.size >= MAX_TRACKED_CLIENTS) attempts.delete(attempts.keys().next().value!);
  attempts.set(client, { count: count + 1, until: now + ATTEMPT_WINDOW });
  return true;
}

// A server reachable from other machines needs a code from its log to create the owner, so
// nobody else on the network can claim a new vault first. The code changes on every start.
const setupCode = randomBytes(10).toString("hex");
const setupCodeNeeded = () => !/^(?:localhost|127(?:\.\d{1,3}){3}|::1)$/i.test(process.env.HOST || "0.0.0.0");
function setupCodeMatches(value: unknown) {
  if (!setupCodeNeeded()) return true;
  if (typeof value !== "string") return false;
  const entered = value.replace(/[\s-]/g, "").toLowerCase();
  return timingSafeEqual(Buffer.from(digest(entered)), Buffer.from(digest(setupCode)));
}
// The code to show in the server log, or null when none is needed.
export function pendingSetupCode() {
  return !account() && setupCodeNeeded() ? setupCode.replace(/(.{4})(?=.)/g, "$1-") : null;
}

function account(): Account | undefined {
  return getSqlite()
    .prepare(
      "SELECT username, password_hash, require_sign_in, credential_generation FROM vault_account WHERE id = 1",
    )
    .get() as Account | undefined;
}
function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function tokenFrom(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
  return bearer ?? request.headers.get("cookie")?.match(/(?:^|;\s*)pv_session=([a-f0-9]{64})(?:;|$)/i)?.[1];
}
export function authenticated(request: Request) {
  const token = tokenFrom(request);
  if (!token) return false;
  return Boolean(
    getSqlite()
      .prepare("SELECT 1 FROM vault_sessions WHERE token_hash = ? AND expires_at > ?")
      .get(digest(token), Date.now()),
  );
}
// Called inside the same synchronous transaction as any credential write. The insert itself
// checks the generation too, so no session can be issued for an older async password check.
function issueSession(generation: number) {
  const token = randomBytes(32).toString("hex");
  const sqlite = getSqlite(),
    now = Date.now();
  sqlite.prepare("DELETE FROM vault_sessions WHERE expires_at <= ?").run(now);
  const inserted = sqlite
    .prepare(
      "INSERT INTO vault_sessions (token_hash, expires_at) SELECT ?, ? FROM vault_account WHERE id = 1 AND credential_generation = ?",
    )
    .run(digest(token), now + lifetime, generation);
  return inserted.changes ? token : null;
}
function sessionResponse(token: string, request: Request) {
  const response = Response.json({ ok: true, token });
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  response.headers.set(
    "set-cookie",
    `pv_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${lifetime / 1000}${secure}`,
  );
  response.headers.set("cache-control", "no-store");
  return response;
}
const error = (message: string, status: number) =>
  Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });

export function authStatus(request: Request) {
  const owner = account();
  return Response.json(
    {
      setupRequired: !owner,
      setupCodeRequired: !owner && setupCodeNeeded(),
      username: owner?.username ?? null,
      requireSignIn: Boolean(owner?.require_sign_in),
      authenticated: authenticated(request),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
export function authorizeVault(request: Request) {
  const owner = account();
  if (!owner) return error("Account setup required", 428);
  if (owner.require_sign_in && !authenticated(request)) return error("Sign in required", 401);
  return null;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
// A factory lets regression tests pause hashing without changing the live handler or its
// password-work limits. Production always uses the real password operations below.
export function createAuthAction(passwords: PasswordOperations = { hashPassword, verifyPassword }) {
  return async (request: Request, path: string): Promise<Response> => {
    try {
      return await runAuthAction(request, path, passwords);
    } catch (caught) {
      if (caught instanceof PasswordCheckBusyError)
        return error("The server is busy checking passwords. Try again in a moment", 503);
      throw caught;
    }
  };
}
export const authAction = createAuthAction();

async function runAuthAction(
  request: Request,
  path: string,
  { hashPassword, verifyPassword }: PasswordOperations,
): Promise<Response> {
  if (!sameOrigin(request)) return error("Invalid origin", 403);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return error("Invalid JSON", 400);
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const client = attemptClient(request);
  if (path === "auth/setup") {
    if (account()) return error("Account already set up", 409);
    if (!setupCodeMatches(body.setupCode)) return error("Enter the setup code from the server log", 403);
    if (username.length < 2 || username.length > 64 || password.length < 12 || password.length > 1024)
      return error("Use a username of 2–64 characters and a password of at least 12 characters", 400);
    try {
      const passwordHash = await hashPassword(password);
      const token = getSqlite().transaction(() => {
        getSqlite()
          .prepare(
            "INSERT INTO vault_account (id, username, password_hash, require_sign_in) VALUES (1, ?, ?, 1)",
          )
          .run(username, passwordHash);
        return issueSession(0)!;
      })();
      return sessionResponse(token, request);
    } catch {
      return error("Account already set up", 409);
    }
  }
  const owner = account();
  if (!owner) return error("Account setup required", 428);
  if (path === "auth/login") {
    if (!beginAttempt(client)) return error("Too many password attempts. Try again later", 429);
    if (username !== owner.username || !(await verifyPassword(password, owner.password_hash)))
      return error("Invalid username or password", 401);
    attempts.delete(client);
    // Compute outside the transaction, then compare-and-swap only the exact verified hash.
    // Another login's rehash may win; that is fine while the password generation is unchanged.
    const upgraded = needsRehash(owner.password_hash) ? await hashPassword(password) : null;
    const token = getSqlite().transaction(() => {
      if (upgraded)
        getSqlite()
          .prepare(
            "UPDATE vault_account SET password_hash = ?, updated_at = ? WHERE id = 1 AND credential_generation = ? AND password_hash = ?",
          )
          .run(upgraded, Date.now(), owner.credential_generation, owner.password_hash);
      return issueSession(owner.credential_generation);
    })();
    return token ? sessionResponse(token, request) : error("Invalid username or password", 401);
  }
  if (path === "auth/logout") {
    if (!authenticated(request)) return error("Sign in required", 401);
    const token = tokenFrom(request);
    if (token) getSqlite().prepare("DELETE FROM vault_sessions WHERE token_hash = ?").run(digest(token));
    const response = Response.json({ ok: true });
    response.headers.set("set-cookie", "pv_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
    return response;
  }
  if (path === "auth/settings") {
    if (typeof body.requireSignIn !== "boolean") return error("Invalid sign-in setting", 400);
    // Otherwise the owner's next request, by this same name, would be refused.
    const { hostname } = new URL(request.url);
    if (!body.requireSignIn && !hostAllowed(hostname))
      return error(
        `Add ${hostname} to PAINTWARDEN_ALLOWED_HOSTS, or open this server by its IP address, before turning off sign-in`,
        400,
      );
    // Only the owner may change this, even while sign-in is off: a session or the password proves it.
    const hasSession = authenticated(request);
    if (!hasSession) {
      if (!password) return error("Sign in required", 401);
      if (!beginAttempt(client)) return error("Too many password attempts. Try again later", 429);
      if (!(await verifyPassword(password, owner.password_hash)))
        return error("Current password is incorrect", 400);
      attempts.delete(client);
    }
    const result = getSqlite().transaction(() => {
      const updated = getSqlite()
        .prepare(
          "UPDATE vault_account SET require_sign_in = ?, updated_at = ? WHERE id = 1 AND credential_generation = ?",
        )
        .run(body.requireSignIn ? 1 : 0, Date.now(), owner.credential_generation);
      if (!updated.changes) return null;
      // Turning sign-in on without a session would otherwise send the owner straight to sign-in.
      return { token: body.requireSignIn && !hasSession ? issueSession(owner.credential_generation) : null };
    })();
    if (!result) return error("Current password is incorrect", 400);
    return result.token ? sessionResponse(result.token, request) : Response.json({ ok: true });
  }
  if (path === "auth/password") {
    if (!beginAttempt(client)) return error("Too many password attempts. Try again later", 429);
    const next = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!(await verifyPassword(password, owner.password_hash)))
      return error("Current password is incorrect", 400);
    attempts.delete(client);
    if (next.length < 12 || next.length > 1024)
      return error("Use at least 12 characters for the new password", 400);
    const nextHash = await hashPassword(next);
    const token = getSqlite().transaction(() => {
      const updated = getSqlite()
        .prepare(
          "UPDATE vault_account SET password_hash = ?, credential_generation = credential_generation + 1, updated_at = ? WHERE id = 1 AND credential_generation = ?",
        )
        .run(nextHash, Date.now(), owner.credential_generation);
      if (!updated.changes) return null;
      // Preserve the existing UX: revoke every old token and return a fresh current session.
      getSqlite().prepare("DELETE FROM vault_sessions").run();
      return issueSession(owner.credential_generation + 1);
    })();
    return token ? sessionResponse(token, request) : error("Current password is incorrect", 400);
  }
  // Renaming the owner keeps existing sessions; only the name used to sign in changes.
  if (path === "auth/username") {
    if (!beginAttempt(client)) return error("Too many password attempts. Try again later", 429);
    const next = typeof body.newUsername === "string" ? body.newUsername.trim() : "";
    if (!(await verifyPassword(password, owner.password_hash)))
      return error("Current password is incorrect", 400);
    attempts.delete(client);
    if (next.length < 2 || next.length > 64) return error("Use a username of 2–64 characters", 400);
    const updated = getSqlite()
      .prepare(
        "UPDATE vault_account SET username = ?, updated_at = ? WHERE id = 1 AND credential_generation = ?",
      )
      .run(next, Date.now(), owner.credential_generation);
    if (!updated.changes) return error("Current password is incorrect", 400);
    return Response.json({ ok: true, username: next }, { headers: { "cache-control": "no-store" } });
  }
  return error("Not found", 404);
}
