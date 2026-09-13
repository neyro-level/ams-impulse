import Link from "next/link";
import { LoginDialog } from "../../../modules/identity-access/client.ts";
import { Container } from "../../layout/Container.tsx";

export function PublicHeader({ loginRequested, oauthLoginRequested }: { loginRequested: boolean; oauthLoginRequested: boolean }) {
  return <Container size="site" className="flex items-center justify-between py-5 lg:py-7"><Link href="/" className="inline-flex min-h-11 items-center gap-3 text-[var(--ch-white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ch-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--ch-bg-deepest)]" aria-label="AMS IMPULSE — главная"><span className="grid size-10 place-items-center border border-[var(--ch-border-hover)] bg-[var(--ch-surface-subtle)] text-public-label font-extrabold">AMS</span><span className="text-public-brand font-extrabold">IMPULSE</span></Link><LoginDialog initialOpen={loginRequested} oauthLoginRequested={oauthLoginRequested} /></Container>;
}
