import { KpiCard } from "../../../../components/dashboard/KpiCard.tsx";
import { SectionCard } from "../../../../components/dashboard/SectionCard.tsx";
import { StatusBadge, type StatusTone } from "../../../../components/states/StatusBadge.tsx";
import type { ResearchRunReport } from "../../../../modules/research/index.ts";

const tone: Record<string, StatusTone> = { PENDING: "neutral", RUNNING: "warning", SUCCEEDED: "success", FAILED: "destructive" };
const label: Record<string, string> = { PENDING: "Ожидает", RUNNING: "Выполняется", SUCCEEDED: "Готово", FAILED: "Ошибка" };
const rubles = (kopecks: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(kopecks / 100);

function safeFailureReason(code: string | null) {
  if (!code) return null;
  if (code.includes("AMBIGUOUS")) return "Результат внешнего запроса неоднозначен. Автоматический повтор заблокирован.";
  if (code.includes("LIMIT") || code.includes("RATE")) return "Внешний сервис временно ограничил запрос.";
  if (code.includes("ACCESS") || code.includes("AUTH")) return "Внешний сервис отклонил доступ.";
  return "Внешний сервис не вернул пригодный результат. Технические детали скрыты.";
}

function safeHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function ResearchRunProgress({ report }: { report: ResearchRunReport }) {
  const completed = report.queries.filter((query) => ["SUCCEEDED", "FAILED"].includes(query.status)).length;
  const failed = report.queries.filter((query) => query.status === "FAILED").length;
  const allocatedCost = report.allocatedCostKopecks ?? report.queries.reduce((sum, query) => sum + (query.allocatedCostKopecks ?? 0), 0);

  return (
    <SectionCard title="Ход выбранного запуска" note={`${completed} из ${report.queries.length} запросов обработано`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Прогресс" value={`${completed}/${report.queries.length}`} tone="primary" />
        <KpiCard label="Ошибки запросов" value={String(failed)} tone={failed ? "soft" : "default"} />
        <KpiCard label="Учтено по оценке" value={rubles(allocatedCost)} />
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Запрос</th><th className="px-3 py-2 font-medium">Статус</th><th className="px-3 py-2 font-medium">Расчётная доля</th><th className="px-3 py-2 font-medium">Пояснение</th></tr></thead>
          <tbody>{report.queries.map((query) => <tr key={query.query} className="border-b border-border last:border-0"><td className="px-3 py-3 font-medium text-foreground">{query.query}</td><td className="px-3 py-3"><StatusBadge label={label[query.status] ?? query.status} tone={tone[query.status] ?? "neutral"} /></td><td className="px-3 py-3">{query.allocatedCostKopecks === null ? "—" : rubles(query.allocatedCostKopecks)}</td><td className="max-w-sm px-3 py-3 text-secondary-text">{safeFailureReason(query.safeErrorCode) ?? (query.status === "SUCCEEDED" ? `${query.evidence.length} свидетельств` : "—")}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Свидетельства по запросам</h3>
        {report.queries.map((query) => (
          <details key={`evidence-${query.query}`} className="rounded border border-border px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              {query.query} · {query.evidence.length} свидетельств
            </summary>
            {query.evidence.length ? (
              <ul className="mt-3 space-y-3">
                {query.evidence.map((evidence, index) => {
                  const url = safeHttpUrl(evidence.url);
                  return <li key={`${evidence.type}-${index}`} className="border-l-2 border-border pl-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2"><StatusBadge label={evidence.type} tone="neutral" />{url ? <a href={url} target="_blank" rel="noreferrer noopener" className="break-all text-link underline-offset-4 hover:underline">{evidence.title ?? url}</a> : <span className="text-foreground">{evidence.title ?? "Источник без публичной ссылки"}</span>}</div>
                    {evidence.snippet ? <p className="mt-1 text-secondary-text">{evidence.snippet}</p> : null}
                  </li>;
                })}
              </ul>
            ) : <p className="mt-3 text-sm text-secondary-text">Свидетельства для этого запроса не сохранены.</p>}
          </details>
        ))}
      </div>
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-foreground">Карта конкурентов</h3>
        {report.competitors.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Домен</th><th className="px-3 py-2 font-medium">Совпавшие запросы</th><th className="px-3 py-2 font-medium">Индекс видимости</th></tr></thead><tbody>{report.competitors.map((competitor) => <tr key={competitor.domain} className="border-b border-border last:border-0"><td className="px-3 py-3 font-medium text-foreground">{competitor.domain}</td><td className="px-3 py-3">{competitor.matchedQueryCount}</td><td className="px-3 py-3">{competitor.visibilityScore.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-secondary-text">Недостаточно сохранённых свидетельств для конкурентной проекции.</p>}
      </div>
    </SectionCard>
  );
}
