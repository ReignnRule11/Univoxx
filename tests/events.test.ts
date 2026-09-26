import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { POST as createCommunity } from "@/app/api/v1/communities/route";
import { POST as addCommunityMember } from "@/app/api/v1/communities/[communityId]/members/route";
import { GET as listEvents, POST as createEvent } from "@/app/api/v1/events/route";
import { GET as getEvent, PATCH as patchEvent } from "@/app/api/v1/events/[eventId]/route";
import { POST as publishEvent } from "@/app/api/v1/events/[eventId]/publish/route";
import { POST as cancelEvent } from "@/app/api/v1/events/[eventId]/cancel/route";
import { POST as startEvent } from "@/app/api/v1/events/[eventId]/start/route";
import { POST as endEvent } from "@/app/api/v1/events/[eventId]/end/route";
import { POST as registerEvent } from "@/app/api/v1/events/[eventId]/register/route";
import { GET as listAttendees } from "@/app/api/v1/events/[eventId]/attendees/route";
import { POST as checkIn, DELETE as leaveEvent } from "@/app/api/v1/events/[eventId]/attendance/route";
import { GET as listChat, POST as postChat } from "@/app/api/v1/events/[eventId]/chat/route";
import { GET as listRecordings, POST as postRecording } from "@/app/api/v1/events/[eventId]/recordings/route";
import { GET as getRecording } from "@/app/api/v1/events/[eventId]/recordings/[recordingId]/route";
import { POST as createTranscript } from "@/app/api/v1/events/[eventId]/transcripts/route";
import { POST as summarizeTranscript } from "@/app/api/v1/events/[eventId]/transcripts/[transcriptId]/summary/route";
import { POST as createProduct } from "@/app/api/v1/products/route";
import { POST as initiatePayment } from "@/app/api/v1/payments/route";
import { POST as paymentWebhook } from "@/app/api/v1/payments/webhooks/route";
import { resetAiProvider } from "@/lib/ai";
import { resetLiveRoomProvider } from "@/lib/live";
import { resetPaymentProvider, signSandboxWebhook } from "@/lib/payments";
import { resetRateLimitStore } from "@/lib/security";
import { MemoryStorageProvider, resetStorageProvider, setStorageProvider } from "@/lib/storage";
import { resetAiStore, setAiStore } from "@/modules/ai/store";
import { resetCommunityStore, setCommunityStore } from "@/modules/community/store";
import { resetEventsStore, setEventsStore } from "@/modules/events/store";
import { resetIdentityStore, setIdentityStore } from "@/modules/identity/store";
import { resetPaymentsStore, setPaymentsStore } from "@/modules/payments/store";
import { createAiMemoryStore } from "./helpers/ai-memory-store";
import { createCommunityMemoryStore } from "./helpers/community-memory-store";
import { createEventsMemoryStore } from "./helpers/events-memory-store";
import { emptyRouteContext, routeContext } from "./helpers/invoke";
import { createMemoryStore } from "./helpers/memory-store";
import { createPaymentsMemoryStore } from "./helpers/payments-memory-store";

const PASSWORD = "creator-pass-1";
const WEBHOOK_SECRET = "test-payments-webhook-secret";

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

function startsAt(hours = 1): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function hostPublishedEvent(token: string, extra: Record<string, unknown> = {}) {
  const created = await createEvent(
    jsonRequest(
      "http://localhost/api/v1/events",
      "POST",
      { title: "Live Session", description: "MVP live", startsAt: startsAt(), ...extra },
      token,
    ),
    emptyRouteContext,
  );
  expect(created.status).toBe(201);
  const body = await created.json();
  const eventId = body.event.id as string;
  const published = await publishEvent(
    jsonRequest(`http://localhost/api/v1/events/${eventId}/publish`, "POST", {}, token),
    routeContext({ eventId }),
  );
  expect(published.status).toBe(200);
  return { eventId, event: (await published.json()).event };
}

describe("events", () => {
  beforeEach(() => {
    resetRateLimitStore();
    setIdentityStore(createMemoryStore());
    setCommunityStore(createCommunityMemoryStore());
    setPaymentsStore(createPaymentsMemoryStore());
    setEventsStore(createEventsMemoryStore());
    setAiStore(createAiMemoryStore());
    setStorageProvider(new MemoryStorageProvider());
    resetLiveRoomProvider();
    resetPaymentProvider();
    resetAiProvider();
  });

  afterEach(() => {
    resetIdentityStore();
    resetCommunityStore();
    resetPaymentsStore();
    resetEventsStore();
    resetAiStore();
    resetStorageProvider();
    resetLiveRoomProvider();
    resetPaymentProvider();
    resetAiProvider();
    resetRateLimitStore();
  });

  it("creates, edits, publishes, starts, ends, and cancels events as host", async () => {
    const host = await registerUser("host@univox.test");
    const created = await createEvent(
      jsonRequest(
        "http://localhost/api/v1/events",
        "POST",
        { title: "Draft Live", startsAt: startsAt(), accessType: "FREE", capacity: 20 },
        host.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.event.status).toBe("DRAFT");
    expect(createdBody.event.hostId).toBe(host.user.id);
    const eventId = createdBody.event.id as string;
    const patched = await patchEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}`, "PATCH", { title: "Updated Live" }, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(patched.status).toBe(200);
    await expect(patched.json()).resolves.toMatchObject({ event: { title: "Updated Live" } });
    const published = await publishEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/publish`, "POST", {}, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(published.status).toBe(200);
    await expect(published.json()).resolves.toMatchObject({ event: { status: "SCHEDULED" } });
    const started = await startEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/start`, "POST", {}, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(started.status).toBe(200);
    const startedBody = await started.json();
    expect(startedBody.event.status).toBe("LIVE");
    expect(startedBody.room.role).toBe("host");
    expect(startedBody.room.provider).toBe("local");
    const ended = await endEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/end`, "POST", {}, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(ended.status).toBe(200);
    await expect(ended.json()).resolves.toMatchObject({ event: { status: "ENDED" } });
    const listed = await listEvents(
      jsonRequest("http://localhost/api/v1/events", "GET", undefined, host.tokens.accessToken),
      emptyRouteContext,
    );
    expect(listed.status).toBe(200);
    const other = await hostPublishedEvent(host.tokens.accessToken, { title: "Cancel me" });
    const cancelled = await cancelEvent(
      jsonRequest(`http://localhost/api/v1/events/${other.eventId}/cancel`, "POST", {}, host.tokens.accessToken),
      routeContext({ eventId: other.eventId }),
    );
    expect(cancelled.status).toBe(200);
    await expect(cancelled.json()).resolves.toMatchObject({ event: { status: "CANCELLED" } });
  });

  it("enforces host-only management and hides drafts from strangers", async () => {
    const host = await registerUser("host@univox.test");
    const stranger = await registerUser("stranger@univox.test", "Stranger");
    const created = await createEvent(
      jsonRequest("http://localhost/api/v1/events", "POST", { title: "Private", startsAt: startsAt() }, host.tokens.accessToken),
      emptyRouteContext,
    );
    const eventId = ((await created.json()) as { event: { id: string } }).event.id;
    const strangerPatch = await patchEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}`, "PATCH", { title: "Hijack" }, stranger.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(strangerPatch.status).toBe(403);
    const strangerView = await getEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}`, "GET", undefined, stranger.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(strangerView.status).toBe(404);
    const strangerStart = await startEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/start`, "POST", {}, stranger.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(strangerStart.status).toBe(403);
  });

  it("registers attendees for free events and tracks attendance", async () => {
    const host = await registerUser("host@univox.test");
    const fan = await registerUser("fan@univox.test", "Fan");
    const { eventId } = await hostPublishedEvent(host.tokens.accessToken);
    const registered = await registerEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/register`, "POST", {}, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(registered.status).toBe(201);
    await expect(registered.json()).resolves.toMatchObject({ attendee: { status: "REGISTERED", userId: fan.user.id } });
    const duplicate = await registerEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/register`, "POST", {}, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(duplicate.status).toBe(409);
    await startEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/start`, "POST", {}, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    const attendance = await checkIn(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/attendance`, "POST", {}, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(attendance.status).toBe(200);
    const attendanceBody = await attendance.json();
    expect(attendanceBody.attendee.status).toBe("CHECKED_IN");
    expect(attendanceBody.room.role).toBe("attendee");
    const left = await leaveEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/attendance`, "DELETE", undefined, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(left.status).toBe(200);
    await expect(left.json()).resolves.toMatchObject({ attendee: { status: "LEFT" } });
    const attendees = await listAttendees(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/attendees`, "GET", undefined, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(attendees.status).toBe(200);
    const attendeesBody = await attendees.json();
    expect(attendeesBody.attendees).toHaveLength(1);
    const strangerList = await listAttendees(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/attendees`, "GET", undefined, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(strangerList.status).toBe(403);
  });

  it("requires an active subscription for subscriber events", async () => {
    const host = await registerUser("host@univox.test");
    const fan = await registerUser("fan@univox.test", "Fan");
    const { eventId } = await hostPublishedEvent(host.tokens.accessToken, { accessType: "SUBSCRIBER" });
    const denied = await registerEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/register`, "POST", {}, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(denied.status).toBe(403);
    const product = await createProduct(
      jsonRequest(
        "http://localhost/api/v1/products",
        "POST",
        { type: "MEMBERSHIP", name: "Club", amountCents: 1000, currency: "USD" },
        host.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const productId = ((await product.json()) as { product: { id: string } }).product.id;
    const checkout = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId }, fan.tokens.accessToken),
      emptyRouteContext,
    );
    const checkoutBody = await checkout.json();
    const webhook = await paymentWebhook(
      new Request("http://localhost/api/v1/payments/webhooks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-univox-sandbox-signature": signSandboxWebhook(
            WEBHOOK_SECRET,
            JSON.stringify({
              eventId: "evt_sub_1",
              providerReference: checkoutBody.transaction.providerReference,
              outcome: "succeeded",
              amountCents: 1000,
              currency: "USD",
            }),
          ),
        },
        body: JSON.stringify({
          eventId: "evt_sub_1",
          providerReference: checkoutBody.transaction.providerReference,
          outcome: "succeeded",
          amountCents: 1000,
          currency: "USD",
        }),
      }),
      emptyRouteContext,
    );
    expect(webhook.status).toBe(200);
    const allowed = await registerEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/register`, "POST", {}, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(allowed.status).toBe(201);
  });

  it("requires a verified successful payment for paid events", async () => {
    const host = await registerUser("host@univox.test");
    const fan = await registerUser("fan@univox.test", "Fan");
    const { eventId } = await hostPublishedEvent(host.tokens.accessToken, {
      accessType: "PAID",
      priceCents: 1500,
    });
    const unpaid = await registerEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/register`, "POST", {}, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(unpaid.status).toBe(403);
    const product = await createProduct(
      jsonRequest(
        "http://localhost/api/v1/products",
        "POST",
        { type: "MEMBERSHIP", name: "Ticket stand-in", amountCents: 1500, currency: "USD" },
        host.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const productId = ((await product.json()) as { product: { id: string } }).product.id;
    const checkout = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId }, fan.tokens.accessToken),
      emptyRouteContext,
    );
    const checkoutBody = await checkout.json();
    const fakeSuccess = await registerEvent(
      jsonRequest(
        `http://localhost/api/v1/events/${eventId}/register`,
        "POST",
        { transactionId: checkoutBody.transaction.id },
        fan.tokens.accessToken,
      ),
      routeContext({ eventId }),
    );
    expect(fakeSuccess.status).toBe(403);
    const webhookBody = JSON.stringify({
      eventId: "evt_paid_1",
      providerReference: checkoutBody.transaction.providerReference,
      outcome: "succeeded",
      amountCents: 1500,
      currency: "USD",
    });
    const webhook = await paymentWebhook(
      new Request("http://localhost/api/v1/payments/webhooks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-univox-sandbox-signature": signSandboxWebhook(WEBHOOK_SECRET, webhookBody),
        },
        body: webhookBody,
      }),
      emptyRouteContext,
    );
    expect(webhook.status).toBe(200);
    const paid = await registerEvent(
      jsonRequest(
        `http://localhost/api/v1/events/${eventId}/register`,
        "POST",
        { transactionId: checkoutBody.transaction.id },
        fan.tokens.accessToken,
      ),
      routeContext({ eventId }),
    );
    expect(paid.status).toBe(201);
  });

  it("allows live chat only for the host and checked-in attendees", async () => {
    const host = await registerUser("host@univox.test");
    const fan = await registerUser("fan@univox.test", "Fan");
    const { eventId } = await hostPublishedEvent(host.tokens.accessToken);
    await registerEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/register`, "POST", {}, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    const beforeLive = await postChat(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/chat`, "POST", { body: "too soon" }, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(beforeLive.status).toBe(403);
    await startEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/start`, "POST", {}, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    const hostChat = await postChat(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/chat`, "POST", { body: "welcome" }, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(hostChat.status).toBe(201);
    const beforeCheckIn = await postChat(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/chat`, "POST", { body: "hello" }, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(beforeCheckIn.status).toBe(403);
    await checkIn(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/attendance`, "POST", {}, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    const fanChat = await postChat(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/chat`, "POST", { body: "hello" }, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(fanChat.status).toBe(201);
    const listed = await listChat(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/chat`, "GET", undefined, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.messages).toHaveLength(2);
  });

  it("does not claim local recording works and stores uploaded recording metadata", async () => {
    const host = await registerUser("host@univox.test");
    const fan = await registerUser("fan@univox.test", "Fan");
    const { eventId } = await hostPublishedEvent(host.tokens.accessToken);
    await registerEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/register`, "POST", {}, fan.tokens.accessToken),
      routeContext({ eventId }),
    );
    await startEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/start`, "POST", {}, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    const requested = await postRecording(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/recordings`, "POST", {}, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(requested.status).toBe(201);
    await expect(requested.json()).resolves.toMatchObject({ recording: { status: "UNAVAILABLE", provider: "local" } });
    await endEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/end`, "POST", {}, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    const form = new FormData();
    form.set("file", new File([Buffer.from("fake-audio")], "session.webm", { type: "video/webm" }));
    const uploaded = await postRecording(
      new Request(`http://localhost/api/v1/events/${eventId}/recordings`, {
        method: "POST",
        headers: { authorization: `Bearer ${host.tokens.accessToken}` },
        body: form,
      }),
      routeContext({ eventId }),
    );
    expect(uploaded.status).toBe(201);
    const uploadedBody = await uploaded.json();
    expect(uploadedBody.recording.status).toBe("AVAILABLE");
    expect(uploadedBody.recording.downloadPath).toContain("/recordings/");
    const downloaded = await getRecording(
      jsonRequest(
        `http://localhost/api/v1/events/${eventId}/recordings/${uploadedBody.recording.id}`,
        "GET",
        undefined,
        fan.tokens.accessToken,
      ),
      routeContext({ eventId, recordingId: uploadedBody.recording.id }),
    );
    expect(downloaded.status).toBe(200);
    const listed = await listRecordings(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/recordings`, "GET", undefined, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(listed.status).toBe(200);
  });

  it("stores real transcripts and refuses fabricated AI summaries", async () => {
    const host = await registerUser("host@univox.test");
    const { eventId } = await hostPublishedEvent(host.tokens.accessToken);
    await startEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/start`, "POST", {}, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    await endEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/end`, "POST", {}, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    const created = await createTranscript(
      jsonRequest(
        `http://localhost/api/v1/events/${eventId}/transcripts`,
        "POST",
        { text: "Welcome to the live session.", source: "upload" },
        host.tokens.accessToken,
      ),
      routeContext({ eventId }),
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.transcript.text).toBe("Welcome to the live session.");
    expect(createdBody.transcript.summary).toBeNull();
    expect(createdBody.transcript.jobStatus).toBe("QUEUED");
    const summarized = await summarizeTranscript(
      jsonRequest(
        `http://localhost/api/v1/events/${eventId}/transcripts/${createdBody.transcript.id}/summary`,
        "POST",
        {},
        host.tokens.accessToken,
      ),
      routeContext({ eventId, transcriptId: createdBody.transcript.id }),
    );
    expect(summarized.status).toBe(503);
  });

  it("scopes community events to community access", async () => {
    const host = await registerUser("host@univox.test");
    const member = await registerUser("member@univox.test", "Member");
    const outsider = await registerUser("out@univox.test", "Outsider");
    const org = await createOrg(
      jsonRequest("http://localhost/api/v1/organizations", "POST", { name: "Studio", slug: "studio" }, host.tokens.accessToken),
      emptyRouteContext,
    );
    const organizationId = ((await org.json()) as { organization: { id: string } }).organization.id;
    const community = await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId, name: "Inner", slug: "inner", visibility: "PRIVATE" },
        host.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const communityId = ((await community.json()) as { community: { id: string } }).community.id;
    await addCommunityMember(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/members`,
        "POST",
        { userId: member.user.id, role: "MEMBER" },
        host.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    const { eventId } = await hostPublishedEvent(host.tokens.accessToken, { communityId, title: "Members only" });
    const memberReg = await registerEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/register`, "POST", {}, member.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(memberReg.status).toBe(201);
    const outsiderReg = await registerEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/register`, "POST", {}, outsider.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(outsiderReg.status).toBe(403);
  });
});
