import {
  hasPermission,
  type PrincipalContext,
} from "../../../platform/authorization/principal.ts";
import type {
  NavigationItem,
  NavigationSection,
} from "../../../platform/navigation/types.ts";
import { getAuthorizationService } from "../../identity-access/server.ts";
import { getProjectService } from "../server.ts";
import { getProductDefinition, getToolDefinition } from "../../product-catalog/index.ts";

export type { NavigationChild, NavigationItem, NavigationSection } from "../../../platform/navigation/types.ts";

export async function buildNavigation(
  currentPath: string,
  user: PrincipalContext,
): Promise<NavigationSection[]> {
  const accessibleProducts = await getAuthorizationService().listAccessibleProducts(user);
  const projectTrees = accessibleProducts.includes("seo-monitor")
    ? await getProjectService().listProjectTreesForUser(user)
    : [];
  const items: NavigationItem[] = projectTrees.map((project) => ({
    href: `/c/${project.projectSlug}/`,
    label: project.name,
    active:
      currentPath === `/c/${project.projectSlug}/` ||
      currentPath.startsWith(`/c/${project.projectSlug}/`),
    children: project.sites.map((site) => ({
      href: `/c/${project.projectSlug}/${site.siteSlug}/`,
      label: site.name,
      active: currentPath === `/c/${project.projectSlug}/${site.siteSlug}/`,
      muted: !site.enabled,
    })),
  }));

  const hasGlobalProjectAccess = user.kind === "platform-admin";
  const rootHref = hasGlobalProjectAccess ? "/analyst/" : "/dashboard/";
  const rootLabel = hasGlobalProjectAccess ? "Все проекты" : "Мои проекты";

  const productItems: NavigationItem[] = [];
  if (accessibleProducts.includes("seo-monitor")) {
    const seo = getProductDefinition("seo-monitor");
    productItems.push({ href: seo.homeHref, label: seo.label, active: currentPath.startsWith(seo.homeHref) || currentPath.startsWith("/c/") });
  }
  if (accessibleProducts.includes("tools")) {
    const tools = getProductDefinition("tools");
    const research = getToolDefinition("research");
    productItems.push({ href: research.href, label: tools.label, active: currentPath.startsWith(tools.homeHref), children: [{ href: research.href, label: research.label, active: currentPath.startsWith(research.href) }] });
  }

  return [
    {
      title: "Система",
      items: [
        ...(accessibleProducts.includes("seo-monitor") ? [{ href: rootHref, label: rootLabel, active: currentPath === rootHref }] : []),
        ...(hasPermission(user, "platform:manage")
          ? [
              {
                href: "/admin/organizations/",
                label: "Администрирование",
                active: currentPath.startsWith("/admin/"),
              },
            ]
          : []),
        ...(user.kind === "platform-admin" || user.kind === "platform-analyst" || (user.kind === "identity-user" && user.systemRole === "ANALYST")
          ? [{ href: "/notifications/", label: "Уведомления", active: currentPath.startsWith("/notifications/") }]
          : []),
      ],
    },
    ...(productItems.length ? [{ title: "Продукты", items: productItems }] : []),
    ...(items.length ? [{ title: "SEO-проекты", items }] : []),
  ];
}
