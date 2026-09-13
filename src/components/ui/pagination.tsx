import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "../../shared/lib/cn.ts";

export function Pagination({ page, pageCount, previousHref, nextHref, className }: { page: number; pageCount: number; previousHref: string; nextHref: string; className?: string }) {
  const previousDisabled = page <= 1;
  const nextDisabled = page >= pageCount;
  const linkClassName = "inline-flex min-h-11 items-center gap-2 rounded border border-input bg-card px-3 text-sm font-semibold text-foreground transition hover:bg-accent";
  return (
    <nav aria-label="Пагинация" className={cn("flex items-center justify-between gap-3", className)}>
      <Link aria-disabled={previousDisabled} tabIndex={previousDisabled ? -1 : undefined} className={cn(linkClassName, previousDisabled && "pointer-events-none opacity-50")} href={previousHref}><ChevronLeft aria-hidden />Назад</Link>
      <span className="text-sm text-secondary-text">Страница {page} из {pageCount}</span>
      <Link aria-disabled={nextDisabled} tabIndex={nextDisabled ? -1 : undefined} className={cn(linkClassName, nextDisabled && "pointer-events-none opacity-50")} href={nextHref}>Далее<ChevronRight aria-hidden /></Link>
    </nav>
  );
}
