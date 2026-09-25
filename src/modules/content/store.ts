import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { conflict } from "@/lib/errors";
import type {
  ContentCommentRecord,
  ContentReactionRecord,
  ContentRecord,
  ContentShareRecord,
  ContentStatus,
  ContentType,
  ContentVisibility,
  CreatorFollowRecord,
  MediaAssetRecord,
} from "./types";

export type CreateContentInput = {
  authorId: string;
  type: ContentType;
  title: string;
  body?: string | null;
  visibility?: ContentVisibility;
  communityId?: string | null;
};

export type CreateMediaInput = {
  contentId: string;
  ownerId: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  originalName?: string | null;
};

export type FeedQuery = {
  authorIds?: string[];
  communityId?: string;
  viewerId: string;
  followedCreatorIds: string[];
  limit: number;
  cursorPublishedAt?: Date;
  cursorId?: string;
};

export type ContentStore = {
  createContent(input: CreateContentInput): Promise<ContentRecord>;
  findContentById(id: string): Promise<ContentRecord | null>;
  listContentByAuthor(authorId: string): Promise<ContentRecord[]>;
  updateContent(
    id: string,
    data: Partial<Pick<ContentRecord, "title" | "body" | "status" | "visibility" | "communityId" | "publishedAt" | "deletedAt">>,
  ): Promise<ContentRecord>;
  listFeed(query: FeedQuery): Promise<ContentRecord[]>;

  createMedia(input: CreateMediaInput): Promise<MediaAssetRecord>;
  findMediaById(id: string): Promise<MediaAssetRecord | null>;
  listMediaByContent(contentId: string): Promise<MediaAssetRecord[]>;
  deleteMedia(id: string): Promise<void>;

  followCreator(followerId: string, creatorId: string): Promise<CreatorFollowRecord>;
  unfollowCreator(followerId: string, creatorId: string): Promise<void>;
  findFollow(followerId: string, creatorId: string): Promise<CreatorFollowRecord | null>;
  listFollowedCreatorIds(followerId: string): Promise<string[]>;

  createReaction(contentId: string, userId: string, emoji: string): Promise<ContentReactionRecord>;
  findReaction(contentId: string, userId: string, emoji: string): Promise<ContentReactionRecord | null>;
  listReactions(contentId: string): Promise<ContentReactionRecord[]>;
  deleteReaction(id: string): Promise<void>;

  createComment(input: {
    contentId: string;
    authorId: string;
    parentId?: string | null;
    body: string;
  }): Promise<ContentCommentRecord>;
  findCommentById(id: string): Promise<ContentCommentRecord | null>;
  listComments(contentId: string): Promise<ContentCommentRecord[]>;
  updateComment(id: string, data: Partial<Pick<ContentCommentRecord, "body" | "status">>): Promise<ContentCommentRecord>;

  createShare(contentId: string, userId: string): Promise<ContentShareRecord>;
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const prismaContentStore: ContentStore = {
  async createContent(input) {
    return prisma.content.create({
      data: {
        authorId: input.authorId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        visibility: input.visibility ?? "PRIVATE",
        communityId: input.communityId ?? null,
        status: "DRAFT",
      },
    });
  },
  async findContentById(id) {
    return prisma.content.findUnique({ where: { id } });
  },
  async listContentByAuthor(authorId) {
    return prisma.content.findMany({
      where: { authorId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },
  async updateContent(id, data) {
    return prisma.content.update({ where: { id }, data });
  },
  async listFeed(query) {
    const visibilityOr: Prisma.ContentWhereInput[] = [{ visibility: "PUBLIC" }];
    if (query.followedCreatorIds.length > 0) {
      visibilityOr.push({
        visibility: "FOLLOWERS",
        authorId: { in: query.followedCreatorIds },
      });
    }
    visibilityOr.push({ visibility: { in: ["UNLISTED", "FOLLOWERS", "PRIVATE"] }, authorId: query.viewerId });

    const where: Prisma.ContentWhereInput = {
      deletedAt: null,
      status: "PUBLISHED",
      publishedAt: { not: null },
      OR: visibilityOr,
    };
    if (query.authorIds) {
      where.authorId = { in: query.authorIds };
    }
    if (query.communityId) {
      where.communityId = query.communityId;
    }
    if (query.cursorPublishedAt && query.cursorId) {
      where.AND = [
        {
          OR: [
            { publishedAt: { lt: query.cursorPublishedAt } },
            { publishedAt: query.cursorPublishedAt, id: { lt: query.cursorId } },
          ],
        },
      ];
    }
    return prisma.content.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: query.limit,
    });
  },
  async createMedia(input) {
    try {
      return await prisma.mediaAsset.create({ data: input });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Media storage key already exists");
      }
      throw error;
    }
  },
  async findMediaById(id) {
    return prisma.mediaAsset.findUnique({ where: { id } });
  },
  async listMediaByContent(contentId) {
    return prisma.mediaAsset.findMany({ where: { contentId }, orderBy: { createdAt: "asc" } });
  },
  async deleteMedia(id) {
    await prisma.mediaAsset.delete({ where: { id } });
  },
  async followCreator(followerId, creatorId) {
    try {
      return await prisma.creatorFollow.create({ data: { followerId, creatorId } });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Already following this creator");
      }
      throw error;
    }
  },
  async unfollowCreator(followerId, creatorId) {
    await prisma.creatorFollow.delete({
      where: { followerId_creatorId: { followerId, creatorId } },
    });
  },
  async findFollow(followerId, creatorId) {
    return prisma.creatorFollow.findUnique({
      where: { followerId_creatorId: { followerId, creatorId } },
    });
  },
  async listFollowedCreatorIds(followerId) {
    const rows = await prisma.creatorFollow.findMany({
      where: { followerId },
      select: { creatorId: true },
    });
    return rows.map((row) => row.creatorId);
  },
  async createReaction(contentId, userId, emoji) {
    try {
      return await prisma.contentReaction.create({ data: { contentId, userId, emoji } });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Reaction already exists");
      }
      throw error;
    }
  },
  async findReaction(contentId, userId, emoji) {
    return prisma.contentReaction.findUnique({
      where: { contentId_userId_emoji: { contentId, userId, emoji } },
    });
  },
  async listReactions(contentId) {
    return prisma.contentReaction.findMany({ where: { contentId } });
  },
  async deleteReaction(id) {
    await prisma.contentReaction.delete({ where: { id } });
  },
  async createComment(input) {
    return prisma.contentComment.create({
      data: {
        contentId: input.contentId,
        authorId: input.authorId,
        parentId: input.parentId ?? null,
        body: input.body,
      },
    });
  },
  async findCommentById(id) {
    return prisma.contentComment.findUnique({ where: { id } });
  },
  async listComments(contentId) {
    return prisma.contentComment.findMany({
      where: { contentId, status: "PUBLISHED" },
      orderBy: { createdAt: "asc" },
    });
  },
  async updateComment(id, data) {
    return prisma.contentComment.update({ where: { id }, data });
  },
  async createShare(contentId, userId) {
    try {
      return await prisma.contentShare.create({ data: { contentId, userId } });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Content already shared");
      }
      throw error;
    }
  },
};

let activeStore: ContentStore = prismaContentStore;

export function getContentStore(): ContentStore {
  return activeStore;
}

export function setContentStore(store: ContentStore): void {
  activeStore = store;
}

export function resetContentStore(): void {
  activeStore = prismaContentStore;
}

export type { ContentStatus };
