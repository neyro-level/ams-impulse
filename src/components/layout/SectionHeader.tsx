import type { ReactNode } from "react";
import { cn } from "../../shared/lib/cn.ts";

type SectionHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  backAction?: ReactNode;
  level?: 1 | 2 | 3;
  className?: string;
};

export function SectionHeader({ title, description, eyebrow, actions, backAction, level = 2, className }: SectionHeaderProps) {
  const Heading = `h${level}` as const;
  const titleClass = level === 1 ? "text-h1" : level === 2 ? "text-h2" : "text-h3";

  return (
    <header className={cn("border-b border-border pb-5", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {eyebrow ? <p className="text-label font-semibold uppercase tracking-widest text-info">{eyebrow}</p> : null}
          <div className="flex min-w-0 items-center gap-2.5">
            {backAction}
            <Heading className={cn("truncate font-semibold text-foreground", titleClass)}>{title}</Heading>
          </div>
          {description ? <p className="max-w-4xl break-words text-body text-secondary-text">{description}</p> : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}
