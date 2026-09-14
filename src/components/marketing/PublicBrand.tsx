import { cn } from "../../shared/lib/cn.ts";

type PublicBrandProps = {
  className?: string;
  size?: "default" | "large";
};

export function PublicBrand({ className, size = "default" }: PublicBrandProps) {
  return (
    <span className={cn("inline-flex items-center gap-3 text-[var(--ch-white)]", className)} aria-hidden="true">
      <span
        className={cn(
          "relative grid shrink-0 place-items-center border border-[var(--ch-border-hover)] bg-[var(--ch-surface-subtle)] font-extrabold",
          size === "large" ? "size-12 text-public-label" : "size-10 text-public-micro",
        )}
      >
        АМС
      </span>
      <span className="text-public-brand font-extrabold">ИМПУЛЬС</span>
    </span>
  );
}
