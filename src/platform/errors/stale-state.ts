export interface StaleStateMapping {
  code: "STALE_STATE";
  message: string;
  latestVersion?: number;
}

export function isStaleStateCode(code: string) {
  return code === "STALE_STATE" || code.endsWith("_STALE");
}

export function normalizeStaleState<T extends { code: string; message: string }>(mapping: T, error?: unknown): T & { code: string; latestVersion?: number } {
  if (!isStaleStateCode(mapping.code)) return mapping;
  const candidate = error && typeof error === "object" && "latestVersion" in error ? error.latestVersion : undefined;
  const latestVersion = typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate > 0 ? candidate : undefined;
  return { ...mapping, code: "STALE_STATE", ...(latestVersion ? { latestVersion } : {}) };
}
