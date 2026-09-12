export type ResearchLifecycleEvent = "started" | "completed" | "partial" | "failed" | "action_required";

export interface ResearchLifecycleNotification {
  event: ResearchLifecycleEvent;
  runId: string;
  organizationId: string;
  projectId: string;
  researchId: string;
}

export interface ResearchLifecyclePublisher {
  publish(input: ResearchLifecycleNotification): Promise<void>;
}

export const silentResearchLifecyclePublisher: ResearchLifecyclePublisher = {
  async publish() { return; },
};
