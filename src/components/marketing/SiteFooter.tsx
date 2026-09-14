import { ArrowUpRight, MessageCircle, Send } from "lucide-react";
import Link from "next/link";
import { legalLinks, legalOperator, publicContacts } from "../../shared/legal/legal-config.ts";
import styles from "./ImpulseLanding.module.css";
import { PublicBrand } from "./PublicBrand.tsx";

export function SiteFooter() {
  const phoneHref = `tel:${legalOperator.phone.replace(/[^\d+]/g, "")}`;

  return (
    <footer id="site-footer" className={`${styles.landing} border-t border-[var(--ch-border-subtle)] bg-[var(--ch-bg-deeper)] text-[var(--ch-white)]`} role="contentinfo">
      <div className="mx-auto grid w-full max-w-site gap-10 px-container py-14 sm:px-container-wide md:grid-cols-[1.15fr_0.85fr_0.8fr] lg:gap-16 lg:py-18">
        <div>
          <Link href="/" className="inline-flex items-center" aria-label="АМС ИМПУЛЬС — на главную">
            <PublicBrand />
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-6 text-[var(--ch-body-ondark)]">
            Продвижение сайтов в Яндексе через поведенческие факторы с контролем динамики и понятной отчётностью.
          </p>
        </div>

        <nav aria-label="Правовая информация">
          <h2 className="text-public-micro font-bold uppercase text-[var(--ch-accent)]">Документы</h2>
          <div className="mt-5 grid gap-3">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="w-fit text-sm text-[var(--ch-muted-ondark)] transition hover:text-[var(--ch-white)]">
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        <address className="not-italic">
          <h2 className="text-public-micro font-bold uppercase text-[var(--ch-accent)]">Контакты</h2>
          <div className="mt-5 grid gap-3">
            <a href={phoneHref} className="w-fit text-sm font-semibold text-[var(--ch-white)] transition hover:text-[var(--ch-soft-white)]">{legalOperator.phone}</a>
            <a href={`mailto:${legalOperator.email}`} className="w-fit text-sm text-[var(--ch-muted-ondark)] transition hover:text-[var(--ch-white)]">{legalOperator.email}</a>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={publicContacts.telegram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 border border-[var(--ch-border-subtle)] px-3 text-xs font-semibold text-[var(--ch-action-ondark)] transition hover:border-[var(--ch-border-hover)] hover:text-[var(--ch-white)]">
              <Send className="size-4" strokeWidth={1.6} aria-hidden /> Telegram
            </a>
            <a href={publicContacts.max} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 border border-[var(--ch-border-subtle)] px-3 text-xs font-semibold text-[var(--ch-action-ondark)] transition hover:border-[var(--ch-border-hover)] hover:text-[var(--ch-white)]">
              <MessageCircle className="size-4" strokeWidth={1.6} aria-hidden /> Max
            </a>
          </div>
        </address>
      </div>

      <div className="mx-auto flex w-full max-w-site flex-col gap-3 border-t border-[var(--ch-border-subtle)] px-container py-6 text-xs text-[var(--ch-faint-ondark)] sm:px-container-wide md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} {legalOperator.name} · ИНН {legalOperator.inn}</p>
        <a href="https://ams24.ru" target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 transition hover:text-[var(--ch-action-ondark)]">
          Разработано в АМС <ArrowUpRight className="size-3.5" strokeWidth={1.6} aria-hidden />
        </a>
      </div>
    </footer>
  );
}
