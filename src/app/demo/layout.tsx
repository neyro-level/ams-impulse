import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PrivateApplicationLayout } from "../../components/shell/PrivateApplicationLayout.tsx";
import { PRIVATE_APP_VIEWPORT } from "../../shared/design-system/private-tokens.ts";

export const metadata: Metadata = {
  title: "Демонстрационный отчёт",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport = PRIVATE_APP_VIEWPORT;

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <PrivateApplicationLayout>{children}</PrivateApplicationLayout>;
}
