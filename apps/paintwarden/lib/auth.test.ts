import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import Database from "better-sqlite3";

import { migrateVault } from "../db/migrate.ts";

test("setup, access control, sign-in, and password changes", async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-auth-"));
  process.env.DATA_DIR = directory;
  process.env.DATABASE_PATH = path.join(directory, "vault.sqlite");
  try {
    const {
      CLIENT_ADDRESS_HEADER,
      authAction,
      authStatus,
      authorizeVault,
      clientAddress,
      hostAllowed,
      hostRefused,
      pendingSetupCode,
    } = await import("./auth.ts");
    const url = "http://localhost:3000/api/auth/status";
    const post = (path: string, body: object, token?: string) =>
      new Request(`http://localhost:3000/api/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    const { markDesktopNetworkRequest } = await import("./desktop-network.ts");
    const fromNetwork = (request: Request) => {
      markDesktopNetworkRequest(request);
      return request;
    };
    assert.equal((await authStatus(new Request(url)).json()).setupRequired, true);
    assert.equal(authorizeVault(new Request(url))?.status, 428);
    process.env.HOST = "127.0.0.1";
    assert.equal(
      (
        await authAction(
          fromNetwork(post("auth/setup", { username: "stranger", password: "not the owner password" })),
          "auth/setup",
        )
      ).status,
      401,
      "The network listener cannot claim a new desktop vault even when localhost setup needs no code",
    );
    // A server only this machine can reach needs no setup code.
    process.env.HOST = "127.0.0.1";
    assert.equal((await authStatus(new Request(url)).json()).setupCodeRequired, false);
    assert.equal(pendingSetupCode(), null);
    // A server other machines can reach can't be claimed without the code from its log.
    process.env.HOST = "0.0.0.0";
    assert.equal((await authStatus(new Request(url)).json()).setupCodeRequired, true);
    const owner = { username: "painter", password: "long safe password" };
    assert.equal((await authAction(post("auth/setup", owner), "auth/setup")).status, 403);
    assert.equal(
      (await authAction(post("auth/setup", { ...owner, setupCode: "0000-0000" }), "auth/setup")).status,
      403,
    );
    assert.equal((await authStatus(new Request(url)).json()).setupRequired, true);
    const setupCode = pendingSetupCode();
    assert.match(setupCode ?? "", /^[\da-f]{4}(?:-[\da-f]{4}){4}$/);
    const created = await authAction(
      post("auth/setup", { ...owner, setupCode: ` ${setupCode!.toUpperCase()} ` }),
      "auth/setup",
    );
    assert.equal(created.status, 200);
    assert.equal(pendingSetupCode(), null);
    assert.equal((await authStatus(new Request(url)).json()).setupCodeRequired, false);
    const token = (await created.json()).token as string;
    assert.equal(
      (
        await authAction(
          post("auth/setup", { username: "other", password: "another long password" }),
          "auth/setup",
        )
      ).status,
      409,
    );
    assert.equal(authorizeVault(new Request(url))?.status, 401);
    assert.equal(authorizeVault(new Request(url, { headers: { authorization: `Bearer ${token}` } })), null);
    assert.equal(
      (
        await authAction(
          post("auth/login", { username: "painter", password: "incorrect password" }),
          "auth/login",
        )
      ).status,
      401,
    );
    const login = await authAction(
      post("auth/login", { username: "painter", password: "long safe password" }),
      "auth/login",
    );
    assert.equal(login.status, 200);
    assert.doesNotMatch(login.headers.get("set-cookie") ?? "", /; Secure/);
    const httpsLogin = new Request("https://paint.example/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(owner),
    });
    assert.match((await authAction(httpsLogin, "auth/login")).headers.get("set-cookie") ?? "", /; Secure/);
    assert.equal(
      (await authAction(post("auth/settings", { requireSignIn: false }), "auth/settings")).status,
      401,
    );
    assert.equal(
      (await authAction(post("auth/settings", { requireSignIn: false }, token), "auth/settings")).status,
      200,
    );
    assert.equal(authorizeVault(new Request(url)), null);
    const lanUrl = "http://192.168.1.5:48177/api/graphql";
    assert.equal(authorizeVault(fromNetwork(new Request(lanUrl)))?.status, 401);
    assert.equal((await authStatus(fromNetwork(new Request(lanUrl))).json()).requireSignIn, true);
    assert.equal(
      authorizeVault(fromNetwork(new Request(lanUrl, { headers: { cookie: `pv_session=${token}` } }))),
      null,
    );
    assert.equal(
      hostRefused(fromNetwork(new Request("http://desktop.tailnet.ts.net:48177/api/graphql"))),
      null,
    );
    assert.equal(
      authorizeVault(new Request(url, { headers: { "x-paintwarden-network": "1" } })),
      null,
      "Network access is not selected with a spoofable header",
    );
    // While sign-in is off, a page that points its own domain at the server (DNS rebinding) is
    // refused: only addresses, localhost names and listed names reach the vault.
    const at = (host: string) => new Request(`http://${host}:3000/api/graphql`);
    assert.equal(hostRefused(at("192.168.1.5")), null);
    assert.equal(hostRefused(at("[fd00::5]")), null);
    assert.equal(hostRefused(at("paint.localhost")), null);
    assert.equal(hostRefused(at("rebind.example"))?.status, 403);
    process.env.PAINTWARDEN_ALLOWED_HOSTS = "nas.home, Rebind.Example";
    assert.equal(hostRefused(at("rebind.example.")), null);
    delete process.env.PAINTWARDEN_ALLOWED_HOSTS;
    // Sign-in being off doesn't let just anyone change the setting.
    const setSignIn = (body: object) => authAction(post("auth/settings", body), "auth/settings");
    assert.equal((await setSignIn({ requireSignIn: true })).status, 401);
    assert.equal((await setSignIn({ requireSignIn: true, password: "wrong password" })).status, 400);
    assert.equal(authorizeVault(new Request(url)), null);
    const turnedOn = await setSignIn({ requireSignIn: true, password: "long safe password" });
    assert.equal(turnedOn.status, 200);
    assert.ok((await turnedOn.json()).token);
    assert.equal(authorizeVault(new Request(url))?.status, 401);
    // With sign-in on, any name is fine, but sign-in can't be turned off from an unlisted one.
    assert.equal(hostRefused(at("rebind.example")), null);
    const offByName = new Request("http://nas.example:3000/api/auth/settings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ requireSignIn: false }),
    });
    assert.equal((await authAction(offByName, "auth/settings")).status, 400);
    assert.equal(authorizeVault(new Request(url))?.status, 401);
    assert.equal(
      (
        await authAction(
          post("auth/password", { password: "wrong password", newPassword: "another safe password" }, token),
          "auth/password",
        )
      ).status,
      400,
    );
    const changed = await authAction(
      post("auth/password", { password: "long safe password", newPassword: "another safe password" }, token),
      "auth/password",
    );
    assert.equal(changed.status, 200);
    const changedToken = (await changed.json()).token as string;
    const { authenticated } = await import("./auth.ts");
    assert.equal(authenticated(post("auth/status", {}, token)), false);
    assert.equal(authenticated(post("auth/status", {}, (await login.json()).token as string)), false);
    assert.equal(authenticated(post("auth/status", {}, changedToken)), true);
    assert.equal(
      (
        await authAction(
          post("auth/login", { username: "painter", password: "long safe password" }),
          "auth/login",
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await authAction(
          post("auth/login", { username: "painter", password: "another safe password" }),
          "auth/login",
        )
      ).status,
      200,
    );

    // A hash from a pre-release build still signs in, and is upgraded to the current format.
    const { getSqlite } = await import("../db/index.ts");
    const storedHash = () =>
      getSqlite().prepare("SELECT password_hash FROM vault_account WHERE id = 1").pluck().get() as string;
    assert.match(storedHash(), /^scrypt\$N=131072,r=8,p=1\$[\da-f]{32}\$[\da-f]{128}$/);
    const salt = "ab".repeat(16);
    const legacy = `${salt}:${scryptSync("another safe password", salt, 64).toString("hex")}`;
    getSqlite().prepare("UPDATE vault_account SET password_hash = ? WHERE id = 1").run(legacy);
    assert.equal(
      (
        await authAction(
          post("auth/login", { username: "painter", password: "another safe password" }),
          "auth/login",
        )
      ).status,
      200,
    );
    assert.match(storedHash(), /^scrypt\$N=131072,/);

    // Renaming needs the current password, keeps sessions, and changes the sign-in name.
    const rename = (body: object) => authAction(post("auth/username", body, token), "auth/username");
    assert.equal((await rename({ password: "wrong password", newUsername: "brush" })).status, 400);
    assert.equal((await rename({ password: "another safe password", newUsername: "b" })).status, 400);
    const renamed = await rename({ password: "another safe password", newUsername: "  brush  " });
    assert.equal(renamed.status, 200);
    assert.equal((await renamed.json()).username, "brush");
    assert.equal((await authStatus(new Request(url)).json()).username, "brush");
    const signIn = (username: string) =>
      authAction(post("auth/login", { username, password: "another safe password" }), "auth/login");
    assert.equal((await signIn("painter")).status, 401);
    assert.equal((await signIn("brush")).status, 200);

    // Failed attempts lock out only the client that made them.
    const signInFrom = (client: string, username: string) => {
      const request = post("auth/login", { username, password: "another safe password" });
      request.headers.set(CLIENT_ADDRESS_HEADER, client);
      return authAction(request, "auth/login");
    };
    for (let attempt = 0; attempt < 10; attempt += 1)
      assert.equal((await signInFrom("203.0.113.9", "nobody")).status, 401);
    assert.equal((await signInFrom("203.0.113.9", "brush")).status, 429);
    assert.equal((await signInFrom("198.51.100.7", "brush")).status, 200);

    // Without a trusted proxy, forwarded addresses are ignored, so a device on the network can't
    // claim a new address for every guess.
    assert.equal(clientAddress("192.168.1.20", "1.1.1.1", false), "192.168.1.20");
    assert.equal(clientAddress("192.168.1.20", "1.1.1.1"), "192.168.1.20");
    // With one, they are believed only from a possible proxy, and only the entry it added.
    assert.equal(clientAddress("8.8.8.8", "1.1.1.1", true), "8.8.8.8");
    assert.equal(clientAddress("172.18.0.2", "9.9.9.9, 1.1.1.1", true), "1.1.1.1");
    assert.equal(clientAddress("::ffff:127.0.0.1", undefined, true), "::ffff:127.0.0.1");
    // The desktop app's own server answers only to 127.0.0.1, whatever the vault's settings.
    assert.equal(hostAllowed("127.0.0.1", true), true);
    assert.equal(hostAllowed("localhost", true), true);
    assert.equal(hostAllowed("192.168.1.5", true), false);
    assert.equal(hostAllowed("rebind.example", true, ["rebind.example"]), false);
    // Every address in one IPv6 /64 is the same client, however it is written.
    const network = "2606:4700:1:2::/64";
    assert.equal(clientAddress("2606:4700:1:2::1", undefined), network);
    assert.equal(clientAddress("2606:4700:0001:0002:aaaa:bbbb:cccc:dddd", undefined), network);
    assert.equal(clientAddress("172.18.0.2", "2606:4700:1:2::9", true), network);
    assert.equal(clientAddress("2606:4700::1", undefined), "2606:4700:0:0::/64");

    const { createAuthAction } = await import("./auth.ts");
    const passwords = await import("./password-hash.ts");
    const sqlite = getSqlite();
    const oldPassword = "old regression password";
    const newPassword = "new regression password";
    const currentHash = await passwords.hashPassword(oldPassword);
    const legacyHash = `${salt}:${scryptSync(oldPassword, salt, 64).toString("hex")}`;
    const generation = () =>
      sqlite.prepare("SELECT credential_generation FROM vault_account WHERE id = 1").pluck().get();
    const sessionCount = () => sqlite.prepare("SELECT count(*) FROM vault_sessions").pluck().get();
    // Each case starts with a distinct generation; all credential changes in production are CAS.
    const reset = (hash = currentHash) => {
      sqlite.prepare("DELETE FROM vault_sessions").run();
      sqlite
        .prepare(
          "UPDATE vault_account SET username = 'painter', password_hash = ?, require_sign_in = 1, credential_generation = credential_generation + 1 WHERE id = 1",
        )
        .run(hash);
    };
    const loginRequest = () => post("auth/login", { username: "painter", password: oldPassword });
    const changePassword = () =>
      authAction(post("auth/password", { password: oldPassword, newPassword }), "auth/password");
    const assertChanged = async () => {
      assert.equal(await passwords.verifyPassword(newPassword, storedHash()), true);
      assert.equal(await passwords.verifyPassword(oldPassword, storedHash()), false);
    };

    await t.test("an old-password login cannot issue a session after a password change", async () => {
      reset();
      const before = generation();
      const pause = controlledPause();
      const action = createAuthAction({
        ...passwords,
        verifyPassword: async (...args) => {
          const verified = await passwords.verifyPassword(...args);
          await pause.wait();
          return verified;
        },
      });
      const pending = action(loginRequest(), "auth/login");
      await pause.entered;
      try {
        const changed = await changePassword();
        assert.equal(changed.status, 200);
        assert.equal(generation(), Number(before) + 1);
        assert.equal(authenticated(post("auth/status", {}, (await changed.json()).token as string)), true);
      } finally {
        pause.release();
      }
      const stale = await pending;
      assert.equal(stale.status, 401);
      assert.deepEqual(await stale.json(), { error: "Invalid username or password" });
      assert.equal(stale.headers.get("set-cookie"), null);
      assert.equal(stale.headers.get("cache-control"), "no-store");
      assert.equal(sessionCount(), 1);
      await assertChanged();
    });

    await t.test("a delayed legacy rehash cannot replace a changed password or issue a session", async () => {
      reset(legacyHash);
      const pause = controlledPause();
      const action = createAuthAction({
        ...passwords,
        hashPassword: async (...args) => {
          const upgraded = await passwords.hashPassword(...args);
          await pause.wait();
          return upgraded;
        },
      });
      const pending = action(loginRequest(), "auth/login");
      await pause.entered;
      try {
        assert.equal((await changePassword()).status, 200);
      } finally {
        pause.release();
      }
      assert.equal((await pending).status, 401);
      assert.equal(sessionCount(), 1);
      await assertChanged();
    });

    await t.test(
      "concurrent legacy logins rehash by exact-hash CAS without changing generation",
      async () => {
        reset(legacyHash);
        const before = generation();
        const pause = controlledPause();
        const action = createAuthAction({
          ...passwords,
          hashPassword: async (...args) => {
            const upgraded = await passwords.hashPassword(...args);
            await pause.wait();
            return upgraded;
          },
        });
        const pending = action(loginRequest(), "auth/login");
        await pause.entered;
        let winnerHash: string;
        try {
          assert.equal((await authAction(loginRequest(), "auth/login")).status, 200);
          winnerHash = storedHash();
          assert.notEqual(winnerHash, legacyHash);
        } finally {
          pause.release();
        }
        assert.equal((await pending).status, 200);
        assert.equal(storedHash(), winnerHash!);
        assert.equal(generation(), before);
        assert.equal(sessionCount(), 2);
        assert.equal(await passwords.verifyPassword(oldPassword, storedHash()), true);
      },
    );

    await t.test(
      "a stale competing password change cannot overwrite the winner or revoke its session",
      async () => {
        reset();
        const pause = controlledPause();
        const action = createAuthAction({
          ...passwords,
          hashPassword: async (...args) => {
            const hash = await passwords.hashPassword(...args);
            await pause.wait();
            return hash;
          },
        });
        const pending = action(
          post("auth/password", { password: oldPassword, newPassword: "stale different password" }),
          "auth/password",
        );
        await pause.entered;
        let winnerToken: string;
        try {
          const changed = await changePassword();
          assert.equal(changed.status, 200);
          winnerToken = (await changed.json()).token;
        } finally {
          pause.release();
        }
        const stale = await pending;
        assert.equal(stale.status, 400);
        assert.deepEqual(await stale.json(), { error: "Current password is incorrect" });
        assert.equal(authenticated(post("auth/status", {}, winnerToken!)), true);
        assert.equal(sessionCount(), 1);
        await assertChanged();
      },
    );

    for (const route of ["auth/settings", "auth/username"]) {
      await t.test(`a stale password check cannot commit ${route}`, async () => {
        reset();
        const pause = controlledPause();
        const action = createAuthAction({
          ...passwords,
          verifyPassword: async (...args) => {
            const verified = await passwords.verifyPassword(...args);
            await pause.wait();
            return verified;
          },
        });
        const pending = action(
          post(route, { password: oldPassword, requireSignIn: false, newUsername: "stale-name" }),
          route,
        );
        await pause.entered;
        try {
          assert.equal((await changePassword()).status, 200);
        } finally {
          pause.release();
        }
        const stale = await pending;
        assert.equal(stale.status, 400);
        assert.deepEqual(await stale.json(), { error: "Current password is incorrect" });
        assert.equal(sessionCount(), 1);
        assert.equal((await authStatus(new Request(url)).json()).requireSignIn, true);
        assert.equal((await authStatus(new Request(url)).json()).username, "painter");
      });
    }

    await t.test(
      "password-authenticated settings issue a session only for the checked generation",
      async () => {
        reset();
        sqlite.prepare("UPDATE vault_account SET require_sign_in = 0 WHERE id = 1").run();
        const pause = controlledPause();
        const action = createAuthAction({
          ...passwords,
          verifyPassword: async (...args) => {
            const verified = await passwords.verifyPassword(...args);
            await pause.wait();
            return verified;
          },
        });
        const pending = action(
          post("auth/settings", { password: oldPassword, requireSignIn: true }),
          "auth/settings",
        );
        await pause.entered;
        try {
          assert.equal((await changePassword()).status, 200);
        } finally {
          pause.release();
        }
        assert.equal((await pending).status, 400);
        assert.equal(sessionCount(), 1);
        assert.equal((await authStatus(new Request(url)).json()).requireSignIn, false);
      },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// Pause exactly at a completed password operation, never by wall-clock timing.
function controlledPause() {
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    entered,
    release,
    wait: async () => {
      enter();
      await released;
    },
  };
}

test("the credential generation migration preserves an existing owner and sessions", () => {
  const folder = mkdtempSync(path.join(tmpdir(), "paintwarden-auth-migration-"));
  const sqlite = new Database(":memory:");
  try {
    const migrations = path.join(process.cwd(), "drizzle");
    mkdirSync(path.join(folder, "meta"));
    const journal = JSON.parse(readFileSync(path.join(migrations, "meta/_journal.json"), "utf8")) as {
      entries: { tag: string }[];
    };
    writeFileSync(
      path.join(folder, "meta/_journal.json"),
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }),
    );
    writeFileSync(path.join(folder, "0000_init.sql"), readFileSync(path.join(migrations, "0000_init.sql")));
    migrateVault(sqlite, folder);
    sqlite
      .prepare(
        "INSERT INTO vault_account (id, username, password_hash, require_sign_in, updated_at) VALUES (1, 'painter', 'preserved-hash', 0, 123)",
      )
      .run();
    sqlite
      .prepare("INSERT INTO vault_sessions (token_hash, expires_at) VALUES ('preserved-token', ?)")
      .run(Date.now() + 60_000);
    migrateVault(sqlite, migrations);
    assert.deepEqual(sqlite.prepare("SELECT * FROM vault_account").get(), {
      id: 1,
      username: "painter",
      password_hash: "preserved-hash",
      require_sign_in: 0,
      credential_generation: 0,
      updated_at: 123,
    });
    assert.equal(sqlite.prepare("SELECT token_hash FROM vault_sessions").pluck().get(), "preserved-token");
    assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
    assert.equal(sqlite.pragma("foreign_keys", { simple: true }), 1);
    assert.throws(
      () => sqlite.prepare("UPDATE vault_account SET credential_generation = 'invalid'").run(),
      /integers_check/,
    );
    // Restart/no-pending migration does not reset an advanced generation.
    sqlite.prepare("UPDATE vault_account SET credential_generation = 7").run();
    migrateVault(sqlite, migrations);
    assert.equal(sqlite.prepare("SELECT credential_generation FROM vault_account").pluck().get(), 7);
  } finally {
    sqlite.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
