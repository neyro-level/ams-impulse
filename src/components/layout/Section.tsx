import type { HTMLAttributes } from "react";
import { cn } from "../../shared/lib/cn.ts";

type SectionProps = HTMLAttributes<HTMLElement> & {
  spacing?: "sm" | "md" | "lg" | "hero";
};

const spacingClasses = {
  sm: "py-section-sm",
  md: "py-section-md",
  lg: "py-section-lg",
  hero: "py-section-hero",
} as const;

export function Section({ spacing = "md", className, ...props }: SectionProps) {
  return <section className={cn(spacingClasses[spacing], className)} {...props} />;
}
