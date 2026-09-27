import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { POST as addOrgMember } from "@/app/api/v1/organizations/[organizationId]/members/route";
import { GET as dashboard } from "@/app/api/v1/analytics/route";
import { GET as audience } from "@/app/api/v1/analytics/audience/route";
import { GET as contentMetrics } from "@/app/api/v1/analytics/content/route";
import { GET as communityMetrics } from "@/app/api/v1/analytics/community/route";
import { GET as monetizationMetrics } from "@/app/api/v1/analytics/monetization/route";
import { GET as eventMetrics } from "@/app/api/v1/analytics/events/route";
import { POST as createContent } from "@/app/api/v1/content/route";
import { GET as getContent } from "@/app/api/v1/content/[contentId]/route";
import { POST as publishContent } from "@/app/api/v1/content/[contentId]/publish/route";
import { POST as followCreator } from "@/app/api/v1/creators/[creatorId]/follow/route";
import { POST as createComment } from "@/app/api/v1/content/[contentId]/comments/route";
import { POST as createReaction } from "@/app/api/v1/content/[contentId]/reactions/route";
import { POST as shareContent } from "@/app/api/v1/content/[contentId]/shares/route";
import { POST as createCommunity } from "@/app/api/v1/communities/route";
import { POST as addCommunityMember } from "@/app/api/v1/communities/[communityId]/members/route";
import { POST as createChannel } from "@/app/api/v1/communities/[communityId]/channels/route";
import { POST as createPost } from "@/app/api/v1/communities/[communityId]/channels/[channelId]/posts/route";
import { POST as createCommunityComment } from "@/app/api/v1/communities/[communityId]/posts/[postId]/comments/route";
import { POST as createCommunityReaction } from "@/app/api/v1/communities/[communityId]/reactions/route";
import { POST as createProduct } from "@/app/api/v1/products/route";
import { POST as initiatePayment } from "@/app/api/v1/payments/route";
import { POST as paymentWebhook } from "@/app/api/v1/payments/webhooks/route";
import { GET as getEarnings } from "@/app/api/v1/creators/me/earnings/route";
import { POST as createEvent } from "@/app/api/v1/events/route";
import { POST as publishEvent } from "@/app/api/v1/events/[eventId]/publish/route";
import { POST as startEvent } from "@/app/api/v1/events/[eventId]/start/route";
import { POST as registerEvent } from "@/app/api/v1/events/[eventId]/register/route";
import { POST as checkIn } from "@/app/api/v1/events/[eventId]/attendance/route";
import { POST as explain } from "@/app/api/v1/ai/analytics/explain/route";
import { type AiCompletionRequest, type AiProvider, resetAiProvider, setAiProvider } from "@/lib/ai";
import { resetLiveRoomProvider } from "@/lib/live";
import { resetPaymentProvider, signSandboxWebhook } from "@/lib/payments";
import { resetRateLimitStore } from "@/lib/security";
import { resetAiStore, setAiStore } from "@/modules/ai/store";
import { resetAnalyticsStore, setAnalyticsStore } from "@/modules/analytics/store";
import { resetCommunityStore, setCommunityStore } from "@/modules/community/store";
import { resetContentStore, setContentStore } from "@/modules/content/store";
import { resetEventsStore, setEventsStore } from "@/modules/events/store";
import { resetIdentityStore, setIdentityStore } from "@/modules/identity/store";
import { resetPaymentsStore, setPaymentsStore } from "@/modules/payments/store";
import { createAiMemoryStore } from "./helpers/ai-memory-store";
import { createAnalyticsMemoryStore } from "./helpers/analytics-memory-store";
import { createCommunityMemoryStore } from "./helpers/community-memory-store";
import { createContentMemoryStore } from "./helpers/content-memory-store";
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

async function settlePayment(transactionId: string, providerReference: string, amountCents: number) {
  const payload = {
    eventId: `evt_${crypto.randomUUID()}`,
    providerReference,
    outcome: "succeeded",
    amountCents,
    currency: "USD",
  };
  const raw = JSON.stringify(payload);
  const response = await paymentWebhook(
    new Request("http://localhost/api/v1/payments/webhooks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-univox-sandbox-signature": signSandboxWebhook(WEBHOOK_SECRET, raw),
      },
      body: raw,
    }),
    emptyRouteContext,
  );
  expect(response.status).toBe(200);
}

class CaptureAiProvider implements AiProvider {
  readonly name = "openai" as const;
  prompt = "";
  async complete(request: AiCompletionRequest) {
    this.prompt = request.prompt;
    return {
      provider: this.name,
      model: "gpt-test",
      text: "Verified snapshot only.",
      inputTokens: 4,
      outputTokens: 3,
    };
  }
}

describe("analytics", () => {
  beforeEach(() => {
    resetRateLimitStore();
    setIdentityStore(createMemoryStore());
    setCommunityStore(createCommunityMemoryStore());
    setContentStore(createContentMemoryStore());
    setPaymentsStore(createPaymentsMemoryStore());
    setEventsStore(createEventsMemoryStore());
    setAiStore(createAiMemoryStore());
    setAnalyticsStore(createAnalyticsMemoryStore());
    resetLiveRoomProvider();
    resetPaymentProvider();
    resetAiProvider();
  });

  afterEach(() => {
    resetIdentityStore();
    resetCommunityStore();
    resetContentStore();
    resetPaymentsStore();
    resetEventsStore();
    resetAiStore();
    resetAnalyticsStore();
    resetLiveRoomProvider();
    resetPaymentProvider();
    resetAiProvider();
    resetRateLimitStore();
  });

  it("aggregates verified audience, content, community, revenue, and event metrics", async () => {
    const creator = await registerUser("creator@univox.test");
    const fan = await registerUser("fan@univox.test", "Fan");
    const member = await registerUser("member@univox.test", "Member");
    const org = await createOrg(
      jsonRequest("http://localhost/api/v1/organizations", "POST", { name: "Studio", slug: "studio" }, creator.tokens.accessToken),
      emptyRouteContext,
    );
    const organizationId = ((await org.json()) as { organization: { id: string } }).organization.id;
    const community = await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId, name: "Club", slug: "club", visibility: "PUBLIC" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const communityId = ((await community.json()) as { community: { id: string } }).community.id;
    await addCommunityMember(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/members`,
        "POST",
        { userId: member.user.id, role: "MEMBER" },
        creator.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    const channel = await createChannel(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/channels`,
        "POST",
        { name: "General", slug: "general" },
        creator.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    const channelId = ((await channel.json()) as { channel: { id: string } }).channel.id;
    const post = await createPost(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/channels/${channelId}/posts`,
        "POST",
        { title: "Hello", body: "Community post" },
        creator.tokens.accessToken,
      ),
      routeContext({ communityId, channelId }),
    );
    const postId = ((await post.json()) as { post: { id: string } }).post.id;
    await createCommunityComment(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/posts/${postId}/comments`,
        "POST",
        { body: "Nice" },
        member.tokens.accessToken,
      ),
      routeContext({ communityId, postId }),
    );
    await createCommunityReaction(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/reactions`,
        "POST",
        { targetType: "POST", targetId: postId, emoji: "like" },
        member.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );

    const created = await createContent(
      jsonRequest(
        "http://localhost/api/v1/content",
        "POST",
        { type: "TEXT", title: "Launch", body: "Notes", visibility: "PUBLIC" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const contentId = ((await created.json()) as { content: { id: string } }).content.id;
    await publishContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}/publish`, "POST", {}, creator.tokens.accessToken),
      routeContext({ contentId }),
    );
    await followCreator(
      jsonRequest(`http://localhost/api/v1/creators/${creator.user.id}/follow`, "POST", {}, fan.tokens.accessToken),
      routeContext({ creatorId: creator.user.id }),
    );
    await getContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}`, "GET", undefined, fan.tokens.accessToken),
      routeContext({ contentId }),
    );
    await getContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}`, "GET", undefined, fan.tokens.accessToken),
      routeContext({ contentId }),
    );
    await createReaction(
      jsonRequest(`http://localhost/api/v1/content/${contentId}/reactions`, "POST", { emoji: "fire" }, fan.tokens.accessToken),
      routeContext({ contentId }),
    );
    await createComment(
      jsonRequest(`http://localhost/api/v1/content/${contentId}/comments`, "POST", { body: "Great" }, fan.tokens.accessToken),
      routeContext({ contentId }),
    );
    await shareContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}/shares`, "POST", {}, fan.tokens.accessToken),
      routeContext({ contentId }),
    );

    const product = await createProduct(
      jsonRequest(
        "http://localhost/api/v1/products",
        "POST",
        { name: "Club", amountCents: 1000, currency: "USD", intervalDays: 30, status: "ACTIVE" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const productId = ((await product.json()) as { product: { id: string } }).product.id;
    const checkout = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId }, fan.tokens.accessToken),
      emptyRouteContext,
    );
    const checkoutBody = await checkout.json();
    await settlePayment(checkoutBody.transaction.id, checkoutBody.transaction.providerReference, 1000);

    const live = await createEvent(
      jsonRequest(
        "http://localhost/api/v1/events",
        "POST",
        { title: "AMA", startsAt: new Date(Date.now() + 3600_000).toISOString(), organizationId },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const eventId = ((await live.json()) as { event: { id: string } }).event.id;
    await publishEvent(jsonRequest(`http://localhost/api/v1/events/${eventId}/publish`, "POST", {}, creator.tokens.accessToken), routeContext({ eventId }));
    await startEvent(jsonRequest(`http://localhost/api/v1/events/${eventId}/start`, "POST", {}, creator.tokens.accessToken), routeContext({ eventId }));
    await registerEvent(jsonRequest(`http://localhost/api/v1/events/${eventId}/register`, "POST", {}, fan.tokens.accessToken), routeContext({ eventId }));
    await checkIn(jsonRequest(`http://localhost/api/v1/events/${eventId}/attendance`, "POST", {}, fan.tokens.accessToken), routeContext({ eventId }));

    const earnings = await getEarnings(
      jsonRequest("http://localhost/api/v1/creators/me/earnings", "GET", undefined, creator.tokens.accessToken),
      emptyRouteContext,
    );
    const earningsBody = await earnings.json();
    const response = await dashboard(
      jsonRequest("http://localhost/api/v1/analytics", "GET", undefined, creator.tokens.accessToken),
      emptyRouteContext,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.dashboard.audience).toMatchObject({ followers: 1, followerGrowth: 1, activeMembers: 2 });
    expect(body.dashboard.content).toMatchObject({
      published: 1,
      views: 1,
      likes: 1,
      comments: 1,
      shares: 1,
      engagementRate: 3,
    });
    expect(body.dashboard.community).toMatchObject({
      communities: 1,
      members: 2,
      activeMembers: 2,
      posts: 1,
      comments: 1,
      reactions: 1,
      engagement: 3,
    });
    expect(body.dashboard.monetization).toMatchObject({
      grossRevenueCents: earningsBody.earnings.grossRevenueCents,
      platformFeeCents: earningsBody.earnings.platformFeeCents,
      creatorEarningsCents: earningsBody.earnings.netCreatorAmountCents,
      succeededPayments: 1,
      subscriptions: 1,
      payingMembers: 1,
    });
    expect(body.dashboard.events).toMatchObject({ registrations: 1, attendance: 1 });
    expect(body.dashboard.charts.views).toEqual(expect.arrayContaining([expect.objectContaining({ value: 1 })]));
  });

  it("filters metrics by date range and does not invent historical values", async () => {
    const creator = await registerUser("creator@univox.test");
    const fan = await registerUser("fan@univox.test", "Fan");
    const created = await createContent(
      jsonRequest(
        "http://localhost/api/v1/content",
        "POST",
        { type: "TEXT", title: "Now", body: "Live", visibility: "PUBLIC" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const contentId = ((await created.json()) as { content: { id: string } }).content.id;
    await publishContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}/publish`, "POST", {}, creator.tokens.accessToken),
      routeContext({ contentId }),
    );
    await followCreator(
      jsonRequest(`http://localhost/api/v1/creators/${creator.user.id}/follow`, "POST", {}, fan.tokens.accessToken),
      routeContext({ creatorId: creator.user.id }),
    );
    const pastFrom = "2020-01-01T00:00:00.000Z";
    const pastTo = "2020-01-31T23:59:59.000Z";
    const historic = await dashboard(
      jsonRequest(`http://localhost/api/v1/analytics?from=${pastFrom}&to=${pastTo}`, "GET", undefined, creator.tokens.accessToken),
      emptyRouteContext,
    );
    expect(historic.status).toBe(200);
    await expect(historic.json()).resolves.toMatchObject({
      dashboard: {
        audience: { followers: 0, followerGrowth: 0 },
        content: { published: 0, views: 0, likes: 0 },
      },
    });
    const current = await contentMetrics(
      jsonRequest("http://localhost/api/v1/analytics/content", "GET", undefined, creator.tokens.accessToken),
      emptyRouteContext,
    );
    expect(current.status).toBe(200);
    await expect(current.json()).resolves.toMatchObject({ content: { published: 1, views: 0 } });
  });

  it("authorizes the creator only and isolates organization communities", async () => {
    const creator = await registerUser("creator@univox.test");
    const stranger = await registerUser("stranger@univox.test", "Stranger");
    const outsider = await registerUser("out@univox.test", "Out");
    const ownOrg = await createOrg(
      jsonRequest("http://localhost/api/v1/organizations", "POST", { name: "Mine", slug: "mine" }, creator.tokens.accessToken),
      emptyRouteContext,
    );
    const ownOrgId = ((await ownOrg.json()) as { organization: { id: string } }).organization.id;
    const otherOrg = await createOrg(
      jsonRequest("http://localhost/api/v1/organizations", "POST", { name: "Theirs", slug: "theirs" }, outsider.tokens.accessToken),
      emptyRouteContext,
    );
    const otherOrgId = ((await otherOrg.json()) as { organization: { id: string } }).organization.id;
    await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId: ownOrgId, name: "Own", slug: "own", visibility: "PUBLIC" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    await followCreator(
      jsonRequest(`http://localhost/api/v1/creators/${creator.user.id}/follow`, "POST", {}, outsider.tokens.accessToken),
      routeContext({ creatorId: creator.user.id }),
    );
    const denied = await dashboard(
      jsonRequest("http://localhost/api/v1/analytics", "GET", undefined, stranger.tokens.accessToken),
      emptyRouteContext,
    );
    expect(denied.status).toBe(200);
    await expect(denied.json()).resolves.toMatchObject({
      dashboard: { audience: { followers: 0 }, community: { communities: 0 } },
    });
    const ownerDash = await dashboard(
      jsonRequest("http://localhost/api/v1/analytics", "GET", undefined, creator.tokens.accessToken),
      emptyRouteContext,
    );
    await expect(ownerDash.json()).resolves.toMatchObject({
      dashboard: { audience: { followers: 1 }, community: { communities: 1 } },
    });
    const forbiddenOrg = await dashboard(
      jsonRequest(
        `http://localhost/api/v1/analytics?organizationId=${otherOrgId}`,
        "GET",
        undefined,
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(forbiddenOrg.status).toBe(403);
    const scoped = await communityMetrics(
      jsonRequest(
        `http://localhost/api/v1/analytics/community?organizationId=${ownOrgId}`,
        "GET",
        undefined,
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(scoped.status).toBe(200);
    await expect(scoped.json()).resolves.toMatchObject({ community: { communities: 1, members: 1 } });
    await addOrgMember(
      jsonRequest(
        `http://localhost/api/v1/organizations/${ownOrgId}/members`,
        "POST",
        { userId: stranger.user.id, role: "MEMBER" },
        creator.tokens.accessToken,
      ),
      routeContext({ organizationId: ownOrgId }),
    );
    const memberView = await audience(
      jsonRequest(
        `http://localhost/api/v1/analytics/audience?organizationId=${ownOrgId}`,
        "GET",
        undefined,
        stranger.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(memberView.status).toBe(200);
    await expect(memberView.json()).resolves.toMatchObject({ audience: { followers: 0 } });
  });

  it("keeps monetization charts consistent with succeeded payments only", async () => {
    const creator = await registerUser("creator@univox.test");
    const fan = await registerUser("fan@univox.test", "Fan");
    const product = await createProduct(
      jsonRequest(
        "http://localhost/api/v1/products",
        "POST",
        { name: "Club", amountCents: 2500, currency: "USD", intervalDays: 30, status: "ACTIVE" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const productId = ((await product.json()) as { product: { id: string } }).product.id;
    const pending = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId }, fan.tokens.accessToken),
      emptyRouteContext,
    );
    expect(pending.status).toBe(201);
    const unpaid = await monetizationMetrics(
      jsonRequest("http://localhost/api/v1/analytics/monetization", "GET", undefined, creator.tokens.accessToken),
      emptyRouteContext,
    );
    await expect(unpaid.json()).resolves.toMatchObject({
      monetization: { grossRevenueCents: 0, creatorEarningsCents: 0, succeededPayments: 0 },
    });
    const paid = await initiatePayment(
      jsonRequest("http://localhost/api/v1/payments", "POST", { productId }, fan.tokens.accessToken),
      emptyRouteContext,
    );
    const paidBody = await paid.json();
    await settlePayment(paidBody.transaction.id, paidBody.transaction.providerReference, 2500);
    const settled = await monetizationMetrics(
      jsonRequest("http://localhost/api/v1/analytics/monetization", "GET", undefined, creator.tokens.accessToken),
      emptyRouteContext,
    );
    const earnings = await getEarnings(
      jsonRequest("http://localhost/api/v1/creators/me/earnings", "GET", undefined, creator.tokens.accessToken),
      emptyRouteContext,
    );
    const earningsBody = await earnings.json();
    const settledBody = await settled.json();
    expect(settledBody.monetization.grossRevenueCents).toBe(earningsBody.earnings.grossRevenueCents);
    expect(settledBody.monetization.platformFeeCents).toBe(earningsBody.earnings.platformFeeCents);
    expect(settledBody.monetization.creatorEarningsCents).toBe(earningsBody.earnings.netCreatorAmountCents);
    expect(settledBody.chart.reduce((sum: number, point: { value: number }) => sum + point.value, 0)).toBe(2500);
    const eventsSlice = await eventMetrics(
      jsonRequest("http://localhost/api/v1/analytics/events", "GET", undefined, creator.tokens.accessToken),
      emptyRouteContext,
    );
    expect(eventsSlice.status).toBe(200);
  });

  it("feeds AI explanations only verified dashboard numbers", async () => {
    const creator = await registerUser("creator@univox.test");
    const provider = new CaptureAiProvider();
    setAiProvider(provider);
    const response = await explain(
      jsonRequest("http://localhost/api/v1/ai/analytics/explain", "POST", { question: "How am I doing?" }, creator.tokens.accessToken),
      emptyRouteContext,
    );
    expect(response.status).toBe(201);
    expect(provider.prompt).toContain("\"followers\":0");
    expect(provider.prompt).toContain("\"grossRevenueCents\":0");
    expect(provider.prompt).toContain("Use only these numbers");
  });
});
