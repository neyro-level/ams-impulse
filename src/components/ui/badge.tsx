import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../shared/lib/cn.ts";

const badgeVariants = cva("inline-flex items-center rounded border px-2 py-1 text-xs font-semibold", {
  variants: {
    variant: {
      default: "border-border bg-muted text-secondary-text",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      outline: "border-border bg-transparent text-foreground",
      destructive: "border-transparent bg-destructive-soft text-destructive",
      success: "border-transparent bg-success-soft text-success",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}
