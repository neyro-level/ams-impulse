import type { JobWithMetadata, PgBoss } from "pg-boss";
import { getPgBoss, stopPgBoss } from "../platform-operations/queue.ts";
import { researchRunJobSchema, RESEARCH_RUN_QUEUE, type ResearchRunJob } from "./domain/research-queue.ts";
import { ResearchExecutionService } from "./application/research-execution-service.ts";
import { listStaleResearchRunScopes, PrismaResearchExecutionRepository } from "./infrastructure/prisma-research-execution-repository.ts";
import { PrismaResearchLifecyclePublisher } from "./infrastructure/prisma-research-lifecycle-publisher.ts";
import { XmlRiverClient } from "./infrastructure/xmlriver-client.ts";
import { setTimeout as sleep } from "node:timers/promises";
import { recordRuntimeHeartbeat, RESEARCH_WORKER_RUNTIME, RUNTIME_HEARTBEAT_WRITE_INTERVAL_MS } from "../platform-operations/index.ts";
import { RESEARCH_JOB_MAX_LOCK_DEFERRALS, RESEARCH_STALE_RUN_AFTER_MS, RESEARCH_WORKER_POLL_DELAY_MS } from "../../platform/workers/timing-policy.ts";
import { closePrismaClient } from "../../platform/database/prisma/client.ts";
import { getLogger } from "../../platform/observability/logger.ts";

export { ResearchExecutionService } from "./application/research-execution-service.ts";
export { PrismaResearchExecutionRepository } from "./infrastructure/prisma-research-execution-repository.ts";
export { XmlRiverClient, parseXmlRiverSerp, parseXmlRiverSuggestions, parseXmlRiverWordstat } from "./infrastructure/xmlriver-client.ts";

type QueueClient = Pick<PgBoss, "fetch" | "complete" | "send">;
type ExecutionFactory = (job: ResearchRunJob) => Promise<ResearchExecutionService>;

export async function recoverStaleResearchRunsWithDependencies(
  startedBefore: Date,
  listScopes: (startedBefore: Date) => Promise<Array<{ organizationId: string; projectId: string }>>,
  recoverScope: (scope: { organizationId: string; projectId: string }, startedBefore: Date) => Promise<number>,
) {
  const scopes = await listScopes(startedBefore);
  let recovered = 0;
  for (const scope of scopes) recovered += await recoverScope(scope, startedBefore);
  return recovered;
}

export async function runNextResearchJobWithDependencies(queue: QueueClient, createExecution: ExecutionFactory) {
  const jobs = await queue.fetch<ResearchRunJob>(RESEARCH_RUN_QUEUE, { batchSize: 1, includeMetadata: true });
  const job = jobs[0] as JobWithMetadata<ResearchRunJob> | undefined;
  if (!job) return { handled: 0, status: "idle" as const };
  const parsed = researchRunJobSchema.safeParse(job.data);
  if (!parsed.success) {
    await queue.complete(RESEARCH_RUN_QUEUE, job.id, { status: "ignored", code: "INVALID_RESEARCH_JOB" });
    return { handled: 1, status: "ignored" as const };
  }
  const logger = getLogger({
    runtime: "worker",
    module: "research",
    correlationId: parsed.data.correlationId,
    runId: parsed.data.runId,
  });
  logger.info({ event: "research_job_started" }, "research job started");
  const execution = await createExecution(parsed.data);
  const result = await execution.execute(parsed.data.runId, parsed.data.correlationId);
  if (result.status === "deferred") {
    // Lock contention is a normal disposition, not a failed paid execution.
    // The research queue has retryLimit=0, so enqueue at most one bounded
    // future delivery before completing the current one. Exhaustion leaves the
    // paid run QUEUED for explicit recovery instead of manufacturing a failure.
    if (parsed.data.deferralCount >= RESEARCH_JOB_MAX_LOCK_DEFERRALS) {
      await queue.complete(RESEARCH_RUN_QUEUE, job.id, { status: "deferred-exhausted", code: "RUN_LOCK_DEFERRAL_EXHAUSTED" });
      logger.warn({ event: "research_job_deferral_exhausted", deferralCount: parsed.data.deferralCount }, "research job lock deferral limit exhausted");
      return { handled: 1, status: "deferred-exhausted" as const };
    }
    await queue.send(RESEARCH_RUN_QUEUE, { ...parsed.data, deferralCount: parsed.data.deferralCount + 1 }, { startAfter: 1 });
    await queue.complete(RESEARCH_RUN_QUEUE, job.id, { status: "deferred", code: "RUN_LOCK_BUSY" });
    logger.info({ event: "research_job_deferred", status: result.status }, "research job deferred");
    return { handled: 1, ...result };
  }
  await queue.complete(RESEARCH_RUN_QUEUE, job.id, result);
  logger.info({ event: "research_job_finished", status: result.status }, "research job finished");
  return { handled: 1, ...result };
}

export async function runNextResearchJob(env: Record<string, string | undefined> = process.env) {
  const user = env.XMLRIVER_USER?.trim(); const key = env.XMLRIVER_KEY?.trim();
  if (!user || !key) throw new Error("XMLRIVER_CONFIGURATION_MISSING");
  const boss = await getPgBoss();
  try {
    const staleBefore = new Date(Date.now() - RESEARCH_STALE_RUN_AFTER_MS);
    await recoverStaleResearchRunsWithDependencies(
      staleBefore,
      listStaleResearchRunScopes,
      (scope, cutoff) => new PrismaResearchExecutionRepository(scope).failStaleRuns(cutoff),
    );
    return await runNextResearchJobWithDependencies(
      boss,
      async (job) => {
        const repository = new PrismaResearchExecutionRepository({
          organizationId: job.toolsOrganizationId,
          projectId: job.toolsProjectId,
        });
        return new ResearchExecutionService(repository, new XmlRiverClient({ user, key }), undefined, new PrismaResearchLifecyclePublisher());
      },
    );
  } finally {
    await stopPgBoss();
  }
}

export async function runResearchWorkerDaemon(
  env: Record<string, string | undefined> = process.env,
  signal?: AbortSignal,
) {
  const user = env.XMLRIVER_USER?.trim(); const key = env.XMLRIVER_KEY?.trim();
  if (!user || !key) throw new Error("XMLRIVER_CONFIGURATION_MISSING");
  const pollDelayMs = RESEARCH_WORKER_POLL_DELAY_MS;
  const workerId = env.RESEARCH_WORKER_ID?.trim() || "seo-monitor-research";
  if (!Number.isInteger(pollDelayMs) || pollDelayMs < 100 || pollDelayMs > 60_000) {
    throw new Error("RESEARCH_POLL_DELAY_MS_INVALID");
  }

  const boss = await getPgBoss();
  const heartbeat = () => recordRuntimeHeartbeat({ runtime: RESEARCH_WORKER_RUNTIME, workerId });
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  try {
    await heartbeat();
    heartbeatTimer = setInterval(() => void heartbeat(), RUNTIME_HEARTBEAT_WRITE_INTERVAL_MS);
    while (!signal?.aborted) {
      const staleBefore = new Date(Date.now() - RESEARCH_STALE_RUN_AFTER_MS);
      await recoverStaleResearchRunsWithDependencies(
        staleBefore,
        listStaleResearchRunScopes,
        (scope, cutoff) => new PrismaResearchExecutionRepository(scope).failStaleRuns(cutoff),
      );
      const result = await runNextResearchJobWithDependencies(
        boss,
        async (job) => {
          const repository = new PrismaResearchExecutionRepository({
            organizationId: job.toolsOrganizationId,
            projectId: job.toolsProjectId,
          });
          return new ResearchExecutionService(repository, new XmlRiverClient({ user, key }), undefined, new PrismaResearchLifecyclePublisher());
        },
      );
      if (result.status === "idle") {
        try {
          await sleep(pollDelayMs, undefined, { signal });
        } catch (error) {
          if (!signal?.aborted) throw error;
        }
      }
    }
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    try {
      await stopPgBoss();
    } finally {
      await closePrismaClient();
    }
  }
}
