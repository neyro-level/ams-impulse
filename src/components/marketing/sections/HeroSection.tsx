import { Container } from "../../layout/Container.tsx";
import styles from "../ImpulseLanding.module.css";
import { LeadRequestDialog } from "../LeadRequestDialog.tsx";
import { PublicHeader } from "./PublicHeader.tsx";

function HeroCopy() {
  return (
    <div className="relative z-10 max-w-3xl">
      <h1 className="max-w-copy text-public-display font-extrabold text-[var(--ch-white)]">
        Проектируем системы продаж и маркетинга для предсказуемого роста выручки
      </h1>
      <p className="mt-7 max-w-2xl text-public-lead text-[var(--ch-soft-white)]">
        Увеличиваем поток лидов и выстраиваем прозрачные воронки для системного роста выручки и полного контроля над продажами.
      </p>
      <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <LeadRequestDialog />
        <p className="max-w-support text-xs leading-5 text-[var(--ch-muted-ondark)]">
          Разберём ваши процессы и данные. Спроектируем архитектуру до начала разработки.
        </p>
      </div>
    </div>
  );
}

function HeroVisual() {
  const bars = [styles.barOne, styles.barTwo, styles.barThree, styles.barFour, styles.barFive];
  return <div className="relative min-h-[420px] lg:min-h-[620px]" aria-hidden><div className={`${styles.visual} ${styles.visualSurface} absolute inset-0 overflow-hidden border border-[var(--ch-border-subtle)]`}><div className="absolute inset-0 bg-[image:var(--ch-hero-gradient)]" /><svg className="absolute inset-0 h-full w-full" viewBox="0 0 560 680" fill="none"><path d="M-20 586C115 498 178 529 268 403C351 288 406 184 596 106" stroke="var(--ch-data-line)" strokeWidth="2" /><path d="M-15 620C138 535 201 552 302 427C389 319 428 215 602 148" stroke="var(--ch-data-line-faint)" strokeWidth="1" /><path d="M30 552L138 478L219 503L316 353L419 302L532 162" stroke="var(--ch-data-line-soft)" strokeWidth="1" /><circle cx="138" cy="478" r="5" fill="var(--ch-accent)" /><circle cx="219" cy="503" r="4" fill="var(--ch-soft-white)" /><circle cx="316" cy="353" r="6" fill="var(--ch-accent)" /><circle cx="419" cy="302" r="4" fill="var(--ch-soft-white)" /><circle cx="532" cy="162" r="7" fill="var(--ch-accent)" /></svg><div className={`${styles.heroLabelPanel} absolute left-6 top-6 border border-[var(--ch-border-subtle)] px-4 py-3 backdrop-blur-sm sm:left-8 sm:top-8`}><p className="text-public-label font-bold uppercase text-[var(--ch-subtle-ondark)]">Мониторинг</p><p className="mt-1 text-2xl font-bold tracking-tight text-[var(--ch-white)]">Позиции сайта</p></div><div className={`${styles.heroChartPanel} absolute bottom-7 right-6 w-[min(280px,calc(100%_-_48px))] border border-[var(--ch-border-subtle)] p-5 backdrop-blur-md sm:bottom-9 sm:right-8`}><div className="flex items-center justify-between gap-4"><div><p className="text-public-label font-bold uppercase text-[var(--ch-subtle-ondark)]">Динамика</p><p className="mt-2 text-lg font-bold text-[var(--ch-white)]">Позиции по периодам</p></div><span className="size-2 bg-[var(--ch-accent)] shadow-[var(--ch-signal-ring)]" /></div><div className="mt-5 grid grid-cols-5 items-end gap-2">{bars.map((barClass) => <span key={barClass} className={`${barClass} block bg-[var(--ch-accent)]`} />)}</div></div></div></div>;
}

export function HeroSection({ loginRequested, oauthLoginRequested }: { loginRequested: boolean; oauthLoginRequested: boolean }) {
  return <section className="relative isolate min-h-screen"><div className={`${styles.grid} absolute inset-0 -z-20`} aria-hidden /><div className={`${styles.atmosphere} absolute inset-0 -z-10`} aria-hidden /><PublicHeader loginRequested={loginRequested} oauthLoginRequested={oauthLoginRequested} /><Container size="site" className="grid gap-12 pb-12 pt-14 sm:pt-20 lg:min-h-[calc(100vh-96px)] lg:grid-cols-[minmax(0,7fr)_minmax(360px,5fr)] lg:items-start lg:gap-16 lg:pb-20 lg:pt-10"><HeroCopy /><HeroVisual /></Container></section>;
}
