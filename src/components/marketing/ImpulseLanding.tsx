import { SiteFooter } from "./SiteFooter.tsx";
import styles from "./ImpulseLanding.module.css";
import { FloatingPublicHeader } from "./FloatingPublicHeader.tsx";
import { HeroSection } from "./sections/HeroSection.tsx";

export function ImpulseLanding({ loginRequested, oauthLoginRequested = false }: { loginRequested: boolean; oauthLoginRequested?: boolean }) {
  return <main className={`theme-public ${styles.landing} min-h-screen overflow-hidden bg-[var(--ch-bg-deepest)] text-[var(--ch-white)]`}><FloatingPublicHeader /><HeroSection loginRequested={loginRequested} oauthLoginRequested={oauthLoginRequested} /><SiteFooter /></main>;
}
