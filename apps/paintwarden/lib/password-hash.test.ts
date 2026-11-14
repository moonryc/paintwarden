import assert from "node:assert/strict";
import test from "node:test";

import {
  PASSWORD_CHECK_LIMITS,
  PasswordCheckBusyError,
  SCRYPT_SETTINGS,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "./password-hash.ts";

test("password hashes record their algorithm and settings", async () => {
  const stored = await hashPassword("correct horse battery");
  assert.match(stored, /^scrypt\$N=131072,r=8,p=1\$[\da-f]{32}\$[\da-f]{128}$/);
  assert.notEqual(await hashPassword("correct horse battery"), stored, "each hash has its own salt");
  assert.equal(await verifyPassword("correct horse battery", stored), true);
  assert.equal(await verifyPassword("wrong horse battery", stored), false);
  assert.equal(needsRehash(stored), false);
});

test("older settings still verify and are marked for upgrade", async () => {
  const settings = { N: 2 ** 15, r: 8, p: 1 };
  assert.notDeepEqual(settings, SCRYPT_SETTINGS);
  const older = await hashPassword("correct horse battery", settings);
  assert.match(older, /^scrypt\$N=32768,/);
  assert.equal(await verifyPassword("correct horse battery", older), true);
  assert.equal(needsRehash(older), true);
});

test("unreadable or tampered hashes never match", async () => {
  const stored = await hashPassword("correct horse battery");
  for (const value of [
    "",
    "plain text",
    `bcrypt$${stored.slice("scrypt$".length)}`,
    stored.replace("N=131072", "N=1024"),
    stored.replace("N=131072", "N=100000"),
    stored.replace("r=8", "r=64"),
    stored.slice(0, -2),
  ]) {
    assert.equal(await verifyPassword("correct horse battery", value), false, value.slice(0, 40));
    assert.equal(needsRehash(value), true);
  }
});

test("only a few password checks run at once, and a flood is turned away", async () => {
  const saved = { ...PASSWORD_CHECK_LIMITS };
  const fast = { N: 2 ** 14, r: 8, p: 1 };
  const stored = await hashPassword("long safe password", fast);
  Object.assign(PASSWORD_CHECK_LIMITS, { running: 1, waiting: 1 });
  try {
    const checks = [1, 2, 3].map(() => verifyPassword("long safe password", stored));
    const [first, second, third] = await Promise.allSettled(checks);
    assert.deepEqual(
      [first, second],
      [
        { status: "fulfilled", value: true },
        { status: "fulfilled", value: true },
      ],
    );
    assert.ok(third.status === "rejected" && third.reason instanceof PasswordCheckBusyError);
    // Places are given back, so later checks run normally.
    assert.equal(await verifyPassword("long safe password", stored), true);
  } finally {
    Object.assign(PASSWORD_CHECK_LIMITS, saved);
  }
});
