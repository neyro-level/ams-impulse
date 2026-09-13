import * as React from "react";
import { cn } from "../../shared/lib/cn.ts";

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="alert" role="alert" className={cn("rounded-panel border border-border bg-card p-4 text-sm", className)} {...props} />;
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 data-slot="alert-title" className={cn("mb-1 font-semibold", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="alert-description" className={cn("text-muted-foreground", className)} {...props} />;
}
