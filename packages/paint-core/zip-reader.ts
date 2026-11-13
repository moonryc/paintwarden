// Reads a ZIP file's directory and single entries through random access, so a backup of any size
// can be inspected without loading it. The server reads from disk and the browser from file slices.

export type ZipSource = {
  size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
};

export type ZipEntry = {
  name: string;
  flags: number;
  method: number;
  crc32: number;
  compressedSize: number;
  size: number;
  headerOffset: number;
};

export class ZipFormatError extends Error {}
export class ZipLimitError extends ZipFormatError {}

export type ZipDirectoryLimits = { maxEntries: number; maxDirectoryBytes: number };

const END_RECORD = 0x06054b50;
const END_RECORD_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_LOCATOR_SIZE = 20;
const ZIP64_END_RECORD = 0x06064b50;
const ZIP64_END_RECORD_SIZE = 56;
const CENTRAL_HEADER = 0x02014b50;
const CENTRAL_HEADER_SIZE = 46;
const LOCAL_HEADER = 0x04034b50;
const LOCAL_HEADER_SIZE = 30;
const ZIP64_EXTRA_FIELD = 0x0001;
const MAX_16 = 0xffff;
const MAX_32 = 0xffffffff;
const STORED = 0;
const DEFLATED = 8;
const ENCRYPTED_FLAG = 1;

const damaged = () => new ZipFormatError("This ZIP file is damaged");
const viewOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

function read64(view: DataView, offset: number) {
  const value = Number(view.getBigUint64(offset, true));
  if (!Number.isSafeInteger(value)) throw damaged();
  return value;
}

async function readRange(source: ZipSource, offset: number, length: number) {
  if (offset < 0 || length < 0 || offset + length > source.size) throw damaged();
  const bytes = await source.read(offset, length);
  if (bytes.byteLength !== length) throw damaged();
  return bytes;
}

// The end record sits at the end of the file, followed only by an optional comment.
function findEndRecord(tail: DataView) {
  for (let offset = tail.byteLength - END_RECORD_SIZE; offset >= 0; offset -= 1)
    if (
      tail.getUint32(offset, true) === END_RECORD &&
      offset + END_RECORD_SIZE + tail.getUint16(offset + 20, true) <= tail.byteLength
    )
      return offset;
  throw damaged();
}

async function readDirectoryLocation(source: ZipSource) {
  const tailLength = Math.min(source.size, END_RECORD_SIZE + MAX_COMMENT_SIZE);
  if (tailLength < END_RECORD_SIZE) throw damaged();
  const tailStart = source.size - tailLength;
  const tail = viewOf(await readRange(source, tailStart, tailLength));
  const end = findEndRecord(tail);
  const count = tail.getUint16(end + 10, true);
  const size = tail.getUint32(end + 12, true);
  const offset = tail.getUint32(end + 16, true);
  if (count !== MAX_16 && size !== MAX_32 && offset !== MAX_32) return { count, size, offset };

  const locatorOffset = tailStart + end - ZIP64_LOCATOR_SIZE;
  const locator = viewOf(await readRange(source, locatorOffset, ZIP64_LOCATOR_SIZE));
  if (locator.getUint32(0, true) !== ZIP64_LOCATOR) throw damaged();
  const record = viewOf(await readRange(source, read64(locator, 8), ZIP64_END_RECORD_SIZE));
  if (record.getUint32(0, true) !== ZIP64_END_RECORD) throw damaged();
  return { count: read64(record, 32), size: read64(record, 40), offset: read64(record, 48) };
}

// Values too large for a central header are stored, in this order, in its ZIP64 extra field.
function applyZip64Extra(entry: ZipEntry, view: DataView, start: number, end: number) {
  if (entry.size !== MAX_32 && entry.compressedSize !== MAX_32 && entry.headerOffset !== MAX_32) return;
  for (let offset = start; offset + 4 <= end; offset += 4 + view.getUint16(offset + 2, true)) {
    if (view.getUint16(offset, true) !== ZIP64_EXTRA_FIELD) continue;
    let field = offset + 4;
    const next = () => {
      if (field + 8 > end) throw damaged();
      const value = read64(view, field);
      field += 8;
      return value;
    };
    if (entry.size === MAX_32) entry.size = next();
    if (entry.compressedSize === MAX_32) entry.compressedSize = next();
    if (entry.headerOffset === MAX_32) entry.headerOffset = next();
    return;
  }
  throw damaged();
}

export async function readZipDirectory(source: ZipSource, limits?: ZipDirectoryLimits) {
  const location = await readDirectoryLocation(source);
  if (limits && (location.count > limits.maxEntries || location.size > limits.maxDirectoryBytes))
    throw new ZipLimitError("This ZIP file has too many entries");
  const bytes = await readRange(source, location.offset, location.size);
  const view = viewOf(bytes);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let offset = 0;
  for (let index = 0; index < location.count; index += 1) {
    if (offset + CENTRAL_HEADER_SIZE > bytes.byteLength || view.getUint32(offset, true) !== CENTRAL_HEADER)
      throw damaged();
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + CENTRAL_HEADER_SIZE;
    const extraStart = nameStart + nameLength;
    const next = extraStart + extraLength + commentLength;
    if (next > bytes.byteLength) throw damaged();
    const entry: ZipEntry = {
      name: decoder.decode(bytes.subarray(nameStart, extraStart)),
      flags: view.getUint16(offset + 8, true),
      method: view.getUint16(offset + 10, true),
      crc32: view.getUint32(offset + 16, true),
      compressedSize: view.getUint32(offset + 20, true),
      size: view.getUint32(offset + 24, true),
      headerOffset: view.getUint32(offset + 42, true),
    };
    applyZip64Extra(entry, view, extraStart, extraStart + extraLength);
    entries.push(entry);
    offset = next;
  }
  return entries;
}

// Returns the entry's stored bytes. `entry.method` says whether they still need inflating.
export async function readZipEntryData(source: ZipSource, entry: ZipEntry) {
  if (entry.flags & ENCRYPTED_FLAG || (entry.method !== STORED && entry.method !== DEFLATED)) throw damaged();
  const header = viewOf(await readRange(source, entry.headerOffset, LOCAL_HEADER_SIZE));
  if (header.getUint32(0, true) !== LOCAL_HEADER) throw damaged();
  const start =
    entry.headerOffset + LOCAL_HEADER_SIZE + header.getUint16(26, true) + header.getUint16(28, true);
  return readRange(source, start, entry.compressedSize);
}
