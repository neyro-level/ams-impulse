import "server-only";

import { fetchClientMetadataResource } from "@better-auth/cimd/node";

const FORBIDDEN_SELF_ASSERTED_SOFTWARE_FIELDS = new Set([
  "software_id",
  "software_version",
  "software_statement",
]);

export function createMcpMetadataTransport(
  transport: typeof fetchClientMetadataResource,
): typeof fetchClientMetadataResource {
  return async (input, init) => {
    const response = await transport(input, init);
    if (!response.ok) return response;
    const contentType = response.headers.get("content-type") ?? "";
    if (!/^application\/(?:[-\w.]+\+)?json\s*(?:;|$)/i.test(contentType)) {
      return response;
    }
    let document: unknown;
    try {
      document = await response.clone().json();
    } catch {
      return response;
    }
    if (
      document &&
      typeof document === "object" &&
      Object.keys(document).some((field) => FORBIDDEN_SELF_ASSERTED_SOFTWARE_FIELDS.has(field))
    ) {
      return new Response(null, { status: 422 });
    }
    return response;
  };
}

export const fetchApprovedMcpClientMetadataResource = createMcpMetadataTransport(
  fetchClientMetadataResource,
);
