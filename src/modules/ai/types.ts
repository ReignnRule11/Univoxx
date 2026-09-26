import type { AiKind, AiProviderName } from "@/lib/ai";

export const AI_JOB_STATUSES = ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

export type AiJobRecord = {
  id: string;
  userId: string;
  kind: string;
  status: AiJobStatus;
  provider: string | null;
  model: string | null;
  promptHash: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type AiUsageRecord = {
  id: string;
  userId: string;
  jobId: string | null;
  provider: string;
  model: string;
  kind: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: string;
  createdAt: Date;
};

export type PublicAiJob = {
  id: string;
  kind: string;
  status: AiJobStatus;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
  completedAt: string | null;
};

export type PublicAiGeneration = {
  job: PublicAiJob;
  kind: AiKind;
  output: string;
  provider: AiProviderName;
  model: string;
};

export type PublicAiUsage = {
  kind: string;
  jobs: number;
  inputTokens: number;
  outputTokens: number;
};
