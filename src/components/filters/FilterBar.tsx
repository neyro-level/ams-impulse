import type { FormHTMLAttributes, ReactNode } from "react";
import { cn } from "../../shared/lib/cn.ts";

export function FilterBar({ children, className, label = "Фильтры", surface = "panel", ...props }: FormHTMLAttributes<HTMLFormElement> & { children: ReactNode; label?: string; surface?: "panel" | "plain" }) {
  return <form aria-label={label} className={cn("grid gap-3", surface === "panel" && "rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--card)] p-4", className)} {...props}>{children}</form>;
}
