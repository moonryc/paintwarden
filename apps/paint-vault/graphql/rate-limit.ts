import { createHash } from "node:crypto";

import { CLIENT_ADDRESS_HEADER } from "../lib/auth.ts";

type Bucket = { until: number; count: number; active: number };
const clients = new Map<string, Bucket>();
const sessions = new Map<string, Bucket>();
let streams = 0;

// The address is injected by Nest after TRUST_PROXY handling, never taken from forwarded headers here.
// Separate client AND credential buckets prevent rotating fake sessions from bypassing client limits.
export function acquireOperation(request: Request, stream: boolean): (() => void) | null {
  const now = Date.now();
  const token =
    request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1] ??
    request.headers.get("cookie")?.match(/(?:^|;\s*)pv_session=([a-f0-9]{64})(?:;|$)/i)?.[1];
  // Match auth's token selection, not the raw header: irrelevant cookies, bearer casing and
  // switching between cookie/bearer transport must not create fresh session allowances.
  const identity = createHash("sha256")
    .update(token?.toLowerCase() ?? "anonymous")
    .digest("hex");
  const keys = [request.headers.get(CLIENT_ADDRESS_HEADER) ?? "unknown", identity];
  const maps = [clients, sessions];
  const buckets = maps.map((map, index) => {
    let bucket = map.get(keys[index]);
    if (!bucket) {
      if (map.size >= 10_000) {
        // Never evict an active stream's concurrency accounting.
        const idle = [...map].find(([, value]) => value.active === 0);
        if (idle) map.delete(idle[0]);
        else return null;
      }
      bucket = { until: now + 60_000, count: 0, active: 0 };
      map.set(keys[index], bucket);
    }
    if (bucket.until <= now) {
      bucket.until = now + 60_000;
      bucket.count = 0;
    }
    return bucket;
  });
  if (
    buckets.some((bucket) => !bucket || bucket.count >= 120 || bucket.active >= 4) ||
    (stream && streams >= 128)
  )
    return null;
  for (const bucket of buckets) {
    bucket!.count++;
    bucket!.active++;
  }
  if (stream) streams++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const bucket of buckets) bucket!.active--;
    if (stream) streams--;
  };
}
