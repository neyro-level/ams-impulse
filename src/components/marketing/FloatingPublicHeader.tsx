"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoginDialog } from "../../modules/identity-access/client.ts";
import { Container } from "../layout/Container.tsx";
import { PublicBrand } from "./PublicBrand.tsx";

export function FloatingPublicHeader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const primaryHeader = document.querySelector("[data-public-header-primary]");
    if (!primaryHeader) return;

    const observer = new IntersectionObserver(([entry]) => {
      setVisible(!entry.isIntersecting);
    });
    observer.observe(primaryHeader);

    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <header aria-label="Быстрый доступ" className="pointer-events-auto w-full border-b border-[var(--ch-border-control)] bg-[var(--ch-bg-deepest)] shadow-[var(--ch-header-shadow)]">
        <Container size="fluid" className="flex items-center justify-between py-3">
          <Link href="/" className="inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ch-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--ch-bg-deepest)]" aria-label="АМС ИМПУЛЬС — главная">
            <PublicBrand />
          </Link>
          <LoginDialog triggerId="floating-login-dialog-trigger" />
        </Container>
      </header>
    </div>
  );
}
