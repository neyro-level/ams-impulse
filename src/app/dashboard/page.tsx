export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { KpiCard } from "../../components/dashboard/KpiCard.tsx";
import { PageHeader } from "../../components/dashboard/PageHeader.tsx";
import { SectionCard } from "../../components/dashboard/SectionCard.tsx";
import {
  getAuthorizationService,
  getCurrentCabinetRedirect,
  getCurrentPrincipalState,
} from "../../modules/identity-access/server.ts";
import { getNotificationSummary } from "../../modules/notifications/server.ts";
import { buildAnalystOverview } from "../../modules/project-registry/presentation.ts";
import { hasPermission, type PrincipalContext } from "../../platform/authorization/principal.ts";

function canReadOperationalEvents(principal: PrincipalContext) {
  return principal.kind === "platform-admin" ||
    principal.kind === "platform-analyst" ||
    (principal.kind === "identity-user" && principal.systemRole === "ANALYST");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const cabinetRedirect = await getCurrentCabinetRedirect();
  if (cabinetRedirect) redirect(cabinetRedirect);
  const state = await getCurrentPrincipalState();
  if (!state) redirect("/?login=1");
  const products = await getAuthorizationService().listAccessibleProducts(state.principal);
  if (!products.includes("seo-monitor") && products.includes("tools")) redirect("/tools/research/");
  if (!products.includes("seo-monitor")) notFound();

  const [overview, eventSummary] = await Promise.all([
    buildAnalystOverview(state.principal),
    canReadOperationalEvents(state.principal)
      ? getNotificationSummary(state.principal)
      : Promise.resolve(null),
  ]);
  const projectIssues = overview.projectCards.filter((project) =>
    project.status === "DISABLED" ||
    project.totalSites === 0 ||
    project.readySites < project.totalSites,
  );
  const sourceIssues = eventSummary?.items.filter((item) =>
    (item.severity === "ERROR" || item.severity === "WARNING") &&
    (item.category === "INTEGRATION" || item.category === "DATA_FRESHNESS" || item.category === "QUEUE"),
  ) ?? [];
  const attentionCount = projectIssues.length + sourceIssues.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Рабочая сводка"
        description="Сначала — отклонения и проекты, которым нужен следующий шаг."
        actions={
          hasPermission(state.principal, "project:read:any") ? (
            <Link
              href="/analyst/"
              className="inline-flex min-h-10 items-center rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-app-primary-foreground"
            >
              Все проекты
            </Link>
          ) : null
        }
      />

      <SectionCard
        title="Требует внимания"
        note={attentionCount > 0 ? `${attentionCount} сигналов` : "Критичных сигналов нет"}
      >
        {attentionCount === 0 ? (
          <div className="rounded-[var(--radius-panel)] border border-[var(--success)]/20 bg-[var(--success-soft)] p-4">
            <p className="font-semibold text-app-success">Рабочих отклонений не обнаружено</p>
            <p className="mt-1 text-sm text-app-secondary">
              {eventSummary
                ? "Все доступные проекты настроены, а свежих предупреждений по источникам нет."
                : "Все доступные проекты настроены и готовы к следующему обновлению отчётов."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)] rounded-[var(--radius-panel)] border border-[var(--border)]">
            {sourceIssues.slice(0, 4).map((item) => (
              <article key={item.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="font-semibold text-app-foreground">{item.title}</p>
                  <p className="mt-1 text-sm text-app-secondary">{item.message}</p>
                  <p className="mt-2 text-xs text-app-muted-foreground">{item.projectName ?? item.siteName ?? "Система"} · {formatDate(item.occurredAt)}</p>
                </div>
                <Link href={item.route ?? "/notifications/"} className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm font-semibold text-app-foreground">
                  Проверить
                </Link>
              </article>
            ))}
            {projectIssues.slice(0, Math.max(0, 6 - sourceIssues.length)).map((project) => {
              const missingSites = Math.max(0, project.totalSites - project.readySites);
              const explanation = project.status === "DISABLED"
                ? "Проект отключён — проверьте, должен ли он участвовать в работе."
                : project.totalSites === 0
                  ? "В проекте ещё нет сайтов."
                  : `${missingSites} ${missingSites === 1 ? "сайт не готов" : "сайтов не готовы"} к формированию отчёта.`;
              return (
                <article key={project.projectId} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-semibold text-app-foreground">{project.name}</p>
                    <p className="mt-1 text-sm text-app-secondary">{explanation}</p>
                  </div>
                  <Link href={`/c/${project.projectSlug}/`} className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm font-semibold text-app-foreground">
                    Открыть
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      {eventSummary ? (
        <SectionCard title="Последние отчёты и события" note="8 последних событий">
          {eventSummary.items.length > 0 ? (
            <div className="divide-y divide-[var(--border)]">
              {eventSummary.items.slice(0, 5).map((item) => (
                <div key={item.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-app-foreground">{item.title}</p>
                    <p className="text-sm text-app-secondary">{item.projectName ?? item.organizationName ?? "Система"}</p>
                  </div>
                  <time className="text-xs text-app-muted-foreground" dateTime={item.occurredAt}>{formatDate(item.occurredAt)}</time>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-app-secondary">Событий пока нет. Они появятся после подключения источников и первого обновления отчётов.</p>
          )}
          <Link href="/notifications/" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-app-primary">Открыть историю событий</Link>
        </SectionCard>
      ) : null}

      <section aria-label="Краткие показатели" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Проекты" value={String(overview.totalProjects)} tone="primary" />
        <KpiCard label="Сайты" value={String(overview.totalSites)} />
        <KpiCard label="Готовы к отчётам" value={String(overview.projectCards.reduce((total, item) => total + item.readySites, 0))} />
        <KpiCard label="Нужен следующий шаг" value={String(projectIssues.length)} tone="soft" />
      </section>
    </div>
  );
}
