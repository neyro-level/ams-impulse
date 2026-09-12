import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const proofSchema = z.object({
  kind: z.enum(["backup", "live"]),
  status: z.literal("passed"),
  occurredAt: z.string().datetime(),
  releaseSha: z.string().regex(/^[0-9a-f]{40}$/),
});

export type OperationalProof = z.infer<typeof proofSchema>;

export async function readOperationalProof(
  kind: OperationalProof["kind"],
  root = process.env.OPERATIONAL_PROOF_ROOT?.trim() || "/run/ams-platform-proofs",
): Promise<OperationalProof | null> {
  try {
    const parsed = proofSchema.parse(JSON.parse(await readFile(join(root, `${kind}.json`), "utf8")));
    return parsed.kind === kind ? parsed : null;
  } catch {
    return null;
  }
}
