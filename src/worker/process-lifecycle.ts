import { closePrismaClient } from "../platform/database/prisma/client.ts";

type WorkerTask = () => Promise<void>;
type WorkerCleanup = () => Promise<void>;

export async function runWorkerProcess(
  task: WorkerTask,
  cleanup: WorkerCleanup = closePrismaClient,
): Promise<void> {
  try {
    await task();
  } finally {
    await cleanup();
  }
}
