import { createPrismaContext } from "../platform/database/prisma/context.ts";
import { readDatabaseEnvironment } from "../platform/config/server-environment.ts";
import { pathToFileURL } from "node:url";
import { RESEARCH_HEARTBEAT_STALE_MS } from "../platform/workers/timing-policy.ts";

export const WORKER_HEALTH_MAX_AGE_MS = RESEARCH_HEARTBEAT_STALE_MS;

export function isHeartbeatFresh(heartbeatAt: Date, now = new Date()): boolean {
  const age = now.getTime() - heartbeatAt.getTime();
  return age >= 0 && age <= WORKER_HEALTH_MAX_AGE_MS;
}

async function main() {
  const runtime = process.argv[2]?.trim();
  const workerId = process.argv[3]?.trim();
  if (!runtime || !workerId) throw new Error("worker healthcheck requires runtime and worker id");

  const database = createPrismaContext(readDatabaseEnvironment());
  try {
    const heartbeat = await database.prisma.runtimeHeartbeat.findUnique({
      where: { runtime_workerId: { runtime, workerId } },
      select: { heartbeatAt: true },
    });
    if (!heartbeat || !isHeartbeatFresh(heartbeat.heartbeatAt)) process.exitCode = 1;
  } finally {
    await database.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
