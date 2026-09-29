import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { GET as me } from "@/app/api/v1/users/me/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { POST as createCommunity } from "@/app/api/v1/communities/route";
import { POST as createChannel } from "@/app/api/v1/communities/[communityId]/channels/route";
import { POST as createPost } from "@/app/api/v1/communities/[communityId]/channels/[channelId]/posts/route";
import { GET as listContent, POST as createContent } from "@/app/api/v1/content/route";
import { GET as getContent } from "@/app/api/v1/content/[contentId]/route";
import { POST as publishContent } from "@/app/api/v1/content/[contentId]/publish/route";
import { GET as getFeed } from "@/app/api/v1/content/feed/route";
import { POST as createComment } from "@/app/api/v1/content/[contentId]/comments/route";
import { POST as createEvent } from "@/app/api/v1/events/route";
import { POST as publishEvent } from "@/app/api/v1/events/[eventId]/publish/route";
import { POST as startEvent } from "@/app/api/v1/events/[eventId]/start/route";
import { POST as registerEvent } from "@/app/api/v1/events/[eventId]/register/route";
import { POST as checkIn } from "@/app/api/v1/events/[eventId]/attendance/route";
import { POST as postChat } from "@/app/api/v1/events/[eventId]/chat/route";
import { GET as analytics } from "@/app/api/v1/analytics/route";
import { GET as listNotifications } from "@/app/api/v1/notifications/route";
import { ApiClientError, errorMessage, fieldErrors } from "@/lib/api-client";
import { compactNumber, formatDate, money, percent } from "@/lib/format";
import { AUDIENCE_NAV, STUDIO_NAV, isNavCurrent } from "@/lib/navigation";
import { resetLiveRoomProvider } from "@/lib/live";
import { resetRateLimitStore } from "@/lib/security";
import { MemoryStorageProvider, resetStorageProvider, setStorageProvider } from "@/lib/storage";
import { resetAnalyticsStore, setAnalyticsStore } from "@/modules/analytics/store";
import { resetCommunityStore, setCommunityStore } from "@/modules/community/store";
import { resetContentStore, setContentStore } from "@/modules/content/store";
import { resetEventsStore, setEventsStore } from "@/modules/events/store";
import { resetIdentityStore, setIdentityStore } from "@/modules/identity/store";
import { resetPaymentsStore, setPaymentsStore } from "@/modules/payments/store";
import { createAnalyticsMemoryStore } from "./helpers/analytics-memory-store";
import { createCommunityMemoryStore } from "./helpers/community-memory-store";
import { createContentMemoryStore } from "./helpers/content-memory-store";
import { createEventsMemoryStore } from "./helpers/events-memory-store";
import { emptyRouteContext, routeContext } from "./helpers/invoke";
import { createMemoryStore } from "./helpers/memory-store";
import { createPaymentsMemoryStore } from "./helpers/payments-memory-store";

const PASSWORD = "creator-pass-1";

type AuthPayload = {
  user: { id: string; email: string; displayName: string };
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

describe("ux journeys", () => {
  beforeEach(() => {
    resetRateLimitStore();
    setIdentityStore(createMemoryStore());
    setCommunityStore(createCommunityMemoryStore());
    setContentStore(createContentMemoryStore());
    setEventsStore(createEventsMemoryStore());
    setPaymentsStore(createPaymentsMemoryStore());
    setAnalyticsStore(createAnalyticsMemoryStore());
    setStorageProvider(new MemoryStorageProvider());
  });

  afterEach(() => {
    resetIdentityStore();
    resetCommunityStore();
    resetContentStore();
    resetEventsStore();
    resetPaymentsStore();
    resetAnalyticsStore();
    resetStorageProvider();
    resetLiveRoomProvider();
    resetRateLimitStore();
  });

  it("exposes audience and studio navigation without treating studio children as Home", () => {
    expect(AUDIENCE_NAV.map((item) => item.label)).toEqual([
      "Home",
      "Discover",
      "Communities",
      "Live",
      "Messages",
      "Creator Studio",
    ]);
    expect(STUDIO_NAV.map((item) => item.label)).toEqual([
      "Overview",
      "Content",
      "Community",
      "Monetization",
      "Events",
      "AI",
      "Analytics",
      "Settings",
    ]);
    expect(isNavCurrent("/", "/")).toBe(true);
    expect(isNavCurrent("/studio", "/")).toBe(false);
    expect(isNavCurrent("/studio/content", "/studio")).toBe(false);
    expect(isNavCurrent("/studio/content", "/studio/content")).toBe(true);
    expect(isNavCurrent("/communities/abc", "/communities")).toBe(true);
  });

  it("formats creator metrics for operational dashboards", () => {
    expect(money(12345, "USD")).toContain("123.45");
    expect(compactNumber(1500)).toBe("1.5K");
    expect(percent(0.125)).toBe("12.5%");
    expect(formatDate(null)).toBe("Not scheduled");
  });

  it("maps API validation details onto form fields", () => {
    const error = new ApiClientError(400, "VALIDATION_ERROR", "Request validation failed", [
      { path: "email", message: "Invalid email" },
      { path: "(root)", message: "ignored" },
    ]);
    expect(fieldErrors(error)).toEqual({ email: "Invalid email" });
    expect(errorMessage(error)).toBe("Request validation failed");
  });

  it("registers, signs in, publishes to the feed, and accepts a comment", async () => {
    const creator = await registerUser("ux-creator@univox.test", "Ada");
    const session = await me(jsonRequest("http://localhost/api/v1/users/me", "GET", undefined, creator.tokens.accessToken), emptyRouteContext);
    expect(session.status).toBe(200);
    const meBody = await session.json();
    expect(meBody.user.displayName).toBe("Ada");

    const signedIn = await login(
      jsonRequest("http://localhost/api/v1/auth/login", "POST", { email: "ux-creator@univox.test", password: PASSWORD }),
      emptyRouteContext,
    );
    expect(signedIn.status).toBe(200);

    const invalid = await register(
      jsonRequest("http://localhost/api/v1/auth/register", "POST", { email: "bad", password: "short", displayName: "A" }),
      emptyRouteContext,
    );
    expect(invalid.status).toBe(400);
    const invalidBody = await invalid.json();
    expect(invalidBody.error.code).toBe("VALIDATION_ERROR");

    const created = await createContent(
      jsonRequest(
        "http://localhost/api/v1/content",
        "POST",
        { type: "TEXT", title: "First story", body: "Hello room", visibility: "PUBLIC" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    const published = await publishContent(
      jsonRequest(`http://localhost/api/v1/content/${createdBody.content.id}/publish`, "POST", {}, creator.tokens.accessToken),
      routeContext({ contentId: createdBody.content.id }),
    );
    expect(published.status).toBe(200);

    const library = await listContent(jsonRequest("http://localhost/api/v1/content", "GET", undefined, creator.tokens.accessToken), emptyRouteContext);
    expect(library.status).toBe(200);
    const libraryBody = await library.json();
    expect(libraryBody.content[0].title).toBe("First story");

    const viewer = await registerUser("ux-viewer@univox.test", "Nia");
    const viewed = await getContent(
      jsonRequest(`http://localhost/api/v1/content/${createdBody.content.id}`, "GET", undefined, viewer.tokens.accessToken),
      routeContext({ contentId: createdBody.content.id }),
    );
    expect(viewed.status).toBe(200);
    const feed = await getFeed(
      jsonRequest("http://localhost/api/v1/content/feed?scope=newest", "GET", undefined, viewer.tokens.accessToken),
      emptyRouteContext,
    );
    expect(feed.status).toBe(200);
    const feedBody = await feed.json();
    expect(feedBody.items[0].title).toBe("First story");

    const commented = await createComment(
      jsonRequest(
        `http://localhost/api/v1/content/${createdBody.content.id}/comments`,
        "POST",
        { body: "Beautiful work" },
        viewer.tokens.accessToken,
      ),
      routeContext({ contentId: createdBody.content.id }),
    );
    expect(commented.status).toBe(201);

    const dash = await analytics(jsonRequest("http://localhost/api/v1/analytics", "GET", undefined, creator.tokens.accessToken), emptyRouteContext);
    expect(dash.status).toBe(200);
    const dashBody = await dash.json();
    expect(dashBody.dashboard.content.published).toBe(1);
    expect(dashBody.dashboard.content.comments).toBe(1);
    expect(dashBody.dashboard.content.views).toBe(1);
  });

  it("creates a community channel post and a live room audience can join", async () => {
    const host = await registerUser("ux-host@univox.test", "Host");
    const org = await createOrg(
      jsonRequest("http://localhost/api/v1/organizations", "POST", { name: "Studio Org", slug: "studio-org" }, host.tokens.accessToken),
      emptyRouteContext,
    );
    expect(org.status).toBe(201);
    const orgBody = await org.json();

    const community = await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId: orgBody.organization.id, name: "Members", slug: "members", visibility: "PUBLIC" },
        host.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(community.status).toBe(201);
    const communityBody = await community.json();

    const channel = await createChannel(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityBody.community.id}/channels`,
        "POST",
        { name: "General", slug: "general" },
        host.tokens.accessToken,
      ),
      routeContext({ communityId: communityBody.community.id }),
    );
    expect(channel.status).toBe(201);
    const channelBody = await channel.json();

    const post = await createPost(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityBody.community.id}/channels/${channelBody.channel.id}/posts`,
        "POST",
        { title: "Welcome", body: "First note" },
        host.tokens.accessToken,
      ),
      routeContext({ communityId: communityBody.community.id, channelId: channelBody.channel.id }),
    );
    expect(post.status).toBe(201);

    const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const drafted = await createEvent(
      jsonRequest("http://localhost/api/v1/events", "POST", { title: "Office hours", startsAt, accessType: "FREE" }, host.tokens.accessToken),
      emptyRouteContext,
    );
    expect(drafted.status).toBe(201);
    const eventId = (await drafted.json()).event.id;
    const published = await publishEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/publish`, "POST", undefined, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(published.status).toBe(200);
    const started = await startEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/start`, "POST", undefined, host.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(started.status).toBe(200);
    const startedBody = await started.json();
    expect(startedBody.room.joinUrl).toBeTruthy();

    const guest = await registerUser("ux-guest@univox.test", "Guest");
    const registered = await registerEvent(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/register`, "POST", {}, guest.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(registered.status).toBe(201);
    const joined = await checkIn(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/attendance`, "POST", undefined, guest.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(joined.status).toBe(200);
    const chat = await postChat(
      jsonRequest(`http://localhost/api/v1/events/${eventId}/chat`, "POST", { body: "Hello host" }, guest.tokens.accessToken),
      routeContext({ eventId }),
    );
    expect(chat.status).toBe(201);

    const inbox = await listNotifications(
      jsonRequest("http://localhost/api/v1/notifications", "GET", undefined, host.tokens.accessToken),
      emptyRouteContext,
    );
    expect(inbox.status).toBe(200);
  });
});
