import { promisify } from "node:util";
import { crc32, inflateRaw } from "node:zlib";

import {
  ZipFormatError,
  readZipEntryData,
  type ZipEntry,
  type ZipSource,
} from "@paintwarden/core/zip-reader";

const STORED = 0;
const inflate = promisify(inflateRaw);
const damaged = () => new ZipFormatError("This ZIP file is damaged");

// Reads one entry without ever holding more than `limit` bytes of its contents, whatever its
// headers claim. Inflating runs off the main thread. Throws ZipFormatError for a bad entry.
export async function readZipEntry(source: ZipSource, entry: ZipEntry, limit: number) {
  // Compression never grows data by more than a sliver, so a larger stored size is a false header.
  if (entry.size > limit || entry.compressedSize > entry.size * 1.01 + 1024) throw damaged();
  let data: Uint8Array;
  try {
    const stored = await readZipEntryData(source, entry);
    data = entry.method === STORED ? stored : await inflate(stored, { maxOutputLength: limit });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code?.match(/^(Z_|ERR_BUFFER)/)) throw damaged();
    throw error;
  }
  if (data.byteLength !== entry.size || crc32(data) !== entry.crc32) throw damaged();
  return data;
}
