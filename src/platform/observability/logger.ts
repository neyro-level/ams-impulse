import pino from "pino";
import type { DestinationStream, Logger, LoggerOptions } from "pino";

const REDACTION_PATHS = [
  "password",
  "token",
  "authorization",
  "cookie",
  "cookies",
  "headers.authorization",
  "headers.cookie",
  "headers.set-cookie",
  "headers['x-api-key']",
  "headers['x-auth-token']",
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "req.headers['x-auth-token']",
  "request.headers.authorization",
  "request.headers.cookie",
  "request.headers['x-api-key']",
  "request.headers['x-auth-token']",
  "response.headers.set-cookie",
  "res.headers.set-cookie",
  "db.password",
  "db.connectionString",
  "databaseUrl",
  "DATABASE_URL",
  "env.DATABASE_URL",
  "env.DATABASE_PASSWORD",
  "env.BETTER_AUTH_SECRET",
  "payload.password",
  "payload.token",
  "payload.authorization",
  "payload.cookie",
  "payload.apiKey",
  "payload.secret",
  "payload.email",
  "payload.phone",
  "payload.contact",
  "payload.username",
  "payload.headers.authorization",
  "payload.headers.cookie",
  "payload.headers.set-cookie",
  "payload.headers['x-api-key']",
  "payload.headers['x-auth-token']",
  "payload.user.email",
  "payload.user.phone",
  "payload.user.password",
  "payload.user.token",
  "payload.user.secret",
  "payload.actor.email",
  "payload.actor.phone",
  "payload.actor.token",
  "payload.actor.secret",
  "payload.query",
  "payload.queries",
  "payload.rawQuery",
  "payload.body",
  "payload.rawBody",
  "payload.providerUrl",
  "payload.signedUrl",
  "user.email",
  "user.phone",
  "user.password",
  "user.token",
  "user.secret",
  "actor.email",
  "actor.phone",
  "actor.token",
  "actor.secret",
  "safeErrorBody",
  "rawBody",
  "rawQuery",
  "providerUrl",
  "signedUrl",
  "pii.email",
  "pii.phone",
] as const;

const URL_KEY = /(?:url|uri|endpoint)$/i;
const REDACTED = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  const normalized = key.replaceAll(/[^a-z0-9]/gi, "").toLowerCase();
  return /(?:password|passphrase|token|authorization|cookie|cookies|secret|apikey)$/.test(normalized)
    || [
      "email",
      "phone",
      "username",
      "rawbody",
      "safeerrorbody",
      "providerbody",
      "responsebody",
      "query",
      "queries",
      "researchquery",
    ].includes(normalized);
}

function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return REDACTED;
  }
}

function sanitizeLogValue(value: unknown, key = "", seen = new WeakSet<object>()): unknown {
  if (isSensitiveKey(key)) return REDACTED;
  if (typeof value === "string" && URL_KEY.test(key)) return sanitizeUrl(value);
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    const name = /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value.name) ? value.name : "Error";
    const candidateCode = (value as Error & { code?: unknown }).code;
    const code = typeof candidateCode === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(candidateCode)
      ? candidateCode
      : undefined;
    return code ? { name, code } : { name };
  }
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeLogValue(item, key, seen));

  return Object.fromEntries(
    Object.entries(value).map(([nestedKey, nestedValue]) => [
      nestedKey,
      sanitizeLogValue(nestedValue, nestedKey, seen),
    ]),
  );
}

function createOptions(): LoggerOptions {
  return {
    level: process.env.LOG_LEVEL?.trim() || "info",
    base: undefined,
    messageKey: "message",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      bindings(bindings) {
        return sanitizeLogValue(bindings) as Record<string, unknown>;
      },
      level(label) {
        return { level: label };
      },
      log(object) {
        return sanitizeLogValue(object) as Record<string, unknown>;
      },
    },
    redact: {
      paths: [...REDACTION_PATHS],
      censor: "[REDACTED]",
    },
  };
}

const rootLogger = pino(createOptions());

export function createLogger(
  bindings?: Record<string, string | number | boolean | null>,
  destination?: DestinationStream,
): Logger {
  const logger = destination ? pino(createOptions(), destination) : rootLogger;
  return bindings ? logger.child(sanitizeLogValue(bindings) as Record<string, string | number | boolean | null>) : logger;
}

export function getLogger(bindings?: Record<string, string | number | boolean | null>): Logger {
  return bindings ? rootLogger.child(sanitizeLogValue(bindings) as Record<string, string | number | boolean | null>) : rootLogger;
}
