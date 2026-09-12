import "server-only";

import { ReliabilityService } from "./application/reliability-service.ts";
import { PrismaReliabilityRepository } from "./infrastructure/prisma-reliability-repository.ts";

export { PrismaReliabilityRepository } from "./infrastructure/prisma-reliability-repository.ts";
export { ReliabilityService } from "./application/reliability-service.ts";
export {
  listOperations,
  requestProjectSync,
} from "./infrastructure/platform-admin-runtime.ts";
export { getOperationalReadiness } from "./infrastructure/readiness-runtime.ts";

let reliabilityService: ReliabilityService | null = null;

export function getReliabilityService() {
  reliabilityService ??= new ReliabilityService(new PrismaReliabilityRepository());
  return reliabilityService;
}
