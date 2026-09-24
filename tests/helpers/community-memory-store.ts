import { conflict } from "@/lib/errors";
import type {
  CommunityStore,
  CreateChannelInput,
  CreateCommentInput,
  CreateCommunityInput,
  CreateModerationActionInput,
  CreateNotificationInput,
  CreatePostInput,
  CreateReactionInput,
  CreateReportInput,
} from "@/modules/community/store";
import type {
  ChannelRecord,
  CommentRecord,
  CommunityRecord,
  CommunityRole,
  MembershipRecord,
  ModerationActionRecord,
  NotificationRecord,
  PostRecord,
  ReactionRecord,
  ReportRecord,
} from "@/modules/community/types";

function now(): Date {
  return new Date();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createCommunityMemoryStore(): CommunityStore {
  const communities = new Map<string, CommunityRecord>();
  const memberships = new Map<string, MembershipRecord>();
  const channels = new Map<string, ChannelRecord>();
  const posts = new Map<string, PostRecord>();
  const comments = new Map<string, CommentRecord>();
  const reactions = new Map<string, ReactionRecord>();
  const reports = new Map<string, ReportRecord>();
  const actions = new Map<string, ModerationActionRecord>();
  const notifications = new Map<string, NotificationRecord>();

  const store: CommunityStore = {
    async createCommunity(input: CreateCommunityInput) {
      const exists = [...communities.values()].some(
        (row) => row.organizationId === input.organizationId && row.slug === input.slug,
      );
      if (exists) {
        throw conflict("Community slug is already taken in this organization");
      }
      const created: CommunityRecord = {
        id: id("community"),
        organizationId: input.organizationId,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        visibility: input.visibility ?? "PRIVATE",
        createdById: input.createdById,
        createdAt: now(),
        updatedAt: now(),
      };
      communities.set(created.id, created);
      return created;
    },
    async findCommunityById(communityId) {
      return communities.get(communityId) ?? null;
    },
    async findCommunityByOrgSlug(organizationId, slug) {
      return (
        [...communities.values()].find((row) => row.organizationId === organizationId && row.slug === slug) ?? null
      );
    },
    async listCommunitiesByOrganization(organizationId) {
      return [...communities.values()].filter((row) => row.organizationId === organizationId);
    },
    async listCommunitiesByIds(ids) {
      return ids.map((communityId) => communities.get(communityId)).filter((row): row is CommunityRecord => Boolean(row));
    },
    async updateCommunity(communityId, data) {
      const current = communities.get(communityId);
      if (!current) {
        throw new Error("Community not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      communities.set(communityId, updated);
      return updated;
    },
    async deleteCommunity(communityId) {
      communities.delete(communityId);
      for (const member of [...memberships.values()]) {
        if (member.communityId === communityId) {
          memberships.delete(member.id);
        }
      }
    },
    async createMembership(communityId, userId, role: CommunityRole) {
      const exists = [...memberships.values()].find((row) => row.communityId === communityId && row.userId === userId);
      if (exists) {
        throw conflict("User is already a member of this community");
      }
      const created: MembershipRecord = {
        id: id("cmember"),
        communityId,
        userId,
        role,
        status: "ACTIVE",
        createdAt: now(),
        updatedAt: now(),
      };
      memberships.set(created.id, created);
      return created;
    },
    async findMembership(communityId, userId) {
      return (
        [...memberships.values()].find((row) => row.communityId === communityId && row.userId === userId) ?? null
      );
    },
    async findMembershipById(communityId, memberId) {
      const member = memberships.get(memberId);
      if (!member || member.communityId !== communityId) {
        return null;
      }
      return member;
    },
    async listMemberships(communityId) {
      return [...memberships.values()].filter((row) => row.communityId === communityId);
    },
    async listMembershipsForUser(userId) {
      return [...memberships.values()].filter((row) => row.userId === userId);
    },
    async listModeratorUserIds(communityId) {
      return [...memberships.values()]
        .filter(
          (row) =>
            row.communityId === communityId &&
            row.status === "ACTIVE" &&
            (row.role === "OWNER" || row.role === "ADMIN" || row.role === "MODERATOR"),
        )
        .map((row) => row.userId);
    },
    async updateMembership(memberId, data) {
      const current = memberships.get(memberId);
      if (!current) {
        throw new Error("Member not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      memberships.set(memberId, updated);
      return updated;
    },
    async removeMembership(memberId) {
      memberships.delete(memberId);
    },
    async countOwners(communityId) {
      return [...memberships.values()].filter(
        (row) => row.communityId === communityId && row.role === "OWNER" && row.status === "ACTIVE",
      ).length;
    },
    async createChannel(input: CreateChannelInput) {
      const exists = [...channels.values()].some(
        (row) => row.communityId === input.communityId && row.slug === input.slug,
      );
      if (exists) {
        throw conflict("Channel slug is already taken in this community");
      }
      const created: ChannelRecord = {
        id: id("channel"),
        communityId: input.communityId,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        visibility: input.visibility ?? "OPEN",
        createdById: input.createdById,
        createdAt: now(),
        updatedAt: now(),
      };
      channels.set(created.id, created);
      return created;
    },
    async findChannelById(channelId) {
      return channels.get(channelId) ?? null;
    },
    async findChannelByCommunitySlug(communityId, slug) {
      return [...channels.values()].find((row) => row.communityId === communityId && row.slug === slug) ?? null;
    },
    async listChannels(communityId) {
      return [...channels.values()].filter((row) => row.communityId === communityId);
    },
    async updateChannel(channelId, data) {
      const current = channels.get(channelId);
      if (!current) {
        throw new Error("Channel not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      channels.set(channelId, updated);
      return updated;
    },
    async deleteChannel(channelId) {
      channels.delete(channelId);
    },
    async createPost(input: CreatePostInput) {
      const created: PostRecord = {
        id: id("post"),
        communityId: input.communityId,
        channelId: input.channelId,
        authorId: input.authorId,
        title: input.title,
        body: input.body,
        status: "PUBLISHED",
        createdAt: now(),
        updatedAt: now(),
      };
      posts.set(created.id, created);
      return created;
    },
    async findPostById(postId) {
      return posts.get(postId) ?? null;
    },
    async listPostsByChannel(channelId) {
      return [...posts.values()]
        .filter((row) => row.channelId === channelId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async updatePost(postId, data) {
      const current = posts.get(postId);
      if (!current) {
        throw new Error("Post not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      posts.set(postId, updated);
      return updated;
    },
    async createComment(input: CreateCommentInput) {
      const created: CommentRecord = {
        id: id("comment"),
        communityId: input.communityId,
        postId: input.postId,
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
    async listCommentsByPost(postId) {
      return [...comments.values()]
        .filter((row) => row.postId === postId)
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
    async createReaction(input: CreateReactionInput) {
      const exists = [...reactions.values()].find(
        (row) =>
          row.userId === input.userId &&
          row.targetType === input.targetType &&
          row.targetId === input.targetId &&
          row.emoji === input.emoji,
      );
      if (exists) {
        throw conflict("Reaction already exists");
      }
      const created: ReactionRecord = {
        id: id("reaction"),
        communityId: input.communityId,
        userId: input.userId,
        targetType: input.targetType,
        targetId: input.targetId,
        emoji: input.emoji,
        createdAt: now(),
      };
      reactions.set(created.id, created);
      return created;
    },
    async findReaction(userId, targetType, targetId, emoji) {
      return (
        [...reactions.values()].find(
          (row) => row.userId === userId && row.targetType === targetType && row.targetId === targetId && row.emoji === emoji,
        ) ?? null
      );
    },
    async listReactions(communityId, targetType, targetId) {
      return [...reactions.values()].filter(
        (row) => row.communityId === communityId && row.targetType === targetType && row.targetId === targetId,
      );
    },
    async deleteReaction(reactionId) {
      reactions.delete(reactionId);
    },
    async createReport(input: CreateReportInput) {
      const created: ReportRecord = {
        id: id("report"),
        communityId: input.communityId,
        reporterId: input.reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details ?? null,
        status: "OPEN",
        resolvedById: null,
        resolvedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      reports.set(created.id, created);
      return created;
    },
    async findReportById(communityId, reportId) {
      const report = reports.get(reportId);
      if (!report || report.communityId !== communityId) {
        return null;
      }
      return report;
    },
    async listReports(communityId) {
      return [...reports.values()].filter((row) => row.communityId === communityId);
    },
    async updateReport(reportId, data) {
      const current = reports.get(reportId);
      if (!current) {
        throw new Error("Report not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      reports.set(reportId, updated);
      return updated;
    },
    async createModerationAction(input: CreateModerationActionInput) {
      const created: ModerationActionRecord = {
        id: id("mod"),
        communityId: input.communityId,
        actorId: input.actorId,
        type: input.type,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason ?? null,
        createdAt: now(),
      };
      actions.set(created.id, created);
      return created;
    },
    async listModerationActions(communityId) {
      return [...actions.values()].filter((row) => row.communityId === communityId);
    },
    async createNotification(input: CreateNotificationInput) {
      const created: NotificationRecord = {
        id: id("notif"),
        userId: input.userId,
        communityId: input.communityId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        readAt: null,
        createdAt: now(),
      };
      notifications.set(created.id, created);
      return created;
    },
    async findNotificationById(userId, notificationId) {
      const notification = notifications.get(notificationId);
      if (!notification || notification.userId !== userId) {
        return null;
      }
      return notification;
    },
    async listNotifications(userId) {
      return [...notifications.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async markNotificationRead(notificationId, readAt) {
      const current = notifications.get(notificationId);
      if (!current) {
        throw new Error("Notification not found");
      }
      const updated = { ...current, readAt };
      notifications.set(notificationId, updated);
      return updated;
    },
  };

  return store;
}
