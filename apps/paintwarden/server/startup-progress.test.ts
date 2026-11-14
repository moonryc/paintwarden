import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { after, before, test } from "node:test";

import Database from "better-sqlite3";
import { build } from "esbuild";

import { testStartupDelayMs } from "../lib/startup-progress.ts";

type Progress = { phase: string; status?: string; message?: string };
const { createStartupProgress, waitForServer } = createRequire(import.meta.url)(
  "../../paintwarden-electron/desktop-startup.cjs",
) as {
  createStartupProgress: () => {
    accept: (chunk: string) => void;
    state: () => { phase: string };
    protected: () => boolean;
  };
  waitForServer: (options: {
    child: ChildProcess;
    healthy: () => Promise<boolean>;
    progress: ReturnType<typeof createStartupProgress>;
  }) => Promise<void>;
};
const prefix = "PAINTWARDEN_STARTUP ";
const appDirectory = path.resolve(import.meta.dirname, "..");
// Keep the bundle inside the workspace so its external dependencies resolve normally.
const directory = mkdtempSync(path.join(appDirectory, ".startup-test-"));
const serverFile = path.join(directory, "server.mjs");

before(async () => {
  await build({
    entryPoints: [path.join(appDirectory, "server/main.ts")],
    outfile: serverFile,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    packages: "external",
    tsconfig: path.join(appDirectory, "tsconfig.json"),
  });
  cpSync(path.join(appDirectory, "graphql/schema.graphql"), path.join(directory, "schema.graphql"));
});
after(() => rmSync(directory, { recursive: true, force: true }));

void test("startup delay requires explicit opt-in and is finite, nonnegative and capped at two minutes", () => {
  assert.equal(testStartupDelayMs({ PAINTWARDEN_TEST_STARTUP_DELAY_MS: "120000" }), 0);
  assert.equal(
    testStartupDelayMs({ PAINTWARDEN_TEST_STARTUP: "true", PAINTWARDEN_TEST_STARTUP_DELAY_MS: "120000" }),
    0,
  );
  for (const invalid of [undefined, "", "bad", "Infinity", "-5", "0"])
    assert.equal(
      testStartupDelayMs({ PAINTWARDEN_TEST_STARTUP: "1", PAINTWARDEN_TEST_STARTUP_DELAY_MS: invalid }),
      0,
    );
  assert.equal(
    testStartupDelayMs({ PAINTWARDEN_TEST_STARTUP: "1", PAINTWARDEN_TEST_STARTUP_DELAY_MS: "25.9" }),
    25,
  );
  assert.equal(
    testStartupDelayMs({ PAINTWARDEN_TEST_STARTUP: "1", PAINTWARDEN_TEST_STARTUP_DELAY_MS: "999999" }),
    120_000,
  );
});

function fixture() {
  const work = mkdtempSync(path.join(directory, "vault-"));
  const data = path.join(work, "data");
  mkdirSync(data);
  cpSync(path.join(appDirectory, "drizzle"), path.join(work, "drizzle"), { recursive: true });
  const database = path.join(data, "paintwarden.sqlite");
  const sqlite = new Database(database);
  sqlite.exec("CREATE TABLE fixture_notes (body text); INSERT INTO fixture_notes VALUES ('keep me');");
  sqlite.close();
  return { work, data, database };
}

function launch(work: string, data: string, extraEnv: NodeJS.ProcessEnv = {}) {
  const child = spawn(process.execPath, [serverFile], {
    cwd: work,
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATA_DIR: data,
      DATABASE_PATH: path.join(data, "paintwarden.sqlite"),
      HOST: "127.0.0.1",
      PORT: "0",
      PAINTWARDEN_TEST_STARTUP: "0",
      PAINTWARDEN_TEST_STARTUP_DELAY_MS: "120000",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const desktopProgress = createStartupProgress();
  const events: { progress: Progress; time: number }[] = [];
  let buffer = "";
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => (output += chunk));
  child.stdout.on("data", (chunk: string) => {
    output += chunk;
    desktopProgress.accept(chunk);
    buffer += chunk;
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line.startsWith(prefix)) {
        const progress = JSON.parse(line.slice(prefix.length)) as Progress;
        events.push({ progress, time: performance.now() });
        child.emit("startup-progress", progress);
      }
    }
  });
  async function waitFor(phase: string, status?: string) {
    const match = (progress: Progress) => progress.phase === phase && progress.status === status;
    if (events.some(({ progress }) => match(progress))) return;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        child.off("startup-progress", progress);
        child.off("exit", exited);
      };
      const progress = (value: Progress) => {
        if (!match(value)) return;
        cleanup();
        resolve();
      };
      const exited = () => {
        cleanup();
        reject(new Error(`Server exited before ${phase}: ${output}`));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`No ${phase} progress: ${output}`));
      }, 15_000);
      child.on("startup-progress", progress);
      child.once("exit", exited);
      if (child.exitCode !== null) exited();
    });
  }
  return { child, events, waitFor, desktopProgress };
}

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  await exited;
}

void test("backup and migration progress reaches the parent during synchronous startup work", async () => {
  const { work, data } = fixture();
  const { child, events, waitFor } = launch(work, data, {
    PAINTWARDEN_TEST_STARTUP: "1",
    PAINTWARDEN_TEST_STARTUP_DELAY_MS: "400",
  });
  try {
    await waitFor("backing-up", "started");
    assert.equal(existsSync(path.join(data, "backups")), false, "marker precedes blocked backup work");
    assert.ok(!events.some(({ progress }) => progress.status === "completed"));
    await waitFor("migrating", "started");
    const copies = readdirSync(path.join(data, "backups"));
    assert.equal(copies.length, 1);
    const backup = new Database(path.join(data, "backups", copies[0]), { readonly: true });
    try {
      assert.equal(backup.prepare("SELECT body FROM fixture_notes").pluck().get(), "keep me");
      assert.equal(
        backup.prepare("SELECT count(*) FROM sqlite_master WHERE name = 'vault_sessions'").pluck().get(),
        0,
        "backup precedes schema migration",
      );
    } finally {
      backup.close();
    }
    await waitFor("ready");
    assert.deepEqual(
      events.map(({ progress }) => progress),
      [
        { phase: "starting" },
        { phase: "backing-up", status: "started" },
        { phase: "backing-up", status: "completed" },
        { phase: "migrating", status: "started" },
        { phase: "migrating", status: "completed" },
        { phase: "ready" },
      ],
    );
    assert.ok(events[2].time - events[1].time >= 350, "backup marker is visible during the wait");
    assert.ok(events[4].time - events[3].time >= 350, "migration marker is visible during the wait");
  } finally {
    await stop(child);
  }
  // An ordinary restart neither enters protected phases nor honors an ungated delay variable.
  const restarted = launch(work, data);
  try {
    await restarted.waitFor("ready");
    assert.deepEqual(
      restarted.events.map(({ progress }) => progress),
      [{ phase: "starting" }, { phase: "ready" }],
    );
  } finally {
    await stop(restarted.child);
  }
});

void test("a real migration failure reports failed rather than completed/ready and preserves the backup", async () => {
  const { work, data } = fixture();
  const journal = JSON.parse(
    // The current migration is replaced only in this isolated fixture.
    readFileSync(path.join(work, "drizzle/meta/_journal.json"), "utf8"),
  ) as { entries: { tag: string }[] };
  writeFileSync(path.join(work, "drizzle", `${journal.entries[0].tag}.sql`), "INVALID MIGRATION SQL;");
  const { child, events, waitFor } = launch(work, data);
  try {
    await waitFor("failed");
    const failure = events.at(-1)?.progress;
    assert.match(failure?.message || "", /Updating the vault failed/);
    assert.ok(!events.some(({ progress }) => progress.phase === "ready"));
    assert.ok(
      !events.some(({ progress }) => progress.phase === "migrating" && progress.status === "completed"),
    );
    assert.equal(readdirSync(path.join(data, "backups")).length, 1);
    if (child.exitCode === null) await once(child, "exit", { signal: AbortSignal.timeout(5_000) });
    assert.equal(child.exitCode, 1, "caught startup failure exits normally with failure status");
  } finally {
    await stop(child);
  }
});

void test("a table-name collision is a recoverable migration error, never advice to reset user data", async () => {
  const { work, data } = fixture();
  const journal = JSON.parse(readFileSync(path.join(work, "drizzle/meta/_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };
  writeFileSync(
    path.join(work, "drizzle", `${journal.entries[0].tag}.sql`),
    "CREATE TABLE fixture_notes (body text);",
  );
  const running = launch(work, data);
  try {
    await running.waitFor("failed");
    const message = running.events.at(-1)!.progress.message!;
    assert.match(message, /Updating the vault failed:.*already exists/);
    assert.doesNotMatch(message, /empty data directory|pre-release schema/);
    assert.match(message, /copy that file over/);
  } finally {
    await stop(running.child);
  }
});

void test("a failed backup stops startup before migration and reports the actual failure", async () => {
  const { work, data } = fixture();
  writeFileSync(path.join(data, "backups"), "not a directory");
  const { child, events, waitFor } = launch(work, data);
  try {
    await waitFor("failed");
    assert.deepEqual(
      events.slice(0, -1).map(({ progress }) => progress),
      [{ phase: "starting" }, { phase: "backing-up", status: "started" }],
    );
    assert.match(events.at(-1)?.progress.message || "", /EEXIST/);
    if (child.exitCode === null) await once(child, "exit", { signal: AbortSignal.timeout(5_000) });
    assert.equal(child.exitCode, 1);
    const sqlite = new Database(path.join(data, "paintwarden.sqlite"), { readonly: true });
    try {
      assert.equal(sqlite.prepare("SELECT body FROM fixture_notes").pluck().get(), "keep me");
      assert.equal(
        sqlite.prepare("SELECT count(*) FROM sqlite_master WHERE name = 'vault_sessions'").pluck().get(),
        0,
      );
    } finally {
      sqlite.close();
    }
  } finally {
    await stop(child);
  }
});

void test("broken-FK migration rolls back and blocks server and desktop startup after process restarts", async () => {
  const { work, data, database } = fixture();
  const original = launch(work, data);
  try {
    await original.waitFor("ready");
  } finally {
    await stop(original.child);
  }
  const sqlite = new Database(database);
  sqlite.exec(`CREATE TABLE synthetic_parent (id text PRIMARY KEY);
    CREATE TABLE synthetic_child (id text PRIMARY KEY, parent_id text REFERENCES synthetic_parent(id));
    INSERT INTO synthetic_parent VALUES ('parent');
    INSERT INTO synthetic_child VALUES ('child', 'parent');`);
  const originalJournal = sqlite.prepare("SELECT * FROM __drizzle_migrations").all();
  sqlite.close();
  const journalFile = path.join(work, "drizzle/meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalFile, "utf8")) as {
    entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[];
  };
  const last = journal.entries.at(-1)!;
  journal.entries.push({ ...last, idx: last.idx + 1, when: last.when + 1, tag: "9999_synthetic_broken_fk" });
  writeFileSync(journalFile, JSON.stringify(journal));
  writeFileSync(
    path.join(work, "drizzle/9999_synthetic_broken_fk.sql"),
    `
    CREATE TABLE __new_synthetic_parent (id text PRIMARY KEY);
    --> statement-breakpoint
    DROP TABLE synthetic_parent;
    --> statement-breakpoint
    ALTER TABLE __new_synthetic_parent RENAME TO synthetic_parent;`,
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    const running = launch(work, data);
    try {
      await running.waitFor("failed");
      assert.equal(running.desktopProgress.state().phase, "failed");
      await assert.rejects(
        waitForServer({
          child: running.child,
          progress: running.desktopProgress,
          healthy: async () => assert.fail("desktop must not accept a failed server as healthy"),
        }),
        /server-(failed|exited)/,
      );
      assert.ok(!running.events.some(({ progress }) => progress.phase === "ready"));
      const message = running.events.at(-1)!.progress.message!;
      assert.match(message, /1 records with broken links \(synthetic_child\)/);
      assert.match(message, /remove the database -wal and -shm sidecars/);
      assert.match(message, /Restart with the previous working app or a corrected update/);
      if (running.child.exitCode === null)
        await once(running.child, "exit", { signal: AbortSignal.timeout(5_000) });
      assert.equal(running.child.exitCode, 1);
      const checked = new Database(database, { readonly: true });
      assert.deepEqual(checked.prepare("SELECT * FROM __drizzle_migrations").all(), originalJournal);
      assert.deepEqual(checked.pragma("foreign_key_check"), []);
      assert.deepEqual(checked.prepare("SELECT * FROM synthetic_parent").all(), [{ id: "parent" }]);
      checked.close();
      const backups = readdirSync(path.join(data, "backups")).filter((file) =>
        file.includes("9999_synthetic_broken_fk"),
      );
      assert.ok(backups.length > 0);
      const backup = new Database(path.join(data, "backups", backups.at(-1)!), { readonly: true });
      assert.deepEqual(backup.prepare("SELECT * FROM __drizzle_migrations").all(), originalJournal);
      assert.deepEqual(backup.pragma("foreign_key_check"), []);
      backup.close();
    } finally {
      await stop(running.child);
    }
  }
});
