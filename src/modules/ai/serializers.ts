import type { AiJobRecord, PublicAiJob } from "./types";

export function publicAiJob(job: AiJobRecord): PublicAiJob {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    provider: job.provider,
    model: job.model,
    inputTokens: job.inputTokens,
    outputTokens: job.outputTokens,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
  };
}
