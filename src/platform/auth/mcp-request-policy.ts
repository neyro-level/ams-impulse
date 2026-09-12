import "server-only";

import { createHash } from "node:crypto";
import { getPrismaClient } from "../database/prisma/client.ts";

const MCP_RATE_WINDOW_MS = 60_000;
const MCP_SUBJECT_REQUEST_LIMIT = 60;

export function isAllowedMcpBrowserRequest(request: Request, resource: string) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    if (new URL(origin).origin !== new URL(resource).origin) return false;
  } catch {
    return false;
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

export function getMcpSubjectRateWindow(subject: string, now = new Date()) {
  const subjectHash = createHash("sha256").update(subject, "utf8").digest("hex");
  const windowStartedAt = new Date(
    Math.floor(now.getTime() / MCP_RATE_WINDOW_MS) * MCP_RATE_WINDOW_MS,
  );
  return {
    key: `${subjectHash}:${windowStartedAt.getTime()}`,
    subjectHash,
    windowStartedAt,
    expiresAt: new Date(windowStartedAt.getTime() + MCP_RATE_WINDOW_MS * 2),
  };
}

export async function consumeMcpSubjectRateLimit(subject: string, now = new Date()) {
  const window = getMcpSubjectRateWindow(subject, now);
  const record = await getPrismaClient().mcpSubjectRateLimit.upsert({
    where: { key: window.key },
    create: { ...window, requestCount: 1 },
    update: { requestCount: { increment: 1 } },
    select: { requestCount: true },
  });
  if (record.requestCount === 1) {
    await getPrismaClient().mcpSubjectRateLimit.deleteMany({
      where: { expiresAt: { lt: now } },
    });
  }
  return {
    allowed: record.requestCount <= MCP_SUBJECT_REQUEST_LIMIT,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((window.windowStartedAt.getTime() + MCP_RATE_WINDOW_MS - now.getTime()) / 1_000),
    ),
  };
}
