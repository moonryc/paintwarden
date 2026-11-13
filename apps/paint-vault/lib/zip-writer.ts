import { promisify } from "node:util";
import { crc32, deflateRaw } from "node:zlib";

// Writes a ZIP one file at a time, so memory use doesn't grow with the size of the archive. ZIP64
// records are added once the archive outgrows the classic format's 4 GiB and 65,535-file limits.

export type ZipFile = { name: string; data: Uint8Array; compress?: boolean };

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_RECORD = 0x06054b50;
const ZIP64_END_RECORD = 0x06064b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_EXTRA_FIELD = 0x0001;
const ZIP64_END_RECORD_BODY_SIZE = 44;
const MAX_16 = 0xffff;
const MAX_32 = 0xffffffff;
const VERSION = 20;
const VERSION_ZIP64 = 45;
const UTF8_NAMES = 0x0800;
const STORED = 0;
const DEFLATED = 8;

const deflate = promisify(deflateRaw);

function record(...fields: [size: 2 | 4 | 8, value: number][]) {
  const bytes = Buffer.alloc(fields.reduce((total, [size]) => total + size, 0));
  let offset = 0;
  for (const [size, value] of fields) {
    if (size === 2) bytes.writeUInt16LE(value, offset);
    else if (size === 4) bytes.writeUInt32LE(value, offset);
    else bytes.writeBigUInt64LE(BigInt(value), offset);
    offset += size;
  }
  return bytes;
}

function dosDateTime(date: Date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    day: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export async function* writeZip(files: AsyncIterable<ZipFile>, date = new Date()) {
  const { time, day } = dosDateTime(date);
  const directory: Buffer[] = [];
  let offset = 0;
  let count = 0;
  for await (const file of files) {
    const name = Buffer.from(file.name);
    const data = file.compress ? await deflate(file.data) : file.data;
    if (file.data.byteLength >= MAX_32 || data.byteLength >= MAX_32)
      throw new Error(`${file.name} is too large for a backup`);
    const shared: [2 | 4, number][] = [
      [2, UTF8_NAMES],
      [2, file.compress ? DEFLATED : STORED],
      [2, time],
      [2, day],
      [4, crc32(file.data)],
      [4, data.byteLength],
      [4, file.data.byteLength],
      [2, name.byteLength],
    ];
    const header = Buffer.concat([record([4, LOCAL_HEADER], [2, VERSION], ...shared, [2, 0]), name]);
    const zip64 = offset >= MAX_32;
    const version = zip64 ? VERSION_ZIP64 : VERSION;
    const extra = zip64 ? record([2, ZIP64_EXTRA_FIELD], [2, 8], [8, offset]) : Buffer.alloc(0);
    directory.push(
      record(
        [4, CENTRAL_HEADER],
        [2, version],
        [2, version],
        ...shared,
        [2, extra.byteLength],
        [2, 0],
        [2, 0],
        [2, 0],
        [4, 0],
        [4, Math.min(offset, MAX_32)],
      ),
      name,
      extra,
    );
    yield header;
    yield data;
    offset += header.byteLength + data.byteLength;
    count += 1;
  }

  const directoryBytes = Buffer.concat(directory);
  const size = directoryBytes.byteLength;
  yield directoryBytes;
  if (count >= MAX_16 || size >= MAX_32 || offset >= MAX_32) {
    yield record(
      [4, ZIP64_END_RECORD],
      [8, ZIP64_END_RECORD_BODY_SIZE],
      [2, VERSION_ZIP64],
      [2, VERSION_ZIP64],
      [4, 0],
      [4, 0],
      [8, count],
      [8, count],
      [8, size],
      [8, offset],
    );
    yield record([4, ZIP64_LOCATOR], [4, 0], [8, offset + size], [4, 1]);
  }
  yield record(
    [4, END_RECORD],
    [2, 0],
    [2, 0],
    [2, Math.min(count, MAX_16)],
    [2, Math.min(count, MAX_16)],
    [4, Math.min(size, MAX_32)],
    [4, Math.min(offset, MAX_32)],
    [2, 0],
  );
}
