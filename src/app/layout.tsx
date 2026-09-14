import type { Metadata, Viewport } from "next";
import { Toaster } from "../components/ui/sonner.tsx";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ServiceWorkerRegistration } from "../components/pwa/ServiceWorkerRegistration.tsx";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://impulse.ams24.ru"),
  title: {
    default: "Проектируем системы продаж и маркетинга для предсказуемого роста выручки",
    template: "%s | AMS IMPULSE",
  },
  description:
    "Увеличиваем поток лидов и выстраиваем прозрачные воронки для системного роста выручки и полного контроля над продажами.",
  applicationName: "AMS IMPULSE",
  keywords: ["системы продаж", "маркетинговые системы", "поток лидов", "воронки продаж", "рост выручки"],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/ams-favicon.svg", type: "image/svg+xml" }],
    shortcut: "/ams-favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: "AMS IMPULSE",
    title: "Проектируем системы продаж и маркетинга для предсказуемого роста выручки",
    description:
      "Увеличиваем поток лидов и выстраиваем прозрачные воронки для системного роста выручки и полного контроля над продажами.",
  },
  twitter: {
    card: "summary",
    title: "Проектируем системы продаж и маркетинга для предсказуемого роста выручки",
    description:
      "Увеличиваем поток лидов и выстраиваем прозрачные воронки для системного роста выручки и полного контроля над продажами.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0c1117",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full"><NuqsAdapter>{children}</NuqsAdapter><ServiceWorkerRegistration /><Toaster /></body>
    </html>
  );
}
