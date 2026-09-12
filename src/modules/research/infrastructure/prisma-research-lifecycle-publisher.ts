import { getPrismaClient } from "../../../platform/database/prisma/client.ts";
import type { ResearchLifecycleEvent, ResearchLifecycleNotification, ResearchLifecyclePublisher } from "../application/ports/research-lifecycle-publisher.ts";

const presentation: Record<ResearchLifecycleEvent, { severity: "INFO" | "SUCCESS" | "WARNING" | "ERROR"; title: string; message: string }> = {
  started: { severity: "INFO", title: "Исследование запущено", message: "Платная обработка подтверждённого набора запросов началась." },
  completed: { severity: "SUCCESS", title: "Исследование завершено", message: "Все запросы обработаны, доказательства и конкурентная проекция готовы." },
  partial: { severity: "WARNING", title: "Исследование завершено частично", message: "Часть запросов не дала результата; сохранённые доказательства доступны в кабинете." },
  failed: { severity: "ERROR", title: "Исследование не завершено", message: "Запуск остановлен безопасно. Повтор требует новой оценки и подтверждения." },
  action_required: { severity: "WARNING", title: "Исследование требует внимания", message: "Откройте запуск, проверьте статусы запросов и решите, нужен ли новый подтверждённый запуск." },
};

export class PrismaResearchLifecyclePublisher implements ResearchLifecyclePublisher {
  async publish(input: ResearchLifecycleNotification) {
    const content = presentation[input.event];
    const query = new URLSearchParams({ organizationId: input.organizationId, projectId: input.projectId, runId: input.runId });
    await getPrismaClient().notification.upsert({
      where: { dedupKey: `research:${input.runId}:${input.event}` },
      update: { severity: content.severity, title: content.title, message: content.message, occurredAt: new Date() },
      create: {
        category: "REPORT",
        severity: content.severity,
        visibility: "PLATFORM_TEAM",
        title: content.title,
        message: content.message,
        route: `/tools/research/${encodeURIComponent(input.researchId)}?${query.toString()}`,
        sourceType: "ResearchRun",
        sourceId: input.runId,
        dedupKey: `research:${input.runId}:${input.event}`,
        occurredAt: new Date(),
      },
    });
  }
}
