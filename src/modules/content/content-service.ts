import { createHash } from "node:crypto";
import { forbidden, notFound, validationError } from "@/lib/errors";
import { checksumSha256, getStorageProvider } from "@/lib/storage";
import type { UserRecord } from "@/modules/identity/types";
import { getIdentityStore } from "@/modules/identity/store";
import {
  assertCanViewContent,
  canAssociateCommunity,
  requireContentOwner,
  requireViewableContent,
} from "./authorization";
import { publicContent, publicContentComment, publicContentReaction, publicContentShare, publicFollow } from "./serializers";
import { getContentStore } from "./store";
import type {
  ContentType,
  ContentVisibility,
  FeedPage,
  FeedScope,
  PublicContent,
  PublicContentComment,
  PublicContentReaction,
  PublicContentShare,
  PublicFollow,
} from "./types";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 32 * 1024 * 1024;

function encodeCursor(publishedAt: Date, id: string): string {
  return Buffer.from(`${publishedAt.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { publishedAt: Date; id: string } {
  const raw = Buffer.from(cursor, "base64url").toString("utf8");
  const [publishedAt, id] = raw.split("|");
  if (!publishedAt || !id) {
    throw validationError("Invalid feed cursor");
  }
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) {
    throw validationError("Invalid feed cursor");
  }
  return { publishedAt: date, id };
}

async function withMedia(content: Parameters<typeof publicContent>[0]): Promise<PublicContent> {
  const media = await getContentStore().listMediaByContent(content.id);
  return publicContent(content, media);
}

export async function createContent(
  user: UserRecord,
  input: {
    type?: ContentType;
    title: string;
    body?: string;
    visibility?: ContentVisibility;
    communityId?: string;
  },
): Promise<PublicContent> {
  const type = input.type ?? "TEXT";
  if (input.communityId) {
    await canAssociateCommunity(user.id, input.communityId);
  }
  const content = await getContentStore().createContent({
    authorId: user.id,
    type,
    title: input.title,
    body: input.body ?? null,
    visibility: input.visibility ?? "PRIVATE",
    communityId: input.communityId ?? null,
  });
  return withMedia(content);
}

export async function listOwnContent(userId: string): Promise<PublicContent[]> {
  const rows = await getContentStore().listContentByAuthor(userId);
  return Promise.all(rows.map((row) => withMedia(row)));
}

export async function getContent(contentId: string, viewerId: string): Promise<PublicContent> {
  const content = await requireViewableContent(contentId, viewerId);
  return withMedia(content);
}

export async function updateContent(
  user: UserRecord,
  contentId: string,
  input: {
    title?: string;
    body?: string | null;
    visibility?: ContentVisibility;
    communityId?: string | null;
  },
): Promise<PublicContent> {
  const current = await requireContentOwner(contentId, user.id);
  if (input.communityId) {
    await canAssociateCommunity(user.id, input.communityId);
  }
  const updated = await getContentStore().updateContent(current.id, input);
  return withMedia(updated);
}

export async function publishContent(
  user: UserRecord,
  contentId: string,
  visibility?: ContentVisibility,
): Promise<PublicContent> {
  const current = await requireContentOwner(contentId, user.id);
  if (current.status === "ARCHIVED") {
    throw forbidden("Archived content cannot be published");
  }
  const media = await getContentStore().listMediaByContent(current.id);
  if (current.type === "TEXT" && !current.body) {
    throw validationError("Text content requires a body before publish");
  }
  if (current.type === "IMAGE" && media.length === 0) {
    throw validationError("Image content requires uploaded media before publish");
  }
  if (current.type === "VIDEO" && media.length === 0) {
    throw validationError("Video content requires uploaded media before publish");
  }
  const updated = await getContentStore().updateContent(current.id, {
    status: "PUBLISHED",
    visibility: visibility ?? current.visibility,
    publishedAt: current.publishedAt ?? new Date(),
  });
  return publicContent(updated, media);
}

export async function archiveContent(user: UserRecord, contentId: string): Promise<PublicContent> {
  const current = await requireContentOwner(contentId, user.id);
  const updated = await getContentStore().updateContent(current.id, { status: "ARCHIVED" });
  return withMedia(updated);
}

export async function deleteContent(user: UserRecord, contentId: string): Promise<void> {
  const current = await requireContentOwner(contentId, user.id);
  await getContentStore().updateContent(current.id, { status: "ARCHIVED", deletedAt: new Date() });
}

export async function uploadMedia(
  user: UserRecord,
  contentId: string,
  input: { filename: string; mimeType: string; body: Buffer },
): Promise<PublicContent> {
  const current = await requireContentOwner(contentId, user.id);
  if (current.type === "TEXT") {
    throw validationError("Text content does not accept media uploads");
  }
  if (current.type === "IMAGE" && !IMAGE_TYPES.has(input.mimeType)) {
    throw validationError("Unsupported image type");
  }
  if (current.type === "VIDEO" && !VIDEO_TYPES.has(input.mimeType)) {
    throw validationError("Unsupported video type");
  }
  const maxBytes = current.type === "VIDEO" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (input.body.length === 0 || input.body.length > maxBytes) {
    throw validationError("Media file is empty or too large");
  }
  const existing = await getContentStore().listMediaByContent(current.id);
  if (existing.length >= 4) {
    throw validationError("Media limit reached for this content");
  }
  const digest = checksumSha256(input.body);
  const key = `content/${current.id}/${createHash("sha256").update(`${user.id}:${digest}:${existing.length}`).digest("hex")}`;
  await getStorageProvider().put(key, input.body, input.mimeType);
  await getContentStore().createMedia({
    contentId: current.id,
    ownerId: user.id,
    storageKey: key,
    mimeType: input.mimeType,
    byteSize: input.body.length,
    checksumSha256: digest,
    originalName: input.filename,
  });
  return withMedia(current);
}

export async function getMediaObject(contentId: string, mediaId: string, viewerId: string) {
  const content = await requireViewableContent(contentId, viewerId);
  const media = await getContentStore().findMediaById(mediaId);
  if (!media || media.contentId !== content.id) {
    throw notFound("Media not found");
  }
  const object = await getStorageProvider().get(media.storageKey);
  if (!object) {
    throw notFound("Media not found");
  }
  return { media, object };
}

export async function listFeed(
  viewerId: string,
  input: { scope: FeedScope; communityId?: string; limit: number; cursor?: string },
): Promise<FeedPage> {
  const store = getContentStore();
  const followedCreatorIds = await store.listFollowedCreatorIds(viewerId);
  const decoded = input.cursor ? decodeCursor(input.cursor) : undefined;
  const query = {
    viewerId,
    followedCreatorIds,
    limit: input.limit + 1,
    cursorPublishedAt: decoded?.publishedAt,
    cursorId: decoded?.id,
    authorIds: input.scope === "following" ? followedCreatorIds : undefined,
    communityId: input.scope === "community" ? input.communityId : undefined,
  };
  if (input.scope === "community") {
    if (!input.communityId) {
      throw validationError("communityId is required for community feed");
    }
    const allowed = await import("./authorization").then((mod) =>
      mod.canViewCommunityContent(viewerId, input.communityId as string),
    );
    if (!allowed) {
      throw forbidden("Not allowed to access this community");
    }
  }
  if (input.scope === "following" && followedCreatorIds.length === 0) {
    return { items: [], nextCursor: null };
  }
  const rows = await store.listFeed(query);
  const visible: PublicContent[] = [];
  for (const row of rows) {
    try {
      await assertCanViewContent(row, viewerId);
      visible.push(await withMedia(row));
    } catch {
      continue;
    }
  }
  const hasMore = visible.length > input.limit;
  const page = visible.slice(0, input.limit);
  const last = page[page.length - 1];
  return {
    items: page,
    nextCursor: hasMore && last?.publishedAt ? encodeCursor(new Date(last.publishedAt), last.id) : null,
  };
}

export async function followCreator(user: UserRecord, creatorId: string): Promise<PublicFollow> {
  if (user.id === creatorId) {
    throw forbidden("Cannot follow yourself");
  }
  const creator = await getIdentityStore().findUserById(creatorId);
  if (!creator || creator.status !== "ACTIVE") {
    throw notFound("Creator not found");
  }
  const follow = await getContentStore().followCreator(user.id, creatorId);
  return publicFollow(follow);
}

export async function unfollowCreator(user: UserRecord, creatorId: string): Promise<void> {
  const existing = await getContentStore().findFollow(user.id, creatorId);
  if (!existing) {
    throw notFound("Follow not found");
  }
  await getContentStore().unfollowCreator(user.id, creatorId);
}

export async function listComments(contentId: string, viewerId: string): Promise<PublicContentComment[]> {
  await requireViewableContent(contentId, viewerId);
  const comments = await getContentStore().listComments(contentId);
  return comments.map(publicContentComment);
}

export async function createComment(
  user: UserRecord,
  contentId: string,
  input: { body: string; parentId?: string },
): Promise<PublicContentComment> {
  const content = await requireViewableContent(contentId, user.id);
  if (content.status !== "PUBLISHED") {
    throw forbidden("Cannot comment on unpublished content");
  }
  if (input.parentId) {
    const parent = await getContentStore().findCommentById(input.parentId);
    if (!parent || parent.contentId !== contentId) {
      throw notFound("Parent comment not found");
    }
  }
  const comment = await getContentStore().createComment({
    contentId,
    authorId: user.id,
    parentId: input.parentId ?? null,
    body: input.body,
  });
  return publicContentComment(comment);
}

export async function listReactions(contentId: string, viewerId: string): Promise<PublicContentReaction[]> {
  await requireViewableContent(contentId, viewerId);
  const reactions = await getContentStore().listReactions(contentId);
  return reactions.map(publicContentReaction);
}

export async function createReaction(user: UserRecord, contentId: string, emoji: string): Promise<PublicContentReaction> {
  await requireViewableContent(contentId, user.id);
  const reaction = await getContentStore().createReaction(contentId, user.id, emoji);
  return publicContentReaction(reaction);
}

export async function deleteReaction(user: UserRecord, contentId: string, emoji: string): Promise<void> {
  await requireViewableContent(contentId, user.id);
  const reaction = await getContentStore().findReaction(contentId, user.id, emoji);
  if (!reaction) {
    throw notFound("Reaction not found");
  }
  await getContentStore().deleteReaction(reaction.id);
}

export async function shareContent(user: UserRecord, contentId: string): Promise<PublicContentShare> {
  const content = await requireViewableContent(contentId, user.id);
  if (content.status !== "PUBLISHED" || content.visibility === "PRIVATE") {
    throw forbidden("Cannot share this content");
  }
  const share = await getContentStore().createShare(contentId, user.id);
  return publicContentShare(share);
}
