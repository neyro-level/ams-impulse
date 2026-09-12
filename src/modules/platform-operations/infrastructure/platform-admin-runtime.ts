import { getPrismaClient } from "../../../platform/database/prisma/client.ts";
import type { PrincipalContext } from "../../../platform/authorization/principal.ts";
import { ReliabilityService } from "../application/reliability-service.ts";
import { PrismaReliabilityRepository } from "./prisma-reliability-repository.ts";
import {
  PlatformOperationsAdminError,
  requestProjectSyncInputSchema,
  type OperationListResult,
  type RequestProjectSyncInput,
} from "../domain/platform-admin.ts";
import type { PlatformAdminListQuery } from "../../platform-admin/contracts.ts";
import { readOperationalProof } from "./operational-proof.ts";
import { getOperationalReadiness } from "./readiness-runtime.ts";

const reliabilityService = new ReliabilityService(new PrismaReliabilityRepository());

const sourceLabels: Record<string, string> = {
  YANDEX_WEBMASTER: "Яндекс.Вебмастер",
  YANDEX_METRIKA: "Яндекс.Метрика",
  TOPVISOR: "Topvisor",
};

const topicLabels: Record<string, string> = {
  "project.sync.requested": "Обновление данных проекта",
  "providers.sync.requested": "Обновление данных источников",
  "outbox.retention.requested": "Очистка завершённых заданий",
};

function requirePlatformAdmin(principal: PrincipalContext) {
  if (principal.kind !== "platform-admin") {
    throw new PlatformOperationsAdminError("PLATFORM_OPERATIONS_ADMIN_ACCESS_DENIED");
  }
  return {
    actorId: principal.userId,
    correlationId: principal.correlationId,
  };
}

export async function listOperations(
  principal: PrincipalContext,
  query: PlatformAdminListQuery,
): Promise<OperationListResult> {
  requirePlatformAdmin(principal);
  const prisma = getPrismaClient();
  const [[failedJobs, deadLetters, sourceFailures], readiness, backupProof, liveProof] = await Promise.all([
    prisma.$transaction([
      prisma.jobRun.findMany({
        where: { status: "FAILED" },
        orderBy: { startedAt: "desc" },
        take: 100,
        select: {
          id: true,
          jobType: true,
          attempt: true,
          safeErrorCode: true,
          correlationId: true,
          finishedAt: true,
          startedAt: true,
        },
      }),
      prisma.outboxEvent.findMany({
        where: { status: "DEAD_LETTER" },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          topic: true,
          attempts: true,
          lastErrorCode: true,
          correlationId: true,
          updatedAt: true,
        },
      }),
      prisma.sourceRun.findMany({
        where: { status: { in: ["FAILED", "ACCESS_DENIED", "QUOTA_LIMITED", "STALE"] } },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          provider: true,
          status: true,
          safeErrorCode: true,
          correlationId: true,
          updatedAt: true,
          site: { select: { name: true } },
        },
      }),
    ]),
    getOperationalReadiness(),
    readOperationalProof("backup"),
    readOperationalProof("live"),
  ]);

  const rows = [
    ...failedJobs.map((item) => ({
      id: item.id,
      kind: "failed-job" as const,
      primary: `Сбой фонового задания: ${item.jobType}`,
      secondary: `Код: ${item.safeErrorCode ?? "JOB_FAILED"} · попытка ${item.attempt} · correlation ${item.correlationId}`,
      status: "Требует разбора",
      updatedAt: (item.finishedAt ?? item.startedAt).toISOString(),
    })),
    ...deadLetters.map((item) => ({
      id: item.id,
      kind: "dead-letter" as const,
      primary: `Остановленное задание: ${topicLabels[item.topic] ?? item.topic}`,
      secondary: `Код: ${item.lastErrorCode ?? "DEAD_LETTER"} · попыток ${item.attempts} · correlation ${item.correlationId}`,
      status: "Требует действия",
      updatedAt: item.updatedAt.toISOString(),
    })),
    ...sourceFailures.map((item) => ({
      id: item.id,
      kind: item.status === "STALE" ? "stale-source" as const : "integration-failure" as const,
      primary: `${item.status === "STALE" ? "Устаревший" : "Сбойный"} источник: ${item.site.name}`,
      secondary: `${sourceLabels[item.provider] ?? item.provider} · код: ${item.safeErrorCode ?? item.status} · correlation ${item.correlationId}`,
      status: item.status === "STALE" ? "Данные устарели" : "Требует разбора",
      updatedAt: item.updatedAt.toISOString(),
    })),
    ...(readiness.worker.status === "healthy" ? [] : [{
      id: "worker-heartbeat",
      kind: "worker" as const,
      primary: "Worker не подтверждает работу",
      secondary: readiness.worker.lastHeartbeatAt
        ? "Последний heartbeat получен, но устарел"
        : "Heartbeat ещё не зафиксирован",
      status: "Требует действия",
      updatedAt: readiness.worker.lastHeartbeatAt,
    }]),
    {
      id: "backup-proof",
      kind: "backup-proof" as const,
      primary: "Последнее подтверждение резервной копии",
      secondary: backupProof
        ? `Release ${backupProof.releaseSha.slice(0, 12)}`
        : "Подтверждение не найдено — проверьте backup runbook",
      status: backupProof ? "Подтверждено" : "Требует действия",
      updatedAt: backupProof?.occurredAt ?? null,
    },
    {
      id: "live-proof",
      kind: "live-proof" as const,
      primary: "Последнее подтверждение production live/readiness",
      secondary: liveProof
        ? `Release ${liveProof.releaseSha.slice(0, 12)}`
        : "Подтверждение не найдено — проверьте release runbook",
      status: liveProof ? "Подтверждено" : "Требует действия",
      updatedAt: liveProof?.occurredAt ?? null,
    },
  ];

  const search = query.search.toLocaleLowerCase("ru");
  const filtered = rows
    .filter((item) =>
      !search
        || `${item.primary} ${item.secondary} ${item.status}`
          .toLocaleLowerCase("ru")
          .includes(search),
    )
    .sort((left, right) => {
      const field = query.sort === "name" ? "primary" : query.sort === "status" ? "status" : "updatedAt";
      const comparison = (left[field] ?? "").localeCompare(right[field] ?? "", "ru");
      return query.direction === "asc" ? comparison : -comparison;
    });

  const start = (query.page - 1) * query.pageSize;
  return {
    items: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
    incidentCount: rows.filter((item) => item.status !== "Подтверждено").length,
  };
}

export async function requestProjectSync(
  principal: PrincipalContext,
  rawInput: RequestProjectSyncInput,
) {
  const actor = requirePlatformAdmin(principal);
  const input = requestProjectSyncInputSchema.parse(rawInput);
  const project = await getPrismaClient().project.findUnique({
    where: { slug: input.projectSlug },
    select: { id: true, slug: true, organizationId: true },
  });
  if (!project) {
    throw new PlatformOperationsAdminError("PROJECT_SYNC_NOT_FOUND");
  }
  const result = await reliabilityService.enqueue({
    organizationId: project.organizationId,
    organizationScope: project.organizationId,
    idempotencyScope: "platform-admin.project-sync",
    idempotencyKey: input.idempotencyKey,
    topic: "project.sync.requested",
    payload: { projectSlug: project.slug, trigger: "manual" },
    actorType: "USER",
    actorId: actor.actorId,
    action: "project.sync.request",
    entityType: "Project",
    entityId: project.id,
    source: "platform-admin",
    correlationId: actor.correlationId,
  });
  return { outboxEventId: result.outboxEventId, duplicate: result.duplicate };
}
