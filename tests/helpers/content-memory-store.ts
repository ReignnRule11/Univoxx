import { conflict } from "@/lib/errors";
import type { ContentStore, CreateContentInput, CreateMediaInput, FeedQuery } from "@/modules/content/store";
import type {
  ContentCommentRecord,
  ContentReactionRecord,
  ContentRecord,
  ContentShareRecord,
  CreatorFollowRecord,
  MediaAssetRecord,
} from "@/modules/content/types";

function now(): Date {
  return new Date();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createContentMemoryStore(): ContentStore {
  const contents = new Map<string, ContentRecord>();
  const media = new Map<string, MediaAssetRecord>();
  const follows = new Map<string, CreatorFollowRecord>();
  const reactions = new Map<string, ContentReactionRecord>();
  const comments = new Map<string, ContentCommentRecord>();
  const shares = new Map<string, ContentShareRecord>();

  const store: ContentStore = {
    async createContent(input: CreateContentInput) {
      const created: ContentRecord = {
        id: id("content"),
        communityId: input.communityId ?? null,
        authorId: input.authorId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        status: "DRAFT",
        visibility: input.visibility ?? "PRIVATE",
        publishedAt: null,
        deletedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      contents.set(created.id, created);
      return created;
    },
    async findContentById(contentId) {
      return contents.get(contentId) ?? null;
    },
    async listContentByAuthor(authorId) {
      return [...contents.values()]
        .filter((row) => row.authorId === authorId && !row.deletedAt)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async updateContent(contentId, data) {
      const current = contents.get(contentId);
      if (!current) {
        throw new Error("Content not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      contents.set(contentId, updated);
      return updated;
    },
    async listFeed(query: FeedQuery) {
      const followed = new Set(query.followedCreatorIds);
      const cursorTime = query.cursorPublishedAt?.getTime();
      return [...contents.values()]
        .filter((row) => {
          if (row.deletedAt || row.status !== "PUBLISHED" || !row.publishedAt) {
            return false;
          }
          if (query.authorIds && !query.authorIds.includes(row.authorId)) {
            return false;
          }
          if (query.communityId && row.communityId !== query.communityId) {
            return false;
          }
          const visible =
            row.visibility === "PUBLIC" ||
            (row.visibility === "FOLLOWERS" && followed.has(row.authorId)) ||
            row.authorId === query.viewerId;
          if (!visible) {
            return false;
          }
          if (cursorTime && query.cursorId) {
            const published = row.publishedAt.getTime();
            if (published > cursorTime || (published === cursorTime && row.id >= query.cursorId)) {
              return false;
            }
          }
          return true;
        })
        .sort((a, b) => {
          const time = (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
          if (time !== 0) {
            return time;
          }
          return b.id.localeCompare(a.id);
        })
        .slice(0, query.limit);
    },
    async createMedia(input: CreateMediaInput) {
      if ([...media.values()].some((row) => row.storageKey === input.storageKey)) {
        throw conflict("Media storage key already exists");
      }
      const created: MediaAssetRecord = {
        id: id("media"),
        contentId: input.contentId,
        ownerId: input.ownerId,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        checksumSha256: input.checksumSha256,
        originalName: input.originalName ?? null,
        createdAt: now(),
      };
      media.set(created.id, created);
      return created;
    },
    async findMediaById(mediaId) {
      return media.get(mediaId) ?? null;
    },
    async listMediaByContent(contentId) {
      return [...media.values()]
        .filter((row) => row.contentId === contentId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    async deleteMedia(mediaId) {
      media.delete(mediaId);
    },
    async followCreator(followerId, creatorId) {
      const exists = [...follows.values()].find((row) => row.followerId === followerId && row.creatorId === creatorId);
      if (exists) {
        throw conflict("Already following this creator");
      }
      const created: CreatorFollowRecord = {
        id: id("follow"),
        followerId,
        creatorId,
        createdAt: now(),
      };
      follows.set(created.id, created);
      return created;
    },
    async unfollowCreator(followerId, creatorId) {
      for (const row of follows.values()) {
        if (row.followerId === followerId && row.creatorId === creatorId) {
          follows.delete(row.id);
        }
      }
    },
    async findFollow(followerId, creatorId) {
      return [...follows.values()].find((row) => row.followerId === followerId && row.creatorId === creatorId) ?? null;
    },
    async listFollowedCreatorIds(followerId) {
      return [...follows.values()].filter((row) => row.followerId === followerId).map((row) => row.creatorId);
    },
    async createReaction(contentId, userId, emoji) {
      const exists = [...reactions.values()].find(
        (row) => row.contentId === contentId && row.userId === userId && row.emoji === emoji,
      );
      if (exists) {
        throw conflict("Reaction already exists");
      }
      const created: ContentReactionRecord = {
        id: id("creact"),
        contentId,
        userId,
        emoji,
        createdAt: now(),
      };
      reactions.set(created.id, created);
      return created;
    },
    async findReaction(contentId, userId, emoji) {
      return (
        [...reactions.values()].find(
          (row) => row.contentId === contentId && row.userId === userId && row.emoji === emoji,
        ) ?? null
      );
    },
    async listReactions(contentId) {
      return [...reactions.values()].filter((row) => row.contentId === contentId);
    },
    async deleteReaction(reactionId) {
      reactions.delete(reactionId);
    },
    async createComment(input) {
      const created: ContentCommentRecord = {
        id: id("ccomment"),
        contentId: input.contentId,
        authorId: input.authorId,
        parentId: input.parentId ?? null,
        body: input.body,
        status: "PUBLISHED",
        createdAt: now(),
        updatedAt: now(),
      };
      comments.set(created.id, created);
      return created;
    },
    async findCommentById(commentId) {
      return comments.get(commentId) ?? null;
    },
    async listComments(contentId) {
      return [...comments.values()]
        .filter((row) => row.contentId === contentId && row.status === "PUBLISHED")
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    async updateComment(commentId, data) {
      const current = comments.get(commentId);
      if (!current) {
        throw new Error("Comment not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      comments.set(commentId, updated);
      return updated;
    },
    async createShare(contentId, userId) {
      const exists = [...shares.values()].find((row) => row.contentId === contentId && row.userId === userId);
      if (exists) {
        throw conflict("Content already shared");
      }
      const created: ContentShareRecord = {
        id: id("share"),
        contentId,
        userId,
        createdAt: now(),
      };
      shares.set(created.id, created);
      return created;
    },
  };

  return store;
}
