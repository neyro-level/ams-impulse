export const PRODUCT_CODES = ["seo-monitor", "leads", "tools"] as const;
export type ProductCode = (typeof PRODUCT_CODES)[number];

export function isProductCode(value: string): value is ProductCode {
  return PRODUCT_CODES.some((product) => product === value);
}

export const PRODUCT_ROLES = ["VIEWER", "OPERATOR", "ANALYST"] as const;
export type ProductRole = (typeof PRODUCT_ROLES)[number];

export const PRODUCT_PERMISSIONS = [
  "seo:project:read",
  "seo:report:read",
  "seo:project:operate",
  "leads:project:read",
  "leads:project:operate",
  "tools:project:read",
  "research:create",
  "research:update",
  "research:estimate",
  "research:run",
  "research:export",
] as const;
export type ProductPermission = (typeof PRODUCT_PERMISSIONS)[number];

export type ResourceRef = {
  product: string;
  organizationId: string;
  projectId: string;
  resourceType?: string;
  resourceId?: string;
};

export type AuthorizationDecision =
  | { allowed: true; role: "PLATFORM_ADMIN" | ProductRole }
  | {
      allowed: false;
      code: "ACCESS_DENIED" | "RESOURCE_SCOPE_REQUIRED" | "UNKNOWN_PRODUCT";
    };

export type ProductProjectGrant = {
  product: ProductCode;
  organizationId: string;
  projectId: string;
  role: ProductRole;
};
