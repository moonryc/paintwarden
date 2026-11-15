import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const directory = await mkdtemp(path.join(tmpdir(), "paintwarden-upload-spool-test-"));
process.env.DATA_DIR = directory;
const root = path.join(
  tmpdir(),
  `paintwarden-plugin-uploads-${createHash("sha256").update(path.resolve(directory)).digest("hex").slice(0, 24)}`,
);
const { spoolPluginUpload, sweepPluginUploads } = await import("./catalog-install-upload.ts");
const { pluginInstallFailure } = await import("./catalog-install-jobs.ts");
test.after(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(directory, { recursive: true, force: true });
});

test("spooled ZIP is private, bounded random-access, with empty/single-use cleanup", async () => {
  const bytes = new Uint8Array([4, 3, 2, 1]);
  const spool = await spoolPluginUpload(
    new Request("http://localhost/upload", { method: "POST", body: bytes }),
    new AbortController().signal,
  );
  assert.equal(spool.source.size, 4);
  assert.deepEqual([...(await spool.source.read(1, 2))], [3, 2]);
  if (process.platform !== "win32") assert.equal((await lstat(root)).mode & 0o077, 0);
  const [name] = await readdir(root);
  assert.deepEqual([...(await readFile(path.join(root, name, "source.zip")))], [...bytes]);
  await spool.close();
  assert.deepEqual(await readdir(root), []);
  await assert.rejects(
    spoolPluginUpload(
      new Request("http://localhost/upload", { method: "POST", body: new Uint8Array() }),
      new AbortController().signal,
    ),
    /Choose a plugin/,
  );
  assert.deepEqual(await readdir(root), []);
});

test("cancel and initiating-request disconnect terminate a slow upload and remove spool", async () => {
  for (const cancelRequest of [false, true]) {
    const job = new AbortController();
    const request = new AbortController();
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([1]));
        started();
        return new Promise<void>(() => {});
      },
    });
    const pending = spoolPluginUpload(
      new Request("http://localhost/upload", {
        method: "POST",
        body: stream,
        signal: request.signal,
        duplex: "half",
      } as RequestInit),
      job.signal,
    );
    await ready;
    (cancelRequest ? request : job).abort(new Error("Synthetic cancelled upload"));
    await assert.rejects(pending, /Synthetic cancelled upload/);
    assert.deepEqual(await readdir(root), []);
  }
});

test("locked request and restart leftovers are cleaned without public path exposure", async () => {
  const request = new Request("http://localhost/upload", { method: "POST", body: "x" });
  const reader = request.body!.getReader();
  await assert.rejects(spoolPluginUpload(request, new AbortController().signal), /locked/);
  reader.releaseLock();
  assert.deepEqual(await readdir(root), []);
  const old = path.join(root, `upload-${process.pid}-crash-leftover`);
  await mkdir(old);
  await writeFile(path.join(old, "source.zip"), "synthetic partial data");
  await sweepPluginUploads();
  assert.deepEqual(await readdir(root), []);
  assert.deepEqual(
    pluginInstallFailure(Object.assign(new Error("ENOSPC /private/secret/path"), { code: "ENOSPC" })),
    {
      error: "There is not enough disk space to install this plugin",
      errorCode: "PLUGIN_INSTALL_NOT_ENOUGH_SPACE",
      errorParameters: {},
    },
  );
  assert.deepEqual(pluginInstallFailure(new Error("EIO /private/secret/path")), {
    error: "Plugin install failed",
    errorCode: "REQUEST_FAILED",
    errorParameters: {},
  });
});
