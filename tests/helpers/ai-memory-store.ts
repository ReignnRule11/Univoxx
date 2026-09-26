import type { CreateAiJobInput, CreateAiUsageInput, AiStore, UpdateAiJobInput } from "@/modules/ai/store";
import type { AiJobRecord, AiUsageRecord } from "@/modules/ai/types";

function now(): Date {
  return new Date();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createAiMemoryStore(): AiStore {
  const jobs = new Map<string, AiJobRecord>();
  const usages = new Map<string, AiUsageRecord>();

  return {
    async createJob(input: CreateAiJobInput) {
      const created: AiJobRecord = {
        id: id("aijob"),
        userId: input.userId,
        kind: input.kind,
        status: input.status ?? "QUEUED",
        provider: null,
        model: null,
        promptHash: input.promptHash ?? null,
        inputTokens: null,
        outputTokens: null,
        errorCode: null,
        createdAt: now(),
        updatedAt: now(),
        completedAt: null,
      };
      jobs.set(created.id, created);
      return created;
    },
    async updateJob(jobId, data: UpdateAiJobInput) {
      const current = jobs.get(jobId);
      if (!current) {
        throw new Error("AI job not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      jobs.set(jobId, updated);
      return updated;
    },
    async listJobs(userId) {
      return [...jobs.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async createUsage(input: CreateAiUsageInput) {
      const created: AiUsageRecord = {
        id: id("aiusage"),
        userId: input.userId,
        jobId: input.jobId ?? null,
        provider: input.provider,
        model: input.model,
        kind: input.kind,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        latencyMs: input.latencyMs,
        status: input.status,
        createdAt: now(),
      };
      usages.set(created.id, created);
      return created;
    },
    async listUsage(userId) {
      return [...usages.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
  };
}
