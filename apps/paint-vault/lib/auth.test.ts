import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("setup, access control, sign-in, and password changes", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-auth-"));
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
    assert.equal((await authStatus(new Request(url)).json()).setupRequired, true);
    assert.equal(authorizeVault(new Request(url))?.status, 428);
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
    assert.equal(
      (await authAction(post("auth/settings", { requireSignIn: false }), "auth/settings")).status,
      401,
    );
    assert.equal(
      (await authAction(post("auth/settings", { requireSignIn: false }, token), "auth/settings")).status,
      200,
    );
    assert.equal(authorizeVault(new Request(url)), null);
    // While sign-in is off, a page that points its own domain at the server (DNS rebinding) is
    // refused: only addresses, localhost names and listed names reach the vault.
    const at = (host: string) => new Request(`http://${host}:3000/api/graphql`);
    assert.equal(hostRefused(at("192.168.1.5")), null);
    assert.equal(hostRefused(at("[fd00::5]")), null);
    assert.equal(hostRefused(at("paint.localhost")), null);
    assert.equal(hostRefused(at("rebind.example"))?.status, 403);
    process.env.PAINT_VAULT_ALLOWED_HOSTS = "nas.home, Rebind.Example";
    assert.equal(hostRefused(at("rebind.example.")), null);
    delete process.env.PAINT_VAULT_ALLOWED_HOSTS;
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
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
