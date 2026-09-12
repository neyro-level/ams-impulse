import type { ReactNode } from "react";
import { PrivateApplicationLayout } from "../../components/shell/PrivateApplicationLayout.tsx";
import { PRIVATE_APP_VIEWPORT } from "../../shared/design-system/private-tokens.ts";

export const viewport = PRIVATE_APP_VIEWPORT;

export default function NotificationsLayout({ children }: { children: ReactNode }) { return <PrivateApplicationLayout>{children}</PrivateApplicationLayout>; }
