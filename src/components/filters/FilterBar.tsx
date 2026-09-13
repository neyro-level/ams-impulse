import type { FormHTMLAttributes, ReactNode } from "react";
import { cn } from "../../shared/lib/cn.ts";

export function FilterBar({ children, className, label = "Фильтры", surface = "panel", ...props }: FormHTMLAttributes<HTMLFormElement> & { children: ReactNode; label?: string; surface?: "panel" | "plain" }) {
  return <form aria-label={label} className={cn("grid gap-3", surface === "panel" && "rounded-panel border border-border bg-card p-4", className)} {...props}>{children}</form>;
}
