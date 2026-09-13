import { Container } from "../../layout/Container.tsx";
import { reportCards, reportProof } from "./content.ts";

export function ReportProofSection() {
  return (
    <section className="bg-[var(--ch-bg-section)] text-[var(--ch-text-primary)]">
      <Container size="site" className="grid gap-12 py-20 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-28">
        <div className="border border-[var(--ch-border-light)] bg-[var(--ch-bg-surface)] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-6 border-b border-[var(--ch-border-light)] pb-5">
            <div>
              <p className="text-public-label font-bold uppercase text-[var(--ch-accent-strong)]">Личный кабинет</p>
              <p className="mt-2 text-public-card-title font-bold">Контроль SEO-динамики</p>
            </div>
            <span className="border border-[var(--ch-border-light)] px-3 py-2 text-xs font-semibold text-[var(--ch-text-secondary)]">Месяц</span>
          </div>
          <div className="grid gap-3 py-6 sm:grid-cols-3">
            {reportCards.map((label) => (
              <div key={label} className="min-h-28 bg-[var(--ch-bg-page)] p-4">
                <span className="block size-2 bg-[var(--ch-accent)]" />
                <p className="mt-8 text-sm font-bold leading-5">{label}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--ch-border-light)] pt-5 text-xs leading-5 text-[var(--ch-text-secondary)]">Схема показывает состав действующего отчёта без демонстрационных результатов и обещаний позиции.</div>
        </div>
        <div>
          <p className="text-public-label font-bold uppercase text-[var(--ch-accent-strong)]">Проверяемая часть услуги</p>
          <h2 className="mt-5 max-w-xl text-public-heading font-extrabold">Клиент видит не только итоговую цифру</h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--ch-text-secondary)]">Кабинет фиксирует базу расчёта и состояние данных. Это позволяет обсуждать работу по общей системе показателей, не приписывая отдельной позиции гарантированный коммерческий результат.</p>
          <ul className="mt-8 border-t border-[var(--ch-border-light)]">
            {reportProof.map((item) => (
              <li key={item} className="grid grid-cols-[18px_minmax(0,1fr)] gap-4 border-b border-[var(--ch-border-light)] py-4 text-sm leading-6 text-[var(--ch-text-secondary)]">
                <span className="mt-2 size-1.5 bg-[var(--ch-accent)]" aria-hidden />{item}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
