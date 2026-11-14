import { writeSync } from "node:fs";

type ProtectedPhase = "backing-up" | "migrating";
type StartupProgress = {
  phase: "starting" | ProtectedPhase | "ready" | "failed";
  status?: "started" | "completed";
  message?: string;
};

// These small lines must reach the parent before SQLite blocks the event loop. In particular,
// console/process.stdout.write can leave a pipe write queued until AFTER VACUUM or migration.
export function reportStartupProgress(progress: StartupProgress) {
  writeSync(process.stdout.fd, `PAINT_VAULT_STARTUP ${JSON.stringify(progress)}\n`);
}

// Explicitly opt-in, bounded fault injection for packaged-server integration tests. Never slow
// production startup just because a delay variable was inherited from the environment.
export function testStartupDelayMs(env: NodeJS.ProcessEnv = process.env) {
  if (env.PAINT_VAULT_TEST_STARTUP !== "1") return 0;
  const delay = Number(env.PAINT_VAULT_TEST_STARTUP_DELAY_MS);
  return Number.isFinite(delay) && delay > 0 ? Math.min(Math.floor(delay), 120_000) : 0;
}

export function startStartupOperation(phase: ProtectedPhase) {
  reportStartupProgress({ phase, status: "started" });
  const delay = testStartupDelayMs();
  // Deliberately block just like better-sqlite3; an async timer would not exercise the bug.
  if (delay) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
}
