import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { GET as listContent, POST as createContent } from "@/app/api/v1/content/route";
import { GET as getContent, PATCH as patchContent, DELETE as deleteContent } from "@/app/api/v1/content/[contentId]/route";
import { POST as publishContent } from "@/app/api/v1/content/[contentId]/publish/route";
import { POST as archiveContent } from "@/app/api/v1/content/[contentId]/archive/route";
import { POST as uploadMedia } from "@/app/api/v1/content/[contentId]/media/route";
import { GET as getMedia } from "@/app/api/v1/content/[contentId]/media/[mediaId]/route";
import { GET as getFeed } from "@/app/api/v1/content/feed/route";
import { POST as followCreator } from "@/app/api/v1/creators/[creatorId]/follow/route";
import { POST as createComment } from "@/app/api/v1/content/[contentId]/comments/route";
import { POST as createReaction } from "@/app/api/v1/content/[contentId]/reactions/route";
import { POST as shareContent } from "@/app/api/v1/content/[contentId]/shares/route";
import { POST as createCommunity } from "@/app/api/v1/communities/route";
import { MemoryStorageProvider, resetStorageProvider, setStorageProvider } from "@/lib/storage";
import { resetRateLimitStore } from "@/lib/security";
import { resetCommunityStore, setCommunityStore } from "@/modules/community/store";
import { resetContentStore, setContentStore } from "@/modules/content/store";
import { resetIdentityStore, setIdentityStore } from "@/modules/identity/store";
import { createCommunityMemoryStore } from "./helpers/community-memory-store";
import { createContentMemoryStore } from "./helpers/content-memory-store";
import { emptyRouteContext, routeContext } from "./helpers/invoke";
import { createMemoryStore } from "./helpers/memory-store";

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

describe("content", () => {
  beforeEach(() => {
    resetRateLimitStore();
    setIdentityStore(createMemoryStore());
    setCommunityStore(createCommunityMemoryStore());
    setContentStore(createContentMemoryStore());
    setStorageProvider(new MemoryStorageProvider());
  });

  afterEach(() => {
    resetIdentityStore();
    resetCommunityStore();
    resetContentStore();
    resetStorageProvider();
    resetRateLimitStore();
  });

  it("creates, publishes, and persists content metadata", async () => {
    const creator = await registerUser("creator@univox.test");
    const created = await createContent(
      jsonRequest(
        "http://localhost/api/v1/content",
        "POST",
        { type: "TEXT", title: "Hello", body: "World", visibility: "PUBLIC" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(created.status).toBe(201);
    const body = await created.json();
    expect(body.content.status).toBe("DRAFT");
    expect(body.content.body).toBe("World");
    const contentId = body.content.id as string;
    const published = await publishContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}/publish`, "POST", {}, creator.tokens.accessToken),
      routeContext({ contentId }),
    );
    expect(published.status).toBe(200);
    const publishedBody = await published.json();
    expect(publishedBody.content.status).toBe("PUBLISHED");
    expect(publishedBody.content.publishedAt).toBeTruthy();
    const listed = await listContent(
      jsonRequest("http://localhost/api/v1/content", "GET", undefined, creator.tokens.accessToken),
      emptyRouteContext,
    );
    expect(listed.status).toBe(200);
    expect(((await listed.json()).content as Array<{ id: string }>).some((item) => item.id === contentId)).toBe(true);
  });

  it("uploads media outside postgres and serves it with content permissions", async () => {
    const creator = await registerUser("creator@univox.test");
    const stranger = await registerUser("stranger@univox.test", "Stranger");
    const created = await createContent(
      jsonRequest(
        "http://localhost/api/v1/content",
        "POST",
        { type: "IMAGE", title: "Photo" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const contentId = (await created.json()).content.id as string;
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const form = new FormData();
    form.set("file", new File([bytes], "photo.png", { type: "image/png" }));
    const uploaded = await uploadMedia(
      new Request(`http://localhost/api/v1/content/${contentId}/media`, {
        method: "POST",
        headers: { authorization: `Bearer ${creator.tokens.accessToken}` },
        body: form,
      }),
      routeContext({ contentId }),
    );
    expect(uploaded.status).toBe(201);
    const uploadedBody = await uploaded.json();
    expect(uploadedBody.content.media).toHaveLength(1);
    expect(uploadedBody.content.media[0].byteSize).toBe(bytes.length);
    const mediaId = uploadedBody.content.media[0].id as string;
    const strangerMedia = await getMedia(
      jsonRequest(
        `http://localhost/api/v1/content/${contentId}/media/${mediaId}`,
        "GET",
        undefined,
        stranger.tokens.accessToken,
      ),
      routeContext({ contentId, mediaId }),
    );
    expect(strangerMedia.status).toBe(403);
    await publishContent(
      jsonRequest(
        `http://localhost/api/v1/content/${contentId}/publish`,
        "POST",
        { visibility: "PUBLIC" },
        creator.tokens.accessToken,
      ),
      routeContext({ contentId }),
    );
    const publicMedia = await getMedia(
      jsonRequest(
        `http://localhost/api/v1/content/${contentId}/media/${mediaId}`,
        "GET",
        undefined,
        stranger.tokens.accessToken,
      ),
      routeContext({ contentId, mediaId }),
    );
    expect(publicMedia.status).toBe(200);
    expect(publicMedia.headers.get("content-type")).toContain("image/png");
  });

  it("protects private content and enforces creator ownership", async () => {
    const creator = await registerUser("creator@univox.test");
    const stranger = await registerUser("stranger@univox.test", "Stranger");
    const created = await createContent(
      jsonRequest(
        "http://localhost/api/v1/content",
        "POST",
        { type: "TEXT", title: "Secret", body: "private note", visibility: "PRIVATE" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const contentId = (await created.json()).content.id as string;
    await publishContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}/publish`, "POST", {}, creator.tokens.accessToken),
      routeContext({ contentId }),
    );
    const denied = await getContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}`, "GET", undefined, stranger.tokens.accessToken),
      routeContext({ contentId }),
    );
    expect(denied.status).toBe(403);
    const ownerEdit = await patchContent(
      jsonRequest(
        `http://localhost/api/v1/content/${contentId}`,
        "PATCH",
        { title: "Hijacked" },
        stranger.tokens.accessToken,
      ),
      routeContext({ contentId }),
    );
    expect(ownerEdit.status).toBe(403);
    const ownerGet = await getContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}`, "GET", undefined, creator.tokens.accessToken),
      routeContext({ contentId }),
    );
    expect(ownerGet.status).toBe(200);
  });

  it("returns a deterministic newest feed with pagination", async () => {
    const creator = await registerUser("creator@univox.test");
    const viewer = await registerUser("viewer@univox.test", "Viewer");
    const ids: string[] = [];
    for (const title of ["One", "Two", "Three"]) {
      const created = await createContent(
        jsonRequest(
          "http://localhost/api/v1/content",
          "POST",
          { type: "TEXT", title, body: title, visibility: "PUBLIC" },
          creator.tokens.accessToken,
        ),
        emptyRouteContext,
      );
      const contentId = (await created.json()).content.id as string;
      await publishContent(
        jsonRequest(`http://localhost/api/v1/content/${contentId}/publish`, "POST", {}, creator.tokens.accessToken),
        routeContext({ contentId }),
      );
      ids.push(contentId);
    }
    const first = await getFeed(
      jsonRequest("http://localhost/api/v1/content/feed?scope=newest&limit=2", "GET", undefined, viewer.tokens.accessToken),
      emptyRouteContext,
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.items).toHaveLength(2);
    expect(firstBody.nextCursor).toBeTruthy();
    const second = await getFeed(
      jsonRequest(
        `http://localhost/api/v1/content/feed?scope=newest&limit=2&cursor=${firstBody.nextCursor}`,
        "GET",
        undefined,
        viewer.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.items).toHaveLength(1);
    const allIds = [...firstBody.items, ...secondBody.items].map((item: { id: string }) => item.id);
    expect(new Set(allIds).size).toBe(3);
  });

  it("supports followed-creator and community feeds", async () => {
    const creator = await registerUser("creator@univox.test");
    const other = await registerUser("other@univox.test", "Other");
    const follower = await registerUser("follower@univox.test", "Follower");
    const followed = await createContent(
      jsonRequest(
        "http://localhost/api/v1/content",
        "POST",
        { type: "TEXT", title: "Followed", body: "only followers", visibility: "FOLLOWERS" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const followedId = (await followed.json()).content.id as string;
    await publishContent(
      jsonRequest(`http://localhost/api/v1/content/${followedId}/publish`, "POST", {}, creator.tokens.accessToken),
      routeContext({ contentId: followedId }),
    );
    const publicOther = await createContent(
      jsonRequest(
        "http://localhost/api/v1/content",
        "POST",
        { type: "TEXT", title: "Other", body: "public other", visibility: "PUBLIC" },
        other.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const otherId = (await publicOther.json()).content.id as string;
    await publishContent(
      jsonRequest(`http://localhost/api/v1/content/${otherId}/publish`, "POST", {}, other.tokens.accessToken),
      routeContext({ contentId: otherId }),
    );
    await followCreator(
      jsonRequest(
        `http://localhost/api/v1/creators/${creator.user.id}/follow`,
        "POST",
        {},
        follower.tokens.accessToken,
      ),
      routeContext({ creatorId: creator.user.id }),
    );
    const followingFeed = await getFeed(
      jsonRequest(
        "http://localhost/api/v1/content/feed?scope=following",
        "GET",
        undefined,
        follower.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(followingFeed.status).toBe(200);
    const followingBody = await followingFeed.json();
    expect(followingBody.items.map((item: { id: string }) => item.id)).toEqual([followedId]);

    const org = await createOrg(
      jsonRequest(
        "http://localhost/api/v1/organizations",
        "POST",
        { name: "Studio", slug: "studio" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const organizationId = (await org.json()).organization.id as string;
    const community = await createCommunity(
      jsonRequest(
        "http://localhost/api/v1/communities",
        "POST",
        { organizationId, name: "Hub", slug: "hub", visibility: "PUBLIC" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const communityId = (await community.json()).community.id as string;
    const communityContent = await createContent(
      jsonRequest(
        "http://localhost/api/v1/content",
        "POST",
        { type: "TEXT", title: "Community", body: "inside", visibility: "PUBLIC", communityId },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const communityContentId = (await communityContent.json()).content.id as string;
    await publishContent(
      jsonRequest(
        `http://localhost/api/v1/content/${communityContentId}/publish`,
        "POST",
        {},
        creator.tokens.accessToken,
      ),
      routeContext({ contentId: communityContentId }),
    );
    const communityFeed = await getFeed(
      jsonRequest(
        `http://localhost/api/v1/content/feed?scope=community&communityId=${communityId}`,
        "GET",
        undefined,
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    expect(communityFeed.status).toBe(200);
    const communityBody = await communityFeed.json();
    expect(communityBody.items.map((item: { id: string }) => item.id)).toEqual([communityContentId]);
  });

  it("supports likes, comments, and shares on published content", async () => {
    const creator = await registerUser("creator@univox.test");
    const viewer = await registerUser("viewer@univox.test", "Viewer");
    const created = await createContent(
      jsonRequest(
        "http://localhost/api/v1/content",
        "POST",
        { type: "TEXT", title: "Hello", body: "World", visibility: "PUBLIC" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const contentId = (await created.json()).content.id as string;
    await publishContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}/publish`, "POST", {}, creator.tokens.accessToken),
      routeContext({ contentId }),
    );
    const liked = await createReaction(
      jsonRequest(
        `http://localhost/api/v1/content/${contentId}/reactions`,
        "POST",
        { emoji: "heart" },
        viewer.tokens.accessToken,
      ),
      routeContext({ contentId }),
    );
    expect(liked.status).toBe(201);
    const commented = await createComment(
      jsonRequest(
        `http://localhost/api/v1/content/${contentId}/comments`,
        "POST",
        { body: "Nice work" },
        viewer.tokens.accessToken,
      ),
      routeContext({ contentId }),
    );
    expect(commented.status).toBe(201);
    const shared = await shareContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}/shares`, "POST", {}, viewer.tokens.accessToken),
      routeContext({ contentId }),
    );
    expect(shared.status).toBe(201);
  });

  it("archives and deletes only as the author", async () => {
    const creator = await registerUser("creator@univox.test");
    const stranger = await registerUser("stranger@univox.test", "Stranger");
    const created = await createContent(
      jsonRequest(
        "http://localhost/api/v1/content",
        "POST",
        { type: "TEXT", title: "Hello", body: "World", visibility: "PUBLIC" },
        creator.tokens.accessToken,
      ),
      emptyRouteContext,
    );
    const contentId = (await created.json()).content.id as string;
    const denied = await archiveContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}/archive`, "POST", {}, stranger.tokens.accessToken),
      routeContext({ contentId }),
    );
    expect(denied.status).toBe(403);
    const archived = await archiveContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}/archive`, "POST", {}, creator.tokens.accessToken),
      routeContext({ contentId }),
    );
    expect(archived.status).toBe(200);
    expect((await archived.json()).content.status).toBe("ARCHIVED");
    const deleted = await deleteContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}`, "DELETE", undefined, creator.tokens.accessToken),
      routeContext({ contentId }),
    );
    expect(deleted.status).toBe(200);
    const missing = await getContent(
      jsonRequest(`http://localhost/api/v1/content/${contentId}`, "GET", undefined, creator.tokens.accessToken),
      routeContext({ contentId }),
    );
    expect(missing.status).toBe(404);
  });
});
