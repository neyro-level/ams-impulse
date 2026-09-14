import Link from "next/link";
import { LoginDialog } from "../../../modules/identity-access/client.ts";
import { Container } from "../../layout/Container.tsx";
import { PublicBrand } from "../PublicBrand.tsx";

export function PublicHeader({ loginRequested, oauthLoginRequested }: { loginRequested: boolean; oauthLoginRequested: boolean }) {
  return (
    <header data-public-header-primary>
      <Container size="site" className="flex items-center justify-between py-5 lg:py-7">
        <Link href="/" className="inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ch-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--ch-bg-deepest)]" aria-label="АМС ИМПУЛЬС — главная">
          <PublicBrand />
        </Link>
        <LoginDialog initialOpen={loginRequested} oauthLoginRequested={oauthLoginRequested} />
      </Container>
    </header>
  );
}
