import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { PrincipalContext } from "../../../platform/authorization/principal.ts";
import type { ResearchService } from "../application/research-service.ts";
import type { ResearchReportService } from "../application/research-report-service.ts";
import { RESEARCH_MAX_QUERY_COUNT } from "../domain/research.ts";
import { normalizeStaleState } from "../../../platform/errors/stale-state.ts";
import { createSafeErrorEnvelope } from "../../../platform/errors/safe-error-envelope.ts";

const ref = {
  organizationId: z.string().min(1).max(128),
  projectId: z.string().min(1).max(128),
  researchId: z.string().min(1).max(128),
};

function success(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value as Record<string, unknown> };
}

async function safely(operation: () => Promise<unknown>, correlationId: string) {
  try {
    return success(await operation());
  } catch (error) {
    const domainCode = error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "RESEARCH_OPERATION_FAILED";
    const mapped = normalizeStaleState({ code: domainCode, message: "Не удалось выполнить операцию исследования." }, error);
    return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(createSafeErrorEnvelope({ ...mapped, correlationId }, error)) }] };
  }
}

export function createResearchMcpServer(input: { principal: PrincipalContext; research: ResearchService; reports: ResearchReportService }) {
  const server = new McpServer({ name: "ams-impulse-research", version: "1.1.0" });

  server.registerTool("research_list", {
    description: "Получить доступные исследования явно указанного проекта Инструментов.",
    inputSchema: z.object({ organizationId: ref.organizationId, projectId: ref.projectId }),
  }, (args) => safely(() => input.research.list(input.principal, args.organizationId, args.projectId), input.principal.correlationId));

  server.registerTool("research_get", {
    description: "Получить черновик, версию и запросы исследования в доступном проекте.",
    inputSchema: z.object(ref),
  }, (args) => safely(() => input.research.get(input.principal, args), input.principal.correlationId));

  server.registerTool("research_create_draft", {
    description: "Создать черновик исследования в явно доступном проекте Инструментов.",
    inputSchema: z.object({ organizationId: ref.organizationId, projectId: ref.projectId, title: z.string().min(2).max(180), brief: z.string().max(5000).default(""), queries: z.array(z.string().min(2).max(500)).min(1).max(RESEARCH_MAX_QUERY_COUNT) }),
  }, (args) => safely(() => input.research.create(input.principal, args), input.principal.correlationId));

  server.registerTool("research_update_draft", {
    description: "Обновить редактируемое исследование с optimistic version check.",
    inputSchema: z.object({ ...ref, title: z.string().min(2).max(180), brief: z.string().max(5000).default(""), queries: z.array(z.string().min(2).max(500)).min(1).max(RESEARCH_MAX_QUERY_COUNT), version: z.number().int().positive() }),
  }, (args) => safely(() => input.research.update(input.principal, args), input.principal.correlationId));

  server.registerTool("research_archive", {
    description: "Архивировать редактируемое исследование по его текущей версии.",
    inputSchema: z.object({ ...ref, version: z.number().int().positive() }),
  }, ({ version, ...args }) => safely(() => input.research.archive(input.principal, args, version), input.principal.correlationId));

  server.registerTool("research_list_runs", {
    description: "Получить историю и безопасный прогресс запусков исследования.",
    inputSchema: z.object(ref),
  }, (args) => safely(() => input.research.listRuns(input.principal, args), input.principal.correlationId));

  server.registerTool("research_estimate_run", {
    description: "Рассчитать серверную стоимость запуска без платных обращений к провайдеру.",
    inputSchema: z.object(ref),
  }, (args) => safely(() => input.research.estimateRun(input.principal, args), input.principal.correlationId));

  server.registerTool("research_confirm_and_run", {
    description: "Подтвердить сохранённую стоимость и поставить исследование в очередь.",
    inputSchema: z.object({ ...ref, runId: z.string().min(1).max(128), expectedEstimatedCostKopecks: z.number().int().min(0) }),
  }, (args) => safely(() => input.research.confirmAndQueue(input.principal, args), input.principal.correlationId));

  server.registerTool("research_cancel_run", {
    description: "Безопасно отменить только ожидающий подтверждения или ещё не взятый worker запуск.",
    inputSchema: z.object({ ...ref, runId: z.string().min(1).max(128) }),
  }, (args) => safely(() => input.research.cancelRun(input.principal, args), input.principal.correlationId));

  server.registerTool("research_get_run", {
    description: "Получить статус, доказательства и карту конкурентов по запуску.",
    inputSchema: z.object({ ...ref, runId: z.string().min(1).max(128) }),
  }, (args) => safely(() => input.reports.getRun(input.principal, args), input.principal.correlationId));

  server.registerTool("research_create_export", {
    description: "Создать приватный CSV-экспорт завершённого исследования.",
    inputSchema: z.object({ ...ref, runId: z.string().min(1).max(128), idempotencyKey: z.string().min(8).max(128) }),
  }, (args) => safely(() => input.reports.createExport(input.principal, args), input.principal.correlationId));

  server.registerTool("research_get_export_download", {
    description: "Получить одноразовую короткоживущую ссылку на доступный CSV-экспорт.",
    inputSchema: z.object({ ...ref, exportId: z.string().min(1).max(128) }),
  }, (args) => safely(() => input.reports.createDownload(input.principal, args), input.principal.correlationId));

  return server;
}
