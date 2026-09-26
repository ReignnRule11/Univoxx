import { prisma } from "@/lib/db";
import type { AiJobRecord, AiJobStatus, AiUsageRecord } from "./types";

export type CreateAiJobInput = {
  userId: string;
  kind: string;
  status?: AiJobStatus;
  promptHash?: string | null;
};

export type UpdateAiJobInput = Partial<
  Pick<AiJobRecord, "status" | "provider" | "model" | "inputTokens" | "outputTokens" | "errorCode" | "completedAt">
>;

export type CreateAiUsageInput = {
  userId: string;
  jobId?: string | null;
  provider: string;
  model: string;
  kind: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: string;
};

export type AiStore = {
  createJob(input: CreateAiJobInput): Promise<AiJobRecord>;
  updateJob(id: string, data: UpdateAiJobInput): Promise<AiJobRecord>;
  listJobs(userId: string): Promise<AiJobRecord[]>;
  createUsage(input: CreateAiUsageInput): Promise<AiUsageRecord>;
  listUsage(userId: string): Promise<AiUsageRecord[]>;
};

export const prismaAiStore: AiStore = {
  async createJob(input) {
    return prisma.aiJob.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        status: input.status ?? "QUEUED",
        promptHash: input.promptHash ?? null,
      },
    });
  },
  async updateJob(id, data) {
    return prisma.aiJob.update({ where: { id }, data });
  },
  async listJobs(userId) {
    return prisma.aiJob.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  },
  async createUsage(input) {
    return prisma.aiUsage.create({
      data: {
        userId: input.userId,
        jobId: input.jobId ?? null,
        provider: input.provider,
        model: input.model,
        kind: input.kind,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        latencyMs: input.latencyMs,
        status: input.status,
      },
    });
  },
  async listUsage(userId) {
    return prisma.aiUsage.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  },
};

let activeStore: AiStore = prismaAiStore;

export function getAiStore(): AiStore {
  return activeStore;
}

export function setAiStore(store: AiStore): void {
  activeStore = store;
}

export function resetAiStore(): void {
  activeStore = prismaAiStore;
}
