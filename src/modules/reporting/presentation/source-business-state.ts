import type { SiteReportSnapshot } from "../../../shared/schemas/report.ts";

type ReportSource = NonNullable<SiteReportSnapshot["sources"][keyof SiteReportSnapshot["sources"]]>;

export type SourceBusinessState = {
  label: string;
  meaning: string;
  action: string | null;
};

const states: Record<ReportSource["status"], SourceBusinessState> = {
  success: {
    label: "Актуален",
    meaning: "Источник успешно обновил данные для отчёта.",
    action: null,
  },
  partial: {
    label: "Частичные данные",
    meaning: "Источник вернул не все показатели. Доступная часть сохранена без подмены пропусков нулями.",
    action: "Учитывайте предупреждение при выводах; администратор проверит следующий цикл обновления.",
  },
  failed: {
    label: "Ошибка обновления",
    meaning: "Источник не обновил данные. В отчёте может использоваться последняя успешно сохранённая версия.",
    action: "Администратору проверить подключение; до обновления не считать эти показатели текущими.",
  },
  not_configured: {
    label: "Не подключён",
    meaning: "Этот источник пока не участвует в отчёте.",
    action: "Если данные нужны для решения, запросите подключение у администратора.",
  },
  access_denied: {
    label: "Нет доступа",
    meaning: "Внешний сервис отклонил действующий доступ, поэтому новые данные не получены.",
    action: "Администратору восстановить или переподключить доступ к источнику.",
  },
  quota_limited: {
    label: "Лимит источника",
    meaning: "Внешний сервис временно ограничил обновление. Это не означает нулевой результат.",
    action: "Дождитесь следующего цикла; при повторении администратор проверит лимиты подключения.",
  },
  stale: {
    label: "Данные устарели",
    meaning: "Последнее успешное обновление старше допустимого интервала.",
    action: "Не принимайте решение как по текущим данным; администратору проверить обновление.",
  },
};

export function getSourceBusinessState(status: ReportSource["status"]): SourceBusinessState {
  return states[status];
}
