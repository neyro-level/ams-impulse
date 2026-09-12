import type { Metadata, Viewport } from "next";
import { Toaster } from "../components/ui/sonner.tsx";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ServiceWorkerRegistration } from "../components/pwa/ServiceWorkerRegistration.tsx";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://impulse.ams24.ru"),
  title: {
    default: "Продвижение сайтов в Яндексе с контролем позиций",
    template: "%s | AMS IMPULSE",
  },
  description:
    "Продвижение действующих коммерческих сайтов в Яндексе: согласованное поисковое ядро, работа с поведенческими факторами и контроль динамики в личном кабинете.",
  applicationName: "AMS IMPULSE",
  keywords: ["продвижение сайтов", "SEO", "продвижение в Яндексе", "поведенческие факторы"],
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
    title: "Продвижение сайтов в Яндексе с контролем позиций",
    description:
      "Согласованное поисковое ядро, работа с поведенческими факторами и контроль динамики в личном кабинете.",
  },
  twitter: {
    card: "summary",
    title: "Продвижение сайтов в Яндексе с контролем позиций",
    description:
      "Согласованное поисковое ядро, работа с поведенческими факторами и контроль динамики в личном кабинете.",
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
