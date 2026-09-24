import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { POST as addOrgMember } from "@/app/api/v1/organizations/[organizationId]/members/route";
import { GET as listCommunities, POST as createCommunity } from "@/app/api/v1/communities/route";
import { GET as getCommunity, PATCH as patchCommunity } from "@/app/api/v1/communities/[communityId]/route";
import { POST as addMember } from "@/app/api/v1/communities/[communityId]/members/route";
import { GET as listChannels, POST as createChannel } from "@/app/api/v1/communities/[communityId]/channels/route";
import { GET as getChannel } from "@/app/api/v1/communities/[communityId]/channels/[channelId]/route";
import { POST as createPost } from "@/app/api/v1/communities/[communityId]/channels/[channelId]/posts/route";
import { GET as getPost, PATCH as patchPost } from "@/app/api/v1/communities/[communityId]/posts/[postId]/route";
import { POST as createComment } from "@/app/api/v1/communities/[communityId]/posts/[postId]/comments/route";
import { DELETE as deleteComment } from "@/app/api/v1/communities/[communityId]/comments/[commentId]/route";
import { POST as createReaction } from "@/app/api/v1/communities/[communityId]/reactions/route";
import { GET as listReports, POST as createReport } from "@/app/api/v1/communities/[communityId]/reports/route";
import { PATCH as patchReport } from "@/app/api/v1/communities/[communityId]/reports/[reportId]/route";
import { POST as moderate } from "@/app/api/v1/communities/[communityId]/moderation/route";
import { GET as listNotifications } from "@/app/api/v1/notifications/route";
import { resetRateLimitStore } from "@/lib/security";
import { resetCommunityStore, setCommunityStore } from "@/modules/community/store";
import { resetIdentityStore, setIdentityStore } from "@/modules/identity/store";
import { createCommunityMemoryStore } from "./helpers/community-memory-store";
import { emptyRouteContext, routeContext } from "./helpers/invoke";
import { createMemoryStore } from "./helpers/memory-store";

const PASSWORD = "creator-pass-1";

type AuthPayload = {
  user: { id: string; email: string; displayName: string };
  tokens: { accessToken: string; refreshToken: string };
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

async function createOwnedOrg(token: string, name: string, slug: string): Promise<string> {
  const response = await createOrg(
    jsonRequest("http://localhost/api/v1/organizations", "POST", { name, slug }, token),
    emptyRouteContext,
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as { organization: { id: string } }).organization.id;
}

describe("community", () => {
  beforeEach(() => {
    resetRateLimitStore();
    setIdentityStore(createMemoryStore());
    setCommunityStore(createCommunityMemoryStore());
  });

  afterEach(() => {
    resetIdentityStore();
    resetCommunityStore();
    resetRateLimitStore();
  });

  it("creates a community and lists membership", async () => {
    const owner = await registerUser("owner@univox.test");
    const organizationId = await createOwnedOrg(owner.tokens.accessToken, "Studio One", "studio-one");
    const created = await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId, name: "Writers", slug: "writers", visibility: "PRIVATE" },
        owner.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(created.status).toBe(201);
    const body = await created.json();
    expect(body.community.membership.role).toBe("OWNER");
    const listed = await listCommunities(
      jsonRequest("http://localhost/api/v1/communities", "GET", undefined, owner.tokens.accessToken),
      emptyRouteContext,
    );
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.communities).toHaveLength(1);
  });

  it("enforces private community access", async () => {
    const owner = await registerUser("owner@univox.test");
    const stranger = await registerUser("stranger@univox.test", "Stranger");
    const organizationId = await createOwnedOrg(owner.tokens.accessToken, "Studio One", "studio-one");
    const created = await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId, name: "Writers", slug: "writers", visibility: "PRIVATE" },
        owner.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const communityId = (await created.json()).community.id as string;
    const denied = await getCommunity(
      jsonRequest(`http://localhost/api/v1/communities/${communityId}`, "GET", undefined, stranger.tokens.accessToken),
      routeContext({ communityId }),
    );
    expect(denied.status).toBe(403);
  });

  it("enforces membership role restrictions", async () => {
    const owner = await registerUser("owner@univox.test");
    const member = await registerUser("member@univox.test", "Member");
    const organizationId = await createOwnedOrg(owner.tokens.accessToken, "Studio One", "studio-one");
    const created = await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId, name: "Writers", slug: "writers" },
        owner.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const communityId = (await created.json()).community.id as string;
    const added = await addMember(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/members`,
        "POST",
        { email: "member@univox.test", role: "MEMBER" },
        owner.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    expect(added.status).toBe(201);
    const forbiddenPatch = await patchCommunity(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}`,
        "PATCH",
        { name: "Hijacked" },
        member.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    expect(forbiddenPatch.status).toBe(403);
    const forbiddenAdd = await addMember(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/members`,
        "POST",
        { email: "owner@univox.test", role: "ADMIN" },
        member.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    expect(forbiddenAdd.status).toBe(403);
  });

  it("enforces channel, post, and comment permissions", async () => {
    const owner = await registerUser("owner@univox.test");
    const member = await registerUser("member@univox.test", "Member");
    const organizationId = await createOwnedOrg(owner.tokens.accessToken, "Studio One", "studio-one");
    const created = await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId, name: "Writers", slug: "writers" },
        owner.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const communityId = (await created.json()).community.id as string;
    await addMember(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/members`,
        "POST",
        { email: "member@univox.test", role: "MEMBER" },
        owner.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    const openChannel = await createChannel(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/channels`,
        "POST",
        { name: "General", slug: "general", visibility: "OPEN" },
        owner.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    expect(openChannel.status).toBe(201);
    const privateChannel = await createChannel(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/channels`,
        "POST",
        { name: "Staff", slug: "staff", visibility: "PRIVATE" },
        owner.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    const openChannelId = (await openChannel.json()).channel.id as string;
    const privateChannelId = (await privateChannel.json()).channel.id as string;

    const memberPrivate = await getChannel(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/channels/${privateChannelId}`,
        "GET",
        undefined,
        member.tokens.accessToken,
      ),
      routeContext({ communityId, channelId: privateChannelId }),
    );
    expect(memberPrivate.status).toBe(403);

    const memberPostPrivate = await createPost(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/channels/${privateChannelId}/posts`,
        "POST",
        { title: "Nope", body: "secret" },
        member.tokens.accessToken,
      ),
      routeContext({ communityId, channelId: privateChannelId }),
    );
    expect(memberPostPrivate.status).toBe(403);

    const posted = await createPost(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/channels/${openChannelId}/posts`,
        "POST",
        { title: "Hello", body: "World" },
        member.tokens.accessToken,
      ),
      routeContext({ communityId, channelId: openChannelId }),
    );
    expect(posted.status).toBe(201);
    const postId = (await posted.json()).post.id as string;
    const ownerEdit = await patchPost(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/posts/${postId}`,
        "PATCH",
        { title: "Stolen" },
        owner.tokens.accessToken,
      ),
      routeContext({ communityId, postId }),
    );
    expect(ownerEdit.status).toBe(403);

    const commented = await createComment(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/posts/${postId}/comments`,
        "POST",
        { body: "Nice post" },
        owner.tokens.accessToken,
      ),
      routeContext({ communityId, postId }),
    );
    expect(commented.status).toBe(201);
    const commentId = (await commented.json()).comment.id as string;
    const memberDeleteOwnerComment = await deleteComment(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/comments/${commentId}`,
        "DELETE",
        undefined,
        member.tokens.accessToken,
      ),
      routeContext({ communityId, commentId }),
    );
    expect(memberDeleteOwnerComment.status).toBe(403);
  });

  it("supports reactions, reports, and moderation", async () => {
    const owner = await registerUser("owner@univox.test");
    const member = await registerUser("member@univox.test", "Member");
    const organizationId = await createOwnedOrg(owner.tokens.accessToken, "Studio One", "studio-one");
    const created = await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId, name: "Writers", slug: "writers" },
        owner.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const communityId = (await created.json()).community.id as string;
    await addMember(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/members`,
        "POST",
        { email: "member@univox.test", role: "MEMBER" },
        owner.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    const channel = await createChannel(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/channels`,
        "POST",
        { name: "General", slug: "general" },
        owner.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    const channelId = (await channel.json()).channel.id as string;
    const posted = await createPost(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/channels/${channelId}/posts`,
        "POST",
        { title: "Hello", body: "World" },
        member.tokens.accessToken,
      ),
      routeContext({ communityId, channelId }),
    );
    const postId = (await posted.json()).post.id as string;
    const reacted = await createReaction(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/reactions`,
        "POST",
        { targetType: "POST", targetId: postId, emoji: "thumbs-up" },
        owner.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    expect(reacted.status).toBe(201);
    const reported = await createReport(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/reports`,
        "POST",
        { targetType: "POST", targetId: postId, reason: "spam content" },
        owner.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    expect(reported.status).toBe(201);
    const reportId = (await reported.json()).report.id as string;
    const memberCannotList = await listReports(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/reports`,
        "GET",
        undefined,
        member.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    expect(memberCannotList.status).toBe(403);
    const hidden = await moderate(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/moderation`,
        "POST",
        { type: "HIDE_POST", targetType: "POST", targetId: postId, reason: "spam" },
        owner.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    expect(hidden.status).toBe(201);
    const memberHidden = await getPost(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/posts/${postId}`,
        "GET",
        undefined,
        member.tokens.accessToken,
      ),
      routeContext({ communityId, postId }),
    );
    expect(memberHidden.status).toBe(200);
    const resolved = await patchReport(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/reports/${reportId}`,
        "PATCH",
        { status: "RESOLVED" },
        owner.tokens.accessToken,
      ),
      routeContext({ communityId, reportId }),
    );
    expect(resolved.status).toBe(200);
    const memberNotifications = await listNotifications(
      jsonRequest("http://localhost/api/v1/notifications", "GET", undefined, member.tokens.accessToken),
      emptyRouteContext,
    );
    expect(memberNotifications.status).toBe(200);
    const notes = (await memberNotifications.json()).notifications as Array<{ type: string }>;
    expect(notes.some((item) => item.type === "MEMBERSHIP_ADDED")).toBe(true);
    expect(notes.some((item) => item.type === "MODERATION_ACTION")).toBe(true);
  });

  it("denies cross-tenant community access", async () => {
    const alice = await registerUser("alice@univox.test", "Alice");
    const bob = await registerUser("bob@univox.test", "Bob");
    const aliceOrgId = await createOwnedOrg(alice.tokens.accessToken, "Alice Studio", "alice-studio");
    const bobOrgId = await createOwnedOrg(bob.tokens.accessToken, "Bob Studio", "bob-studio");
    const aliceCommunity = await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId: aliceOrgId, name: "Alice Hub", slug: "alice-hub", visibility: "PUBLIC" },
        alice.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const bobCommunity = await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId: bobOrgId, name: "Bob Hub", slug: "bob-hub", visibility: "PUBLIC" },
        bob.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const aliceCommunityId = (await aliceCommunity.json()).community.id as string;
    const bobCommunityId = (await bobCommunity.json()).community.id as string;
    const cross = await getCommunity(
      jsonRequest(
        `http://localhost/api/v1/communities/${aliceCommunityId}`,
        "GET",
        undefined,
        bob.tokens.accessToken,
      ),
      routeContext({ communityId: aliceCommunityId }),
    );
    expect(cross.status).toBe(403);
    const own = await getCommunity(
      jsonRequest(`http://localhost/api/v1/communities/${bobCommunityId}`, "GET", undefined, bob.tokens.accessToken),
      routeContext({ communityId: bobCommunityId }),
    );
    expect(own.status).toBe(200);
  });

  it("does not trust client-supplied tenant ids for org-scoped listing", async () => {
    const alice = await registerUser("alice@univox.test", "Alice");
    const bob = await registerUser("bob@univox.test", "Bob");
    const aliceOrgId = await createOwnedOrg(alice.tokens.accessToken, "Alice Studio", "alice-studio");
    await createOwnedOrg(bob.tokens.accessToken, "Bob Studio", "bob-studio");
    await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId: aliceOrgId, name: "Alice Hub", slug: "alice-hub", visibility: "PUBLIC" },
        alice.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const listed = await listCommunities(
      jsonRequest(
        `http://localhost/api/v1/communities?organizationId=${aliceOrgId}`,
        "GET",
        undefined,
        bob.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(listed.status).toBe(403);
  });

  it("allows org members to view public communities they do not belong to", async () => {
    const owner = await registerUser("owner@univox.test");
    const orgMember = await registerUser("orgmember@univox.test", "Org Member");
    const organizationId = await createOwnedOrg(owner.tokens.accessToken, "Studio One", "studio-one");
    await addOrgMember(
      jsonRequest(
        `http://localhost/api/v1/organizations/${organizationId}/members`,
        "POST",
        { email: "orgmember@univox.test", role: "MEMBER" },
        owner.tokens.accessToken,
      ),
      routeContext({ organizationId }),
    );
    const created = await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId, name: "Public Hub", slug: "public-hub", visibility: "PUBLIC" },
        owner.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const communityId = (await created.json()).community.id as string;
    const viewed = await getCommunity(
      jsonRequest(`http://localhost/api/v1/communities/${communityId}`, "GET", undefined, orgMember.tokens.accessToken),
      routeContext({ communityId }),
    );
    expect(viewed.status).toBe(200);
    const channels = await listChannels(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/channels`,
        "GET",
        undefined,
        orgMember.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    expect(channels.status).toBe(200);
    await createChannel(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/channels`,
        "POST",
        { name: "General", slug: "general" },
        owner.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    const channelList = await listChannels(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/channels`,
        "GET",
        undefined,
        orgMember.tokens.accessToken,
      ),
      routeContext({ communityId }),
    );
    const channelId = ((await channelList.json()).channels as Array<{ id: string }>)[0].id;
    const cannotPost = await createPost(
      jsonRequest(
        `http://localhost/api/v1/communities/${communityId}/channels/${channelId}/posts`,
        "POST",
        { title: "Nope", body: "not a member" },
        orgMember.tokens.accessToken,
      ),
      routeContext({ communityId, channelId }),
    );
    expect(cannotPost.status).toBe(403);
  });
});
