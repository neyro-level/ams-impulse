import { getWorkerMonitoringService } from "../modules/project-registry/worker.ts";
import type { CreateSyncRunInput } from "../modules/data-ingestion/index.ts";
import { startScheduledTopvisorChecks, syncAllConfiguredCompetitors, syncProjectToDatabase } from "../modules/data-ingestion/worker.ts";
import {
  drainOutbox,
  runOutboxWorkerDaemon,
  runReliabilityRetention,
} from "../modules/platform-operations/worker.ts";
import { getLogger } from "../platform/observability/logger.ts";
import { runNextResearchJob, runResearchWorkerDaemon } from "../modules/research/worker.ts";
import { runWorkerProcess } from "./process-lifecycle.ts";

const command = process.argv[2] ?? null;
const argument = process.argv[3] ?? null;
const requestedTrigger = process.argv[4] ?? "manual";
const allowedTriggers: CreateSyncRunInput["trigger"][] = [
  "daily",
  "manual",
  "preflight",
  "backfill",
];
const logger = getLogger({ runtime: "worker", entrypoint: "main" });

async function main() {
  if (command === "module-smoke") {
    logger.info({ event: "worker_module_smoke_ok" }, "worker module smoke passed");
    return;
  }

  if (command === "outbox-drain") {
    const result = await drainOutbox({ workerId: argument ?? "seo-monitor-worker" });
    logger.info({ event: "outbox_drain_finished", ...result }, "outbox drain finished");
    if (result.failed > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "outbox-retention") {
    const result = await runReliabilityRetention();
    logger.info({ event: "outbox_retention_finished", ...result }, "outbox retention finished");
    return;
  }

  if (command === "research-run") {
    const result = await runNextResearchJob(process.env);
    logger.info({ event: "research_run_finished", ...result }, "research run finished");
    if (result.status === "failed") process.exitCode = 1;
    return;
  }

  if (command === "outbox-daemon") {
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    try {
      await runOutboxWorkerDaemon({
        workerId: argument ?? process.env.OUTBOX_WORKER_ID?.trim() ?? "seo-monitor-outbox",
        pollDelayMs: Number(process.env.OUTBOX_POLL_DELAY_MS ?? 5_000),
        signal: controller.signal,
        onCycle: (result) => logger.info({ event: "outbox_drain_finished", ...result }, "outbox drain finished"),
      });
      logger.info({ event: "outbox_worker_stopped" }, "outbox worker stopped");
    } finally {
      process.off("SIGTERM", stop);
      process.off("SIGINT", stop);
    }
    return;
  }

  if (command === "research-daemon") {
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    try {
      await runResearchWorkerDaemon(process.env, controller.signal);
      logger.info({ event: "research_worker_stopped" }, "research worker stopped");
    } finally {
      process.off("SIGTERM", stop);
      process.off("SIGINT", stop);
    }
    return;
  }

  if (command === "projects-sync") {
    const trigger = (argument ?? "daily") as CreateSyncRunInput["trigger"];
    if (!allowedTriggers.includes(trigger)) {
      throw new Error(`Unsupported sync trigger: ${trigger}`);
    }
    const projectSlugs = await getWorkerMonitoringService().listActiveProjectSlugs();
    const results = [];
    for (const projectSlug of projectSlugs) {
      results.push(await syncProjectToDatabase({ projectSlug, trigger, env: process.env }));
    }
    logger.info(
      {
        event: "active_projects_sync_finished",
        projectsProcessed: results.length,
        projectsFailed: results.filter((result) => result.status === "failed").length,
      },
      "active projects sync finished",
    );
    if (results.some((result) => result.status === "failed")) process.exitCode = 1;
    return;
  }

  if (command === "competitors-sync") {
    const results = await syncAllConfiguredCompetitors(process.env);
    logger.info({ event: "competitors_sync_finished", sitesProcessed: results.length, sitesFailed: results.filter((item) => !item.ok).length }, "competitors sync finished");
    if (results.some((item) => !item.ok)) process.exitCode = 1;
    return;
  }

  if (command === "topvisor-checks") {
    const results = await startScheduledTopvisorChecks(process.env);
    logger.info({ event: "topvisor_checks_finished", sitesProcessed: results.length, sitesFailed: results.filter((item) => !item.ok).length }, "Topvisor checks finished");
    if (results.some((item) => !item.ok)) process.exitCode = 1;
    return;
  }

  if (command !== "project-sync" || !argument) {
    throw new Error(
      "Usage: worker projects-sync [trigger] | topvisor-checks | competitors-sync | project-sync <project-slug> [trigger] | outbox-drain [worker-id] | outbox-daemon [worker-id] | outbox-retention | research-run | research-daemon",
    );
  }
  if (!allowedTriggers.includes(requestedTrigger as CreateSyncRunInput["trigger"])) {
    throw new Error(`Unsupported sync trigger: ${requestedTrigger}`);
  }

  const result = await syncProjectToDatabase({
    projectSlug: argument,
    trigger: requestedTrigger as CreateSyncRunInput["trigger"],
    env: process.env,
  });
  logger.info({ event: "project_sync_finished", ...result }, "project sync finished");

  if (result.status === "failed") {
    process.exitCode = 1;
  }
}

runWorkerProcess(main).catch((error) => {
  logger.error({ err: error }, "worker failed");
  process.exitCode = 1;
});
