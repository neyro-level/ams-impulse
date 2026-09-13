import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHeader } from "../layout/SectionHeader.tsx";

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  backHref?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  backHref,
}: PageHeaderProps) {
  return <SectionHeader
    level={1}
    title={title}
    description={description}
    actions={actions}
    backAction={backHref ? (
              <Link
                href={backHref}
                aria-label="Назад"
                title="Назад"
                className="group inline-flex h-10 shrink-0 items-center pr-1 text-muted-foreground transition hover:text-primary"
              >
                <ArrowLeft
                  className="h-5 w-5 transition-transform group-hover:-translate-x-0.5"
                  strokeWidth={1.7}
                />
              </Link>
            ) : null}
  />;
}
