const { appendFileSync, mkdirSync, renameSync, rmSync, statSync } = require("node:fs");
const path = require("node:path");

const PREFIX = "PAINTWARDEN_STARTUP ";
const phases = new Set(["starting", "backing-up", "migrating", "ready", "failed"]);
const protectedPhase = (state) =>
  ["backing-up", "migrating"].includes(state.phase) && state.status !== "completed";

// Bounded storage, including a single very large output chunk. Private files can contain
// recovery paths and the server's first-run setup code. Never forward raw output to the UI.
function createServerLog(
  directory,
  { maxBytes = 2 * 1024 * 1024, copies = 3, filename = "vault-server.log" } = {},
) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, filename);
  let size;
  try {
    size = statSync(file).size;
  } catch {
    size = 0;
  }
  function rotate() {
    rmSync(`${file}.${copies}`, { force: true });
    for (let index = copies - 1; index >= 1; index--) {
      try {
        renameSync(`${file}.${index}`, `${file}.${index + 1}`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    try {
      renameSync(file, `${file}.1`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    size = 0;
  }
  return {
    file,
    write(chunk) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      for (let offset = 0; offset < bytes.length;) {
        if (size >= maxBytes) rotate();
        const part = bytes.subarray(offset, offset + maxBytes - size);
        appendFileSync(file, part, { mode: 0o600 });
        size += part.length;
        offset += part.length;
      }
    },
  };
}

function createStartupProgress(onChange = () => {}) {
  let state = { phase: "starting" };
  let partial = "";
  return {
    state: () => state,
    protected: () => protectedPhase(state),
    accept(chunk) {
      // Markers are short ASCII JSON lines. Oversized non-marker log lines are discarded
      // by the parser (not by the file log) so a noisy child cannot grow main-process RAM.
      const lines = (partial + chunk.toString()).split("\n");
      partial = lines.pop().slice(-4096);
      for (const line of lines) {
        if (!line.startsWith(PREFIX) || line.length > 4096) continue;
        try {
          const value = JSON.parse(line.slice(PREFIX.length));
          if (!phases.has(value.phase)) continue;
          state = { phase: value.phase, ...(value.status === "completed" ? { status: "completed" } : {}) };
          onChange(state);
        } catch {
          // Ordinary server output is not a protocol message.
        }
      }
    },
  };
}

async function waitForServer({
  child,
  healthy,
  progress,
  now = Date.now,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  startupMs = 60_000,
  overallMs = 30 * 60_000,
}) {
  const started = now();
  let lastProtected = started;
  while (true) {
    if (child.exitCode !== null || child.signalCode || child.spawnError) throw new Error("server-exited");
    if (progress.state().phase === "failed") throw new Error("server-failed");
    if (await healthy()) return;
    const time = now();
    if (progress.protected()) lastProtected = time;
    if (time - started >= overallMs) throw new Error("startup-cap");
    // Synchronous SQLite operations cannot heartbeat the JS event loop. A live child
    // with an explicit protected operation is progress until the generous overall cap.
    if (!progress.protected() && time - lastProtected >= startupMs) throw new Error("startup-stalled");
    await pause(250);
  }
}

module.exports = { createServerLog, createStartupProgress, waitForServer, protectedPhase };
