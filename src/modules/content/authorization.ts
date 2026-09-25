import { forbidden, notFound } from "@/lib/errors";
import { requireActiveCommunityMember, requireCommunityView } from "@/modules/community/authorization";
import type { ContentRecord, ContentVisibility } from "./types";
import { getContentStore } from "./store";

export async function requireContent(contentId: string): Promise<ContentRecord> {
  const content = await getContentStore().findContentById(contentId);
  if (!content || content.deletedAt) {
    throw notFound("Content not found");
  }
  return content;
}

export async function canAssociateCommunity(userId: string, communityId: string): Promise<void> {
  await requireActiveCommunityMember(userId, communityId);
}

export async function canViewCommunityContent(userId: string, communityId: string): Promise<boolean> {
  try {
    await requireCommunityView(userId, communityId);
    return true;
  } catch {
    return false;
  }
}

export async function isFollowing(followerId: string, creatorId: string): Promise<boolean> {
  const follow = await getContentStore().findFollow(followerId, creatorId);
  return Boolean(follow);
}

export function visibilityAllowsViewer(
  visibility: ContentVisibility,
  authorId: string,
  viewerId: string,
  followsAuthor: boolean,
): boolean {
  if (authorId === viewerId) {
    return true;
  }
  if (visibility === "PUBLIC" || visibility === "UNLISTED") {
    return true;
  }
  if (visibility === "FOLLOWERS") {
    return followsAuthor;
  }
  return false;
}

export async function assertCanViewContent(content: ContentRecord, viewerId: string): Promise<void> {
  if (content.authorId === viewerId) {
    return;
  }
  if (content.status !== "PUBLISHED" || !content.publishedAt) {
    throw forbidden("Content is not publicly available");
  }
  const followsAuthor = content.visibility === "FOLLOWERS" ? await isFollowing(viewerId, content.authorId) : false;
  if (!visibilityAllowsViewer(content.visibility, content.authorId, viewerId, followsAuthor)) {
    throw forbidden("Not allowed to access this content");
  }
  if (content.communityId) {
    const allowed = await canViewCommunityContent(viewerId, content.communityId);
    if (!allowed) {
      throw forbidden("Not allowed to access this content");
    }
  }
}

export async function requireViewableContent(contentId: string, viewerId: string): Promise<ContentRecord> {
  const content = await requireContent(contentId);
  await assertCanViewContent(content, viewerId);
  return content;
}

export async function requireContentOwner(contentId: string, userId: string): Promise<ContentRecord> {
  const content = await requireContent(contentId);
  if (content.authorId !== userId) {
    throw forbidden("Only the author can manage this content");
  }
  return content;
}
