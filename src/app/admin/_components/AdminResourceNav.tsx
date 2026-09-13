import Link from "next/link";
import {
  PLATFORM_ADMIN_RESOURCES,
} from "../../../modules/platform-admin/index.ts";
import { cn } from "../../../shared/lib/cn.ts";

export function AdminResourceNav({ currentPath }: { currentPath: string }) {
  return (
    <nav aria-label="Разделы администрирования" className="flex flex-wrap gap-2">
      {PLATFORM_ADMIN_RESOURCES.map((item) => {
        const active = currentPath === item.href;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded border px-4 text-sm font-semibold transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-secondary-text hover:bg-muted",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
