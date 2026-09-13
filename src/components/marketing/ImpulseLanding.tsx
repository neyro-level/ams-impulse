import Link from "next/link";
import { LoginDialog } from "../../modules/identity-access/client.ts";
import { LeadRequestDialog } from "./LeadRequestDialog.tsx";
import { SiteFooter } from "./SiteFooter.tsx";
import styles from "./ImpulseLanding.module.css";

function PublicHeader({ loginRequested, oauthLoginRequested }: { loginRequested: boolean; oauthLoginRequested: boolean }) {
  return <header className="mx-auto flex w-full max-w-[1360px] items-center justify-between px-5 py-5 sm:px-6 lg:py-7"><Link href="/" className="inline-flex min-h-11 items-center gap-3 text-[var(--ch-white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ch-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--ch-bg-deepest)]" aria-label="AMS IMPULSE — главная"><span className="grid size-10 place-items-center border border-[var(--ch-border-hover)] bg-[var(--ch-surface-subtle)] text-[11px] font-extrabold tracking-[-0.04em]">AMS</span><span className="text-sm font-extrabold tracking-[0.16em]">IMPULSE</span></Link><LoginDialog initialOpen={loginRequested} oauthLoginRequested={oauthLoginRequested} /></header>;
}

function HeroCopy() {
  return <div className="relative z-10 max-w-3xl"><p className="mb-6 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ch-accent)]">Для действующих коммерческих сайтов</p><h1 className="max-w-[900px] text-[clamp(44px,6.2vw,84px)] font-extrabold leading-[0.98] tracking-[-0.045em] text-[var(--ch-white)]">Продвижение в Яндексе с контролем позиций</h1><p className="mt-7 max-w-2xl text-[clamp(17px,1.45vw,21px)] leading-[1.62] text-[var(--ch-soft-white)]">Подбираем поисковые запросы, настраиваем работу с поведенческими факторами и показываем динамику по согласованному ядру в личном кабинете. Применимость услуги проверяем до старта.</p><div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center"><LeadRequestDialog /><p className="max-w-[320px] text-xs leading-5 text-[var(--ch-muted-ondark)]">Сначала уточним задачу и проверим, подходит ли услуга. Доступ в кабинет создаёт администратор после согласования.</p></div><div className="mt-14 flex flex-wrap gap-x-7 gap-y-3 border-t border-[var(--ch-border-subtle)] pt-5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ch-copy-ondark)]"><span>Согласованное ядро</span><span>Позиции в Яндексе</span><span>Отчёт по периодам</span></div></div>;
}

function HeroVisual() {
  return <div className="relative min-h-[420px] lg:min-h-[620px]" aria-hidden><div className={`${styles.visual} absolute inset-0 overflow-hidden border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-deeper)]/55`}><div className="absolute inset-0 bg-[image:var(--ch-hero-gradient)]" /><svg className="absolute inset-0 h-full w-full" viewBox="0 0 560 680" fill="none"><path d="M-20 586C115 498 178 529 268 403C351 288 406 184 596 106" stroke="var(--ch-data-line)" strokeWidth="2" /><path d="M-15 620C138 535 201 552 302 427C389 319 428 215 602 148" stroke="var(--ch-data-line-faint)" strokeWidth="1" /><path d="M30 552L138 478L219 503L316 353L419 302L532 162" stroke="var(--ch-data-line-soft)" strokeWidth="1" /><circle cx="138" cy="478" r="5" fill="var(--ch-accent)" /><circle cx="219" cy="503" r="4" fill="var(--ch-soft-white)" /><circle cx="316" cy="353" r="6" fill="var(--ch-accent)" /><circle cx="419" cy="302" r="4" fill="var(--ch-soft-white)" /><circle cx="532" cy="162" r="7" fill="var(--ch-accent)" /></svg><div className="absolute left-6 top-6 border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-deepest)]/75 px-4 py-3 backdrop-blur-sm sm:left-8 sm:top-8"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ch-subtle-ondark)]">Контур контроля</p><p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[var(--ch-white)]">Всё ядро</p></div><div className="absolute bottom-7 right-6 w-[min(280px,calc(100%_-_48px))] border border-[var(--ch-border-subtle)] bg-[var(--ch-bg-dark)]/88 p-5 backdrop-blur-md sm:bottom-9 sm:right-8"><div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ch-subtle-ondark)]">Динамика</p><p className="mt-2 text-lg font-bold text-[var(--ch-white)]">Позиции по периодам</p></div><span className="size-2 bg-[var(--ch-accent)] shadow-[var(--ch-signal-ring)]" /></div><div className="mt-5 grid grid-cols-5 items-end gap-2">{[62, 48, 72, 55, 66].map((height, index) => <span key={`${height}-${index}`} className="block bg-[var(--ch-accent)]/75" style={{ height, opacity: 0.45 + index * 0.12 }} />)}</div></div></div></div>;
}

const serviceSteps = [
  { number: "01", title: "Проверяем исходную точку", description: "Разбираем сайт, регион, текущую видимость и ограничения. До запуска определяем, применим ли метод к задаче." },
  { number: "02", title: "Согласовываем поисковое ядро", description: "Фиксируем запросы, по которым будет оцениваться динамика. В отчёте учитывается всё утверждённое активное ядро." },
  { number: "03", title: "Настраиваем контур продвижения", description: "Запускаем согласованные работы с поведенческими факторами и контролируем их техническое состояние." },
  { number: "04", title: "Показываем данные, а не обещания", description: "Личный кабинет собирает позиции и сравнение периодов. Частичные или устаревшие данные обозначаются прямо." },
] as const;

function ServiceMechanism() {
  return (
    <section id="method" className="bg-[var(--ch-bg-page)] text-[var(--ch-text-primary)]">
      <div className="mx-auto grid w-full max-w-[1360px] gap-12 px-5 py-20 sm:px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-20 lg:py-28">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ch-accent-strong)]">Как устроена услуга</p>
          <h2 className="mt-5 max-w-md text-[clamp(34px,4vw,56px)] font-extrabold leading-[1.02] tracking-[-0.04em]">Понятный процесс от проверки сайта до отчёта</h2>
          <p className="mt-6 max-w-md text-base leading-7 text-[var(--ch-text-secondary)]">Когда работа с SEO ведётся без зафиксированного ядра и регулярных замеров, собственнику трудно отличить реальную динамику от отдельных удачных запросов. Поэтому сначала определяем базу сравнения, затем показываем изменения по ней.</p>
          <div className="mt-9 border-l-2 border-[var(--ch-accent)] pl-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ch-accent-strong)]">Что получает клиент</p>
            <p className="mt-3 text-sm leading-6 text-[var(--ch-text-secondary)]">Согласованное ядро, регулярные замеры позиций, сравнение периодов и доступ к отчёту в личном кабинете.</p>
          </div>
          <div className="mt-9"><LeadRequestDialog /></div>
        </div>

        <ol className="border-t border-[var(--ch-border-light)]">
          {serviceSteps.map((step) => (
            <li key={step.number} className="grid gap-3 border-b border-[var(--ch-border-light)] py-7 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-5 sm:py-8">
              <span className="text-sm font-bold tabular-nums text-[var(--ch-accent-strong)]">{step.number}</span>
              <div className="grid gap-2 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8">
                <h3 className="text-xl font-bold tracking-[-0.025em]">{step.title}</h3>
                <p className="text-sm leading-6 text-[var(--ch-text-secondary)]">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const reportProof = [
  "В расчёт входит всё утверждённое активное ядро, а не выборка лучших запросов.",
  "Топ-3 считается частью Топ-10; количество запросов и доля показаны вместе.",
  "Динамику можно смотреть за неделю, месяц, квартал или полгода.",
  "Частичный результат, устаревший источник и отсутствие данных не выдаются за актуальные значения.",
] as const;

function ReportProof() {
  return (
    <section className="bg-[var(--ch-bg-section)] text-[var(--ch-text-primary)]">
      <div className="mx-auto grid w-full max-w-[1360px] gap-12 px-5 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-28">
        <div className="border border-[var(--ch-border-light)] bg-[var(--ch-bg-surface)] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-6 border-b border-[var(--ch-border-light)] pb-5">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ch-accent-strong)]">Личный кабинет</p><p className="mt-2 text-xl font-bold tracking-[-0.025em]">Контроль SEO-динамики</p></div>
            <span className="border border-[var(--ch-border-light)] px-3 py-2 text-xs font-semibold text-[var(--ch-text-secondary)]">Месяц</span>
          </div>
          <div className="grid gap-3 py-6 sm:grid-cols-3">
            {["Поисковое ядро", "Топ-3 и Топ-10", "Статус источников"].map((label) => <div key={label} className="min-h-28 bg-[var(--ch-bg-page)] p-4"><span className="block size-2 bg-[var(--ch-accent)]" /><p className="mt-8 text-sm font-bold leading-5">{label}</p></div>)}
          </div>
          <div className="border-t border-[var(--ch-border-light)] pt-5 text-xs leading-5 text-[var(--ch-text-secondary)]">Схема показывает состав действующего отчёта без демонстрационных результатов и обещаний позиции.</div>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--ch-accent-strong)]">Проверяемая часть услуги</p>
          <h2 className="mt-5 max-w-xl text-[clamp(34px,4vw,56px)] font-extrabold leading-[1.02] tracking-[-0.04em]">Клиент видит не только итоговую цифру</h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--ch-text-secondary)]">Кабинет фиксирует базу расчёта и состояние данных. Это позволяет обсуждать работу по общей системе показателей, не приписывая отдельной позиции гарантированный коммерческий результат.</p>
          <ul className="mt-8 border-t border-[var(--ch-border-light)]">
            {reportProof.map((item) => <li key={item} className="grid grid-cols-[18px_minmax(0,1fr)] gap-4 border-b border-[var(--ch-border-light)] py-4 text-sm leading-6 text-[var(--ch-text-secondary)]"><span className="mt-2 size-1.5 bg-[var(--ch-accent)]" aria-hidden />{item}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function ImpulseLanding({ loginRequested, oauthLoginRequested = false }: { loginRequested: boolean; oauthLoginRequested?: boolean }) {
  return <main className={`theme-public ${styles.landing} min-h-screen overflow-hidden bg-[var(--ch-bg-deepest)] text-[var(--ch-white)]`}><section className="relative isolate min-h-screen"><div className={`${styles.grid} absolute inset-0 -z-20`} aria-hidden /><div className={`${styles.atmosphere} absolute inset-0 -z-10`} aria-hidden /><PublicHeader loginRequested={loginRequested} oauthLoginRequested={oauthLoginRequested} /><div className="mx-auto grid w-full max-w-site gap-12 px-container pb-12 pt-14 sm:px-container-wide sm:pt-20 lg:min-h-[calc(100vh-96px)] lg:grid-cols-[minmax(0,7fr)_minmax(360px,5fr)] lg:items-center lg:gap-16 lg:pb-20 lg:pt-10"><HeroCopy /><HeroVisual /></div></section><ServiceMechanism /><ReportProof /><SiteFooter /></main>;
}
