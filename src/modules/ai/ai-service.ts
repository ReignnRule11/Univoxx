import { createHash } from "node:crypto";
import { type AiKind, getAiProvider } from "@/lib/ai";
import { AppError, forbidden, notFound, serviceUnavailable, validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requireContentOwner } from "@/modules/content/authorization";
import { getContentStore } from "@/modules/content/store";
import { requireEventHost } from "@/modules/events/authorization";
import { getEventsStore } from "@/modules/events/store";
import { publicTranscript } from "@/modules/events/serializers";
import type { PublicTranscript } from "@/modules/events/types";
import type { UserRecord } from "@/modules/identity/types";
import { getPaymentsStore } from "@/modules/payments/store";
import { publicAiJob } from "./serializers";
import { getAiStore } from "./store";
import type { PublicAiGeneration, PublicAiJob, PublicAiUsage } from "./types";

const SYSTEM_GUARD =
  "You assist Univox creators with drafting captions, repurposing content, summarizing event transcripts, and explaining creator analytics. You must not transfer money, modify financial records, change ownership, delete records, bypass authorization, or claim a payment succeeded. If asked to do those things, refuse.";

function hashPrompt(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validateOutput(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw validationError("AI provider returned an empty response");
  }
  return trimmed;
}

async function sourceText(user: UserRecord, input: { contentId?: string; text?: string }): Promise<string> {
  if (input.contentId) {
    const content = await requireContentOwner(input.contentId, user.id);
    const body = [content.title, content.body].filter(Boolean).join("\n");
    if (!body.trim()) {
      throw validationError("Content has no text to process");
    }
    return body;
  }
  if (!input.text?.trim()) {
    throw validationError("text is required");
  }
  return input.text.trim();
}

async function runGeneration(
  user: UserRecord,
  kind: AiKind,
  prompt: string,
): Promise<PublicAiGeneration> {
  const store = getAiStore();
  const job = await store.createJob({
    userId: user.id,
    kind,
    status: "QUEUED",
    promptHash: hashPrompt(prompt),
  });
  await store.updateJob(job.id, { status: "RUNNING" });
  const started = Date.now();
  try {
    const provider = getAiProvider();
    const result = await provider.complete({
      kind,
      system: SYSTEM_GUARD,
      prompt,
    });
    const output = validateOutput(result.text);
    const completed = await store.updateJob(job.id, {
      status: "SUCCEEDED",
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      completedAt: new Date(),
    });
    await store.createUsage({
      userId: user.id,
      jobId: completed.id,
      provider: result.provider,
      model: result.model,
      kind,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: Date.now() - started,
      status: "SUCCEEDED",
    });
    logger.info(
      { jobId: completed.id, kind, provider: result.provider, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens },
      "ai generation succeeded",
    );
    return {
      job: publicAiJob(completed),
      kind,
      output,
      provider: result.provider,
      model: result.model,
    };
  } catch (error) {
    const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
    await store.updateJob(job.id, {
      status: "FAILED",
      errorCode: code,
      completedAt: new Date(),
    });
    await store.createUsage({
      userId: user.id,
      jobId: job.id,
      provider: "none",
      model: "none",
      kind,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - started,
      status: "FAILED",
    });
    logger.warn({ jobId: job.id, kind, code }, "ai generation failed");
    if (error instanceof AppError) {
      throw error;
    }
    throw serviceUnavailable("AI provider is unavailable");
  }
}

export async function generateCaptions(
  user: UserRecord,
  input: { contentId?: string; text?: string; tone?: string },
): Promise<PublicAiGeneration> {
  const source = await sourceText(user, input);
  const tone = input.tone ? `Tone: ${input.tone}.` : "Tone: natural and specific.";
  return runGeneration(
    user,
    "captions",
    `${tone}\nWrite 3 short social captions for this creator content. Do not invent facts.\n\n${source}`,
  );
}

export async function repurposeContent(
  user: UserRecord,
  input: { contentId?: string; text?: string; format?: "thread" | "newsletter" | "short" },
): Promise<PublicAiGeneration> {
  const source = await sourceText(user, input);
  const format = input.format ?? "thread";
  return runGeneration(
    user,
    "repurpose",
    `Repurpose the following creator content as a ${format}. Keep claims grounded in the source. Do not add calls to transfer money or change account settings.\n\n${source}`,
  );
}

export async function explainCreatorAnalytics(
  user: UserRecord,
  question?: string,
): Promise<PublicAiGeneration> {
  const [content, events, earnings] = await Promise.all([
    getContentStore().listContentByAuthor(user.id),
    getEventsStore().listEventsByHost(user.id),
    getPaymentsStore().listTransactionsByRecipient(user.id),
  ]);
  const succeeded = earnings.filter((row) => row.status === "SUCCEEDED");
  const snapshot = {
    contentCount: content.length,
    publishedCount: content.filter((row) => row.status === "PUBLISHED").length,
    eventCount: events.length,
    liveCount: events.filter((row) => row.status === "LIVE" || row.status === "ENDED").length,
    succeededPayments: succeeded.length,
    grossRevenueCents: succeeded.reduce((sum, row) => sum + row.amountCents, 0),
  };
  return runGeneration(
    user,
    "analytics_explain",
    `Explain these creator stats in plain language. Do not recommend transferring money, changing ownership, or deleting records. Question: ${question ?? "What stands out?"}\n\n${JSON.stringify(snapshot)}`,
  );
}

export async function summarizeEventTranscript(
  user: UserRecord,
  eventId: string,
  transcriptId: string,
): Promise<PublicTranscript> {
  const event = await requireEventHost(eventId, user.id);
  const transcripts = await getEventsStore().listTranscripts(event.id);
  const current = transcripts.find((row) => row.id === transcriptId);
  if (!current) {
    throw notFound("Transcript not found");
  }
  if (event.hostId !== user.id) {
    throw forbidden("Only the event host can summarize this transcript");
  }
  await getEventsStore().updateTranscript(current.id, { jobStatus: "RUNNING" });
  try {
    const generation = await runGeneration(
      user,
      "event_summary",
      `Summarize this event transcript for the host. Do not invent attendees, payments, or outcomes that are not in the text.\n\n${current.text}`,
    );
    const updated = await getEventsStore().updateTranscript(current.id, {
      summary: generation.output,
      jobStatus: "SUCCEEDED",
    });
    return publicTranscript(updated);
  } catch (error) {
    await getEventsStore().updateTranscript(current.id, { jobStatus: "FAILED" });
    throw error;
  }
}

export async function listOwnJobs(userId: string): Promise<PublicAiJob[]> {
  const jobs = await getAiStore().listJobs(userId);
  return jobs.map(publicAiJob);
}

export async function listOwnUsage(userId: string): Promise<PublicAiUsage[]> {
  const rows = await getAiStore().listUsage(userId);
  const byKind = new Map<string, PublicAiUsage>();
  for (const row of rows) {
    const current = byKind.get(row.kind) ?? { kind: row.kind, jobs: 0, inputTokens: 0, outputTokens: 0 };
    current.jobs += 1;
    current.inputTokens += row.inputTokens;
    current.outputTokens += row.outputTokens;
    byKind.set(row.kind, current);
  }
  return [...byKind.values()];
}

export function refuseFinancialAuthority(): never {
  throw forbidden("AI cannot transfer money, modify financial records, or change ownership");
}
