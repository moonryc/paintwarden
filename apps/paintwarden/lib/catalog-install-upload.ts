import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, open, readdir, rm, type FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { ZipSource } from "@paintwarden/core/zip-reader";

import { UPLOAD_MAX_BYTES } from "./catalog-source-upload";

const dataDirectory = process.env.DATA_DIR || path.resolve(process.cwd(), "../../data");
const uploadDirectory = path.join(
  tmpdir(),
  `paintwarden-plugin-uploads-${createHash("sha256").update(path.resolve(dataDirectory)).digest("hex").slice(0, 24)}`,
);

async function ensureUploadDirectory() {
  await mkdir(uploadDirectory, { recursive: true, mode: 0o700 });
  const info = await lstat(uploadDirectory);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (typeof process.getuid === "function" && info.uid !== process.getuid())
  )
    throw new Error("Unsafe plugin upload directory");
  if (process.platform !== "win32" && info.mode & 0o077) await chmod(uploadDirectory, 0o700);
}
function processAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}
export async function sweepPluginUploads() {
  await ensureUploadDirectory();
  for (const entry of await readdir(uploadDirectory, { withFileTypes: true })) {
    const match = /^upload-(\d+)-/.exec(entry.name);
    if (!entry.isDirectory() || !match) continue;
    const pid = Number(match[1]);
    if (pid !== process.pid && processAlive(pid)) continue;
    await rm(path.join(uploadDirectory, entry.name), { recursive: true, force: true });
  }
}

// Stream the bounded upload to disk. ZIP entries are inflated lazily through random reads;
// neither the compressed archive nor all expanded images are held in JS memory.
export async function spoolPluginUpload(request: Request, jobSignal: AbortSignal) {
  const signal = AbortSignal.any([jobSignal, request.signal]);
  let directory: string | undefined;
  let file: FileHandle | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const abort = () => {
    void reader?.cancel(signal.reason).catch(() => {});
  };
  let size = 0;
  try {
    signal.throwIfAborted();
    await ensureUploadDirectory();
    directory = await mkdtemp(path.join(uploadDirectory, `upload-${process.pid}-`));
    file = await open(path.join(directory, "source.zip"), "wx+");
    reader = request.body?.getReader();
    if (!reader) throw new Error("Choose a plugin .zip file");
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    for (;;) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > UPLOAD_MAX_BYTES) throw new Error("The plugin file must be under 250 MB");
      let offset = 0;
      while (offset < chunk.value.byteLength) {
        signal.throwIfAborted();
        const result = await file.write(chunk.value, offset, chunk.value.byteLength - offset);
        if (!result.bytesWritten) throw new Error("Could not write plugin upload");
        offset += result.bytesWritten;
      }
    }
    signal.throwIfAborted();
    if (!size) throw new Error("Choose a plugin .zip file");
    const savedFile = file;
    const savedDirectory = directory;
    const source: ZipSource = {
      size,
      async read(offset, length) {
        jobSignal.throwIfAborted();
        const bytes = Buffer.alloc(length);
        let read = 0;
        while (read < length) {
          const result = await savedFile.read(bytes, read, length - read, offset + read);
          if (!result.bytesRead) break;
          read += result.bytesRead;
        }
        return bytes.subarray(0, read);
      },
    };
    return {
      source,
      async close() {
        try {
          await savedFile.close();
        } finally {
          await rm(savedDirectory, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    await reader?.cancel().catch(() => {});
    await file?.close().catch(() => {});
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    reader?.releaseLock();
  }
}
