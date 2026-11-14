import { createHash } from "node:crypto";

// Tests name records in words; the vault only stores UUIDs. testId gives the same UUID for the same
// name every time, so fixtures stay readable and comparisons stay stable.
export function testId(name: string) {
  const hex = createHash("sha1").update(`test:${name}`).digest("hex");
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const testUserId = (name: string) => `user:${testId(name)}`;
