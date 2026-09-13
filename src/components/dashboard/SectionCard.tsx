import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  note?: string;
  children: ReactNode;
};

export function SectionCard({ title, note, children }: SectionCardProps) {
  return (
    <section className="min-w-0 max-w-full rounded-card border border-border bg-card p-4 shadow-surface sm:p-5">
      <header className="mb-4 flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-h2 font-semibold text-foreground">
          {title}
        </h2>
        {note ? (
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {note}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
