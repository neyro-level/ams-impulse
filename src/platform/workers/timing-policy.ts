export const RESEARCH_WORKER_POLL_DELAY_MS = 5_000;
export const RESEARCH_HEARTBEAT_WRITE_INTERVAL_MS = 60_000;
export const RESEARCH_HEARTBEAT_STALE_MS = 180_000;
export const RESEARCH_JOB_EXPIRE_IN_SECONDS = 900;
export const RESEARCH_STALE_RUN_AFTER_MS = 20 * 60_000;

// Paid provider effects are not retried by the queue. A new attempt requires
// explicit recovery after the persisted run has reached a safe terminal state.
export const RESEARCH_JOB_RETRY_LIMIT = 0;
export const RESEARCH_JOB_RETRY_DELAY_SECONDS = 0;
