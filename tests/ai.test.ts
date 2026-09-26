import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { GET as listAi, POST as refuseAi } from "@/app/api/v1/ai/route";
import { POST as captions } from "@/app/api/v1/ai/captions/route";
import { POST as repurpose } from "@/app/api/v1/ai/repurpose/route";
import { POST as explain } from "@/app/api/v1/ai/analytics/explain/route";
import { GET as usage } from "@/app/api/v1/ai/usage/route";
import { POST as createContent } from "@/app/api/v1/content/route";
import { POST as createEvent } from "@/app/api/v1/events/route";
import { POST as publishEvent } from "@/app/api/v1/events/[eventId]/publish/route";
import { POST as startEvent } from "@/app/api/v1/events/[eventId]/start/route";
import { POST as endEvent } from "@/app/api/v1/events/[eventId]/end/route";
import { POST as createTranscript } from "@/app/api/v1/events/[eventId]/transcripts/route";
import { POST as summarizeTranscript } from "@/app/api/v1/events/[eventId]/transcripts/[transcriptId]/summary/route";
import { HttpAiProvider, type AiCompletionRequest, type AiProvider, resetAiProvider, setAiProvider } from "@/lib/ai";
import { resetLiveRoomProvider } from "@/lib/live";
import { resetRateLimitStore } from "@/lib/security";
import { resetAiStore, setAiStore } from "@/modules/ai/store";
import { resetCommunityStore, setCommunityStore } from "@/modules/community/store";
import { resetContentStore, setContentStore } from "@/modules/content/store";
import { resetEventsStore, setEventsStore } from "@/modules/events/store";
import { resetIdentityStore, setIdentityStore } from "@/modules/identity/store";
import { resetPaymentsStore, setPaymentsStore } from "@/modules/payments/store";
import { createAiMemoryStore } from "./helpers/ai-memory-store";
import { createCommunityMemoryStore } from "./helpers/community-memory-store";
import { createContentMemoryStore } from "./helpers/content-memory-store";
import { createEventsMemoryStore } from "./helpers/events-memory-store";
import { emptyRouteContext, routeContext } from "./helpers/invoke";
import { createMemoryStore } from "./helpers/memory-store";
import { createPaymentsMemoryStore } from "./helpers/payments-memory-store";

const PASSWORD = "creator-pass-1";

type AuthPayload = {
  user: { id: string; email: string };
  tokens: { accessToken: string };
};

function jsonRequest(url: string, method: string, body?: unknown, token?: string): Request {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function registerUser(email: string, displayName = "Creator"): Promise<AuthPayload> {
  const response = await register(
    jsonRequest("http://localhost/api/v1/auth/register", "POST", { email, password: PASSWORD, displayName }),
    emptyRouteContext,
  );
  expect(response.status).toBe(201);
  return (await response.json()) as AuthPayload;
}

class ScriptedAiProvider implements AiProvider {
  readonly name = "openai" as const;
  readonly calls: AiCompletionRequest[] = [];
  constructor(private readonly impl: (request: AiCompletionRequest) => Promise<{ text: string; inputTokens?: number; outputTokens?: number }>) {}
  async complete(request: AiCompletionRequest) {
    this.calls.push(request);
    const result = await this.impl(request);
    return {
      provider: this.name,
      model: request.model ?? "gpt-test",
      text: result.text,
      inputTokens: result.inputTokens ?? 11,
      outputTokens: result.outputTokens ?? 7,
    };
  }
}

describe("ai", () => {
  beforeEach(() => {
    resetRateLimitStore();
    setIdentityStore(createMemoryStore());
    setCommunityStore(createCommunityMemoryStore());
    setContentStore(createContentMemoryStore());
    setPaymentsStore(createPaymentsMemoryStore());
    setEventsStore(createEventsMemoryStore());
    setAiStore(createAiMemoryStore());
    resetLiveRoomProvider();
    resetAiProvider();
  });

  afterEach(() => {
    resetIdentityStore();
    resetCommunityStore();
    resetContentStore();
    resetPaymentsStore();
    resetEventsStore();
    resetAiStore();
    resetLiveRoomProvider();
    resetAiProvider();
    resetRateLimitStore();
  });

  it("reports unavailable configuration instead of fake output", async () => {
    const user = await registerUser("creator@univox.test");
    const response = await captions(
      jsonRequest("http://localhost/api/v1/ai/captions", "POST", { text: "Hello world" }, user.tokens.accessToken),
      emptyRouteContext,
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SERVICE_UNAVAILABLE", message: "AI provider is not configured" },
    });
  });

  it("generates captions through the provider abstraction and tracks usage", async () => {
    const user = await registerUser("creator@univox.test");
    const provider = new ScriptedAiProvider(async () => ({ text: "Caption one\nCaption two\nCaption three" }));
    setAiProvider(provider);
    const response = await captions(
      jsonRequest("http://localhost/api/v1/ai/captions", "POST", { text: "Launch day", tone: "bold" }, user.tokens.accessToken),
      emptyRouteContext,
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.kind).toBe("captions");
    expect(body.output).toContain("Caption one");
    expect(body.job.status).toBe("SUCCEEDED");
    expect(provider.calls).toHaveLength(1);
    const listed = await usage(
      jsonRequest("http://localhost/api/v1/ai/usage", "GET", undefined, user.tokens.accessToken),
      emptyRouteContext,
    );
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({
      usage: [{ kind: "captions", jobs: 1, inputTokens: 11, outputTokens: 7 }],
    });
  });

  it("authorizes content-owned caption generation and rejects other users' content", async () => {
    const owner = await registerUser("owner@univox.test");
    const stranger = await registerUser("stranger@univox.test", "Stranger");
    const created = await createContent(
      jsonRequest(
        "http://localhost/api/v1/content",
        "POST",
        { type: "TEXT", title: "Mine", body: "Owned body", visibility: "PRIVATE" },
        owner.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const contentId = ((await created.json()) as { content: { id: string } }).content.id;
    setAiProvider(new ScriptedAiProvider(async () => ({ text: "ok" })));
    const denied = await captions(
      jsonRequest("http://localhost/api/v1/ai/captions", "POST", { contentId }, stranger.tokens.accessToken),
      emptyRouteContext,
    );
    expect(denied.status).toBe(403);
    const allowed = await captions(
      jsonRequest("http://localhost/api/v1/ai/captions", "POST", { contentId }, owner.tokens.accessToken),
      emptyRouteContext,
    );
    expect(allowed.status).toBe(201);
  });

  it("repurposes content and explains analytics without touching financial records", async () => {
    const user = await registerUser("creator@univox.test");
    setAiProvider(
      new ScriptedAiProvider(async (request) => ({
        text: request.kind === "repurpose" ? "Thread: 1. Launch" : "You published content and have no succeeded payouts to move.",
      })),
    );
    const reused = await repurpose(
      jsonRequest("http://localhost/api/v1/ai/repurpose", "POST", { text: "Launch notes", format: "thread" }, user.tokens.accessToken),
      emptyRouteContext,
    );
    expect(reused.status).toBe(201);
    const explained = await explain(
      jsonRequest("http://localhost/api/v1/ai/analytics/explain", "POST", { question: "How am I doing?" }, user.tokens.accessToken),
      emptyRouteContext,
    );
    expect(explained.status).toBe(201);
    const refused = await refuseAi(
      jsonRequest("http://localhost/api/v1/ai", "POST", { action: "transfer", amountCents: 5000 }, user.tokens.accessToken),
      emptyRouteContext,
    );
    expect(refused.status).toBe(403);
  });

  it("summarizes a real event transcript and rejects invalid provider output", async () => {
    const host = await registerUser("host@univox.test");
    const created = await createEvent(
      jsonRequest(
        "http://localhost/api/v1/events",
        "POST",
        { title: "Live", startsAt: new Date(Date.now() + 3600_000).toISOString() },
        host.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const eventId = ((await created.json()) as { event: { id: string } }).event.id;
    await publishEvent(jsonRequest(`http://localhost/api/v1/events/${eventId}/publish`, "POST", {}, host.tokens.accessToken), routeContext({ eventId }));
    await startEvent(jsonRequest(`http://localhost/api/v1/events/${eventId}/start`, "POST", {}, host.tokens.accessToken), routeContext({ eventId }));
    await endEvent(jsonRequest(`http://localhost/api/v1/events/${eventId}/end`, "POST", {}, host.tokens.accessToken), routeContext({ eventId }));
    const transcript = await createTranscript(
      jsonRequest(
        `http://localhost/api/v1/events/${eventId}/transcripts`,
        "POST",
        { text: "Welcome everyone. We shipped captions today." },
        host.tokens.accessToken,
      ),
      routeContext({ eventId }),
    );
    const transcriptId = ((await transcript.json()) as { transcript: { id: string } }).transcript.id;
    setAiProvider(new ScriptedAiProvider(async () => ({ text: "   " })));
    const invalid = await summarizeTranscript(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/transcripts/${transcriptId}/summary`, "POST", {}, host.tokens.accessToken),
      routeContext({ eventId, transcriptId }),
    );
    expect(invalid.status).toBe(400);
    setAiProvider(new ScriptedAiProvider(async () => ({ text: "The host recapped a captions launch." })));
    const summarized = await summarizeTranscript(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/transcripts/${transcriptId}/summary`, "POST", {}, host.tokens.accessToken),
      routeContext({ eventId, transcriptId }),
    );
    expect(summarized.status).toBe(200);
    await expect(summarized.json()).resolves.toMatchObject({
      transcript: { summary: "The host recapped a captions launch.", jobStatus: "SUCCEEDED" },
    });
  });

  it("times out a hanging provider and records a failed job", async () => {
    const user = await registerUser("creator@univox.test");
    setAiProvider(
      new HttpAiProvider("openai", {
        apiKey: "test",
        model: "gpt-test",
        timeoutMs: 20,
        maxRetries: 0,
        complete: async ({ signal }) => {
          const abort = () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            throw error;
          };
          if (signal.aborted) {
            abort();
          }
          return new Promise((_, reject) => {
            signal.addEventListener("abort", () => {
              const error = new Error("Aborted");
              error.name = "AbortError";
              reject(error);
            });
          });
        },
      }),
    );
    const response = await captions(
      jsonRequest("http://localhost/api/v1/ai/captions", "POST", { text: "timeout please" }, user.tokens.accessToken),
      emptyRouteContext,
    );
    expect(response.status).toBe(503);
    const jobs = await listAi(jsonRequest("http://localhost/api/v1/ai", "GET", undefined, user.tokens.accessToken), emptyRouteContext);
    const body = await jobs.json();
    expect(body.jobs[0].status).toBe("FAILED");
  });
});
