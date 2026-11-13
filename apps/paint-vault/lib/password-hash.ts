import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Password hashes record how they were made: `scrypt$N=131072,r=8,p=1$<salt>$<hash>`, with the salt
// and hash in hex. Changing SCRYPT_SETTINGS strengthens new hashes, and needsRehash() lets sign-in
// upgrade an older hash while the plain password is at hand.
export const SCRYPT_SETTINGS = { N: 2 ** 17, r: 8, p: 1 } as const;
const KEY_BYTES = 64;
const SALT_BYTES = 16;

type Settings = { N: number; r: number; p: number };
type Parsed = { settings: Settings; salt: string; hash: Buffer };

// scrypt needs about 128 * N * r bytes; the limit leaves headroom above that.
const maxmem = ({ N, r }: Settings) => 256 * N * r;
export class PasswordCheckBusyError extends Error {}

// Each hash holds about 128 MB while it runs, so only a few run at once and only a few more may
// wait; beyond that, a flood of sign-in attempts is turned away instead of exhausting memory.
export const PASSWORD_CHECK_LIMITS = { running: 2, waiting: 16 };
let running = 0;
const waiting: (() => void)[] = [];

async function oneAtATime<T>(task: () => Promise<T>) {
  if (running < PASSWORD_CHECK_LIMITS.running) running += 1;
  else if (waiting.length >= PASSWORD_CHECK_LIMITS.waiting)
    throw new PasswordCheckBusyError("Too many password checks are waiting");
  // A finishing task hands its place straight to the next one, so `running` stays the same.
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running -= 1;
  }
}

// Hashing takes a noticeable moment at these settings, so it runs off the main thread.
const derive = (password: string, salt: string, settings: Settings) =>
  oneAtATime(() => deriveNow(password, salt, settings));
const deriveNow = (password: string, salt: string, settings: Settings) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      KEY_BYTES,
      { ...settings, maxmem: maxmem(settings) } satisfies ScryptOptions,
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );

// Accepted settings stay within what a vault server can compute.
const sane = ({ N, r, p }: Settings) =>
  Number.isInteger(Math.log2(N)) && N >= 2 ** 14 && N <= 2 ** 20 && r >= 1 && r <= 32 && p >= 1 && p <= 16;

function parse(stored: string): Parsed | null {
  const current = /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([\da-f]{32})\$([\da-f]{128})$/.exec(stored);
  if (current) {
    const settings = { N: Number(current[1]), r: Number(current[2]), p: Number(current[3]) };
    return sane(settings) ? { settings, salt: current[4], hash: Buffer.from(current[5], "hex") } : null;
  }
  // Pre-release builds stored `salt:hash` with Node's default scrypt settings.
  const legacy = /^([\da-f]{32}):([\da-f]{128})$/.exec(stored);
  return legacy
    ? { settings: { N: 2 ** 14, r: 8, p: 1 }, salt: legacy[1], hash: Buffer.from(legacy[2], "hex") }
    : null;
}

export async function hashPassword(password: string, settings: Settings = SCRYPT_SETTINGS) {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = (await derive(password, salt, settings)).toString("hex");
  return `scrypt$N=${settings.N},r=${settings.r},p=${settings.p}$${salt}$${hash}`;
}

// An unreadable or unknown hash never matches.
export async function verifyPassword(password: string, stored: string) {
  const parsed = parse(stored);
  return !!parsed && timingSafeEqual(await derive(password, parsed.salt, parsed.settings), parsed.hash);
}

export function needsRehash(stored: string) {
  const parsed = parse(stored);
  return (
    !parsed ||
    !stored.startsWith("scrypt$") ||
    parsed.settings.N !== SCRYPT_SETTINGS.N ||
    parsed.settings.r !== SCRYPT_SETTINGS.r ||
    parsed.settings.p !== SCRYPT_SETTINGS.p
  );
}
