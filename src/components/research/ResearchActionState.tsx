import Link from "next/link";

export type ResearchUiState =
  | "STALE_STATE"
  | "RESEARCH_NOT_EDITABLE"
  | "DAILY_LIMIT"
  | "MONTHLY_LIMIT"
  | "PRICING_UNAVAILABLE"
  | "PARTIAL"
  | "FAILED";

const content: Record<ResearchUiState, { title: string; description: string; action: string }> = {
  STALE_STATE: {
    title: "Исследование уже изменилось",
    description: "Кто-то сохранил более новую версию. Обновите страницу, проверьте изменения и повторите действие.",
    action: "Загрузить актуальную версию",
  },
  RESEARCH_NOT_EDITABLE: {
    title: "Редактирование временно недоступно",
    description: "Исследование выполняется или уже поставлено в очередь. Дождитесь завершения текущего запуска.",
    action: "Проверить состояние",
  },
  DAILY_LIMIT: {
    title: "Дневной лимит исчерпан",
    description: "Новый платный запуск превысит дневной бюджет проекта. Вернитесь после обновления лимита или уменьшите число запросов.",
    action: "Изменить исследование",
  },
  MONTHLY_LIMIT: {
    title: "Месячный лимит исчерпан",
    description: "Новый платный запуск превысит месячный бюджет проекта. Согласуйте бюджет или дождитесь следующего периода.",
    action: "Вернуться к исследованию",
  },
  PRICING_UNAVAILABLE: {
    title: "Стоимость пока не рассчитана",
    description: "Тариф провайдера временно недоступен. Платный запуск не создан; повторите расчёт позже.",
    action: "Повторить расчёт",
  },
  PARTIAL: {
    title: "Получена только часть данных",
    description: "Некоторые запросы не вернули результат. Доступные данные сохранены — проверьте историю запуска перед повтором.",
    action: "Открыть историю запуска",
  },
  FAILED: {
    title: "Запуск завершился с ошибкой",
    description: "Платформа сохранила безопасный статус ошибки. Проверьте последнюю попытку и запустите исследование повторно, когда причина устранена.",
    action: "Проверить исследование",
  },
};

export function ResearchActionState({ state, cleanHref }: { state: ResearchUiState; cleanHref: string }) {
  const item = content[state];
  const destructive = state === "FAILED";
  return (
    <section
      role="status"
      aria-live="polite"
      className={`rounded-[var(--radius-panel)] border p-4 ${destructive ? "border-[var(--destructive)]/25 bg-[var(--destructive-soft)]" : "border-[var(--warning)]/25 bg-[var(--warning-soft)]"}`}
    >
      <h2 className={`font-semibold ${destructive ? "text-app-destructive" : "text-app-warning"}`}>{item.title}</h2>
      <p className="mt-1 text-sm text-app-secondary">{item.description}</p>
      <Link href={cleanHref} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-app-primary">{item.action}</Link>
    </section>
  );
}
