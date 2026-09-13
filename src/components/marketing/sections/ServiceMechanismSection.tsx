import { Container } from "../../layout/Container.tsx";
import { LeadRequestDialog } from "../LeadRequestDialog.tsx";
import { serviceSteps } from "./content.ts";

export function ServiceMechanismSection() {
  return (
    <section id="method" className="bg-[var(--ch-bg-page)] text-[var(--ch-text-primary)]">
      <Container size="site" className="grid gap-12 py-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-20 lg:py-28">
        <div>
          <p className="text-public-label font-bold uppercase text-[var(--ch-accent-strong)]">Как устроена услуга</p>
          <h2 className="mt-5 max-w-md text-public-heading font-extrabold">Понятный процесс от проверки сайта до отчёта</h2>
          <p className="mt-6 max-w-md text-base leading-7 text-[var(--ch-text-secondary)]">Когда работа с SEO ведётся без зафиксированного ядра и регулярных замеров, собственнику трудно отличить реальную динамику от отдельных удачных запросов. Поэтому сначала определяем базу сравнения, затем показываем изменения по ней.</p>
          <div className="mt-9 border-l-2 border-[var(--ch-accent)] pl-5">
            <p className="text-public-field-label font-bold uppercase text-[var(--ch-accent-strong)]">Что получает клиент</p>
            <p className="mt-3 text-sm leading-6 text-[var(--ch-text-secondary)]">Согласованное ядро, регулярные замеры позиций, сравнение периодов и доступ к отчёту в личном кабинете.</p>
          </div>
          <div className="mt-9"><LeadRequestDialog /></div>
        </div>
        <ol className="border-t border-[var(--ch-border-light)]">
          {serviceSteps.map((step) => (
            <li key={step.number} className="grid gap-3 border-b border-[var(--ch-border-light)] py-7 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-5 sm:py-8">
              <span className="text-sm font-bold tabular-nums text-[var(--ch-accent-strong)]">{step.number}</span>
              <div className="grid gap-2 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8">
                <h3 className="text-public-card-title font-bold">{step.title}</h3>
                <p className="text-sm leading-6 text-[var(--ch-text-secondary)]">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
