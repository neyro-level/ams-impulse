import { SiteFooter } from "./SiteFooter.tsx";
import styles from "./ImpulseLanding.module.css";
import { HeroSection } from "./sections/HeroSection.tsx";
import { ReportProofSection } from "./sections/ReportProofSection.tsx";
import { ServiceMechanismSection } from "./sections/ServiceMechanismSection.tsx";

export function ImpulseLanding({ loginRequested, oauthLoginRequested = false }: { loginRequested: boolean; oauthLoginRequested?: boolean }) {
  return <main className={`theme-public ${styles.landing} min-h-screen overflow-hidden bg-[var(--ch-bg-deepest)] text-[var(--ch-white)]`}><HeroSection loginRequested={loginRequested} oauthLoginRequested={oauthLoginRequested} /><ServiceMechanismSection /><ReportProofSection /><SiteFooter /></main>;
}
