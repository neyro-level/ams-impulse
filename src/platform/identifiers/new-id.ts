import { randomBytes } from "node:crypto";

const MAX_UNIX_MILLISECONDS = 0xffffffffffff;

/** Creates an RFC 9562 UUIDv7 for new AMS-owned domain records. */
export function newId(now = Date.now()): string {
  if (!Number.isSafeInteger(now) || now < 0 || now > MAX_UNIX_MILLISECONDS) {
    throw new RangeError("UUIDv7 timestamp is outside the supported range");
  }

  const bytes = randomBytes(16);
  let timestamp = now;
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = timestamp % 256;
    timestamp = Math.floor(timestamp / 256);
  }
  bytes[6] = 0x70 | (bytes[6]! & 0x0f);
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
