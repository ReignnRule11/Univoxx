import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { conflict } from "@/lib/errors";
import type {
  ChannelRecord,
  ChannelVisibility,
  CommentRecord,
  CommunityRecord,
  CommunityRole,
  CommunityVisibility,
  MembershipRecord,
  ModerationActionRecord,
  ModerationActionType,
  NotificationRecord,
  NotificationType,
  PostRecord,
  ReactionRecord,
  ReactionTargetType,
  ReportRecord,
  ReportTargetType,
} from "./types";

export type CreateCommunityInput = {
  organizationId: string;
  slug: string;
  name: string;
  description?: string | null;
  visibility?: CommunityVisibility;
  createdById: string;
};

export type CreateChannelInput = {
  communityId: string;
  slug: string;
  name: string;
  description?: string | null;
  visibility?: ChannelVisibility;
  createdById: string;
};

export type CreatePostInput = {
  communityId: string;
  channelId: string;
  authorId: string;
  title: string;
  body: string;
};

export type CreateCommentInput = {
  communityId: string;
  postId: string;
  authorId: string;
  parentId?: string | null;
  body: string;
};

export type CreateReactionInput = {
  communityId: string;
  userId: string;
  targetType: ReactionTargetType;
  targetId: string;
  emoji: string;
};

export type CreateReportInput = {
  communityId: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string | null;
};

export type CreateModerationActionInput = {
  communityId: string;
  actorId: string;
  type: ModerationActionType;
  targetType: string;
  targetId: string;
  reason?: string | null;
};

export type CreateNotificationInput = {
  userId: string;
  communityId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type CommunityStore = {
  createCommunity(input: CreateCommunityInput): Promise<CommunityRecord>;
  findCommunityById(id: string): Promise<CommunityRecord | null>;
  findCommunityByOrgSlug(organizationId: string, slug: string): Promise<CommunityRecord | null>;
  listCommunitiesByOrganization(organizationId: string): Promise<CommunityRecord[]>;
  listCommunitiesByIds(ids: string[]): Promise<CommunityRecord[]>;
  updateCommunity(
    id: string,
    data: Partial<Pick<CommunityRecord, "name" | "description" | "visibility">>,
  ): Promise<CommunityRecord>;
  deleteCommunity(id: string): Promise<void>;

  createMembership(communityId: string, userId: string, role: CommunityRole): Promise<MembershipRecord>;
  findMembership(communityId: string, userId: string): Promise<MembershipRecord | null>;
  findMembershipById(communityId: string, memberId: string): Promise<MembershipRecord | null>;
  listMemberships(communityId: string): Promise<MembershipRecord[]>;
  listMembershipsForUser(userId: string): Promise<MembershipRecord[]>;
  listModeratorUserIds(communityId: string): Promise<string[]>;
  updateMembership(
    memberId: string,
    data: Partial<Pick<MembershipRecord, "role" | "status">>,
  ): Promise<MembershipRecord>;
  removeMembership(memberId: string): Promise<void>;
  countOwners(communityId: string): Promise<number>;

  createChannel(input: CreateChannelInput): Promise<ChannelRecord>;
  findChannelById(id: string): Promise<ChannelRecord | null>;
  findChannelByCommunitySlug(communityId: string, slug: string): Promise<ChannelRecord | null>;
  listChannels(communityId: string): Promise<ChannelRecord[]>;
  updateChannel(
    id: string,
    data: Partial<Pick<ChannelRecord, "name" | "description" | "visibility">>,
  ): Promise<ChannelRecord>;
  deleteChannel(id: string): Promise<void>;

  createPost(input: CreatePostInput): Promise<PostRecord>;
  findPostById(id: string): Promise<PostRecord | null>;
  listPostsByChannel(channelId: string): Promise<PostRecord[]>;
  updatePost(id: string, data: Partial<Pick<PostRecord, "title" | "body" | "status">>): Promise<PostRecord>;

  createComment(input: CreateCommentInput): Promise<CommentRecord>;
  findCommentById(id: string): Promise<CommentRecord | null>;
  listCommentsByPost(postId: string): Promise<CommentRecord[]>;
  updateComment(id: string, data: Partial<Pick<CommentRecord, "body" | "status">>): Promise<CommentRecord>;

  createReaction(input: CreateReactionInput): Promise<ReactionRecord>;
  findReaction(userId: string, targetType: ReactionTargetType, targetId: string, emoji: string): Promise<ReactionRecord | null>;
  listReactions(communityId: string, targetType: ReactionTargetType, targetId: string): Promise<ReactionRecord[]>;
  deleteReaction(id: string): Promise<void>;

  createReport(input: CreateReportInput): Promise<ReportRecord>;
  findReportById(communityId: string, reportId: string): Promise<ReportRecord | null>;
  listReports(communityId: string): Promise<ReportRecord[]>;
  updateReport(
    id: string,
    data: Partial<Pick<ReportRecord, "status" | "resolvedById" | "resolvedAt">>,
  ): Promise<ReportRecord>;

  createModerationAction(input: CreateModerationActionInput): Promise<ModerationActionRecord>;
  listModerationActions(communityId: string): Promise<ModerationActionRecord[]>;

  createNotification(input: CreateNotificationInput): Promise<NotificationRecord>;
  findNotificationById(userId: string, notificationId: string): Promise<NotificationRecord | null>;
  listNotifications(userId: string): Promise<NotificationRecord[]>;
  markNotificationRead(id: string, readAt: Date | null): Promise<NotificationRecord>;
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toNotification(row: {
  id: string;
  userId: string;
  communityId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
}): NotificationRecord {
  return { ...row, data: asRecord(row.data) };
}

export const prismaCommunityStore: CommunityStore = {
  async createCommunity(input) {
    try {
      return await prisma.community.create({
        data: {
          organizationId: input.organizationId,
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          visibility: input.visibility ?? "PRIVATE",
          createdById: input.createdById,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Community slug is already taken in this organization");
      }
      throw error;
    }
  },
  async findCommunityById(id) {
    return prisma.community.findUnique({ where: { id } });
  },
  async findCommunityByOrgSlug(organizationId, slug) {
    return prisma.community.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
    });
  },
  async listCommunitiesByOrganization(organizationId) {
    return prisma.community.findMany({ where: { organizationId } });
  },
  async listCommunitiesByIds(ids) {
    if (ids.length === 0) {
      return [];
    }
    return prisma.community.findMany({ where: { id: { in: ids } } });
  },
  async updateCommunity(id, data) {
    return prisma.community.update({ where: { id }, data });
  },
  async deleteCommunity(id) {
    await prisma.community.delete({ where: { id } });
  },
  async createMembership(communityId, userId, role) {
    try {
      return await prisma.membership.create({
        data: { communityId, userId, role, status: "ACTIVE" },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("User is already a member of this community");
      }
      throw error;
    }
  },
  async findMembership(communityId, userId) {
    return prisma.membership.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
  },
  async findMembershipById(communityId, memberId) {
    const row = await prisma.membership.findUnique({ where: { id: memberId } });
    if (!row || row.communityId !== communityId) {
      return null;
    }
    return row;
  },
  async listMemberships(communityId) {
    return prisma.membership.findMany({ where: { communityId } });
  },
  async listMembershipsForUser(userId) {
    return prisma.membership.findMany({ where: { userId } });
  },
  async listModeratorUserIds(communityId) {
    const rows = await prisma.membership.findMany({
      where: { communityId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MODERATOR"] } },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  },
  async updateMembership(memberId, data) {
    return prisma.membership.update({ where: { id: memberId }, data });
  },
  async removeMembership(memberId) {
    await prisma.membership.delete({ where: { id: memberId } });
  },
  async countOwners(communityId) {
    return prisma.membership.count({ where: { communityId, role: "OWNER", status: "ACTIVE" } });
  },
  async createChannel(input) {
    try {
      return await prisma.channel.create({
        data: {
          communityId: input.communityId,
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          visibility: input.visibility ?? "OPEN",
          createdById: input.createdById,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Channel slug is already taken in this community");
      }
      throw error;
    }
  },
  async findChannelById(id) {
    return prisma.channel.findUnique({ where: { id } });
  },
  async findChannelByCommunitySlug(communityId, slug) {
    return prisma.channel.findUnique({
      where: { communityId_slug: { communityId, slug } },
    });
  },
  async listChannels(communityId) {
    return prisma.channel.findMany({ where: { communityId } });
  },
  async updateChannel(id, data) {
    return prisma.channel.update({ where: { id }, data });
  },
  async deleteChannel(id) {
    await prisma.channel.delete({ where: { id } });
  },
  async createPost(input) {
    return prisma.post.create({ data: input });
  },
  async findPostById(id) {
    return prisma.post.findUnique({ where: { id } });
  },
  async listPostsByChannel(channelId) {
    return prisma.post.findMany({ where: { channelId }, orderBy: { createdAt: "desc" } });
  },
  async updatePost(id, data) {
    return prisma.post.update({ where: { id }, data });
  },
  async createComment(input) {
    return prisma.comment.create({
      data: {
        communityId: input.communityId,
        postId: input.postId,
        authorId: input.authorId,
        parentId: input.parentId ?? null,
        body: input.body,
      },
    });
  },
  async findCommentById(id) {
    return prisma.comment.findUnique({ where: { id } });
  },
  async listCommentsByPost(postId) {
    return prisma.comment.findMany({ where: { postId }, orderBy: { createdAt: "asc" } });
  },
  async updateComment(id, data) {
    return prisma.comment.update({ where: { id }, data });
  },
  async createReaction(input) {
    try {
      return await prisma.reaction.create({ data: input });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Reaction already exists");
      }
      throw error;
    }
  },
  async findReaction(userId, targetType, targetId, emoji) {
    return prisma.reaction.findUnique({
      where: { userId_targetType_targetId_emoji: { userId, targetType, targetId, emoji } },
    });
  },
  async listReactions(communityId, targetType, targetId) {
    return prisma.reaction.findMany({ where: { communityId, targetType, targetId } });
  },
  async deleteReaction(id) {
    await prisma.reaction.delete({ where: { id } });
  },
  async createReport(input) {
    return prisma.report.create({
      data: {
        communityId: input.communityId,
        reporterId: input.reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details ?? null,
      },
    });
  },
  async findReportById(communityId, reportId) {
    const row = await prisma.report.findUnique({ where: { id: reportId } });
    if (!row || row.communityId !== communityId) {
      return null;
    }
    return row;
  },
  async listReports(communityId) {
    return prisma.report.findMany({ where: { communityId }, orderBy: { createdAt: "desc" } });
  },
  async updateReport(id, data) {
    return prisma.report.update({ where: { id }, data });
  },
  async createModerationAction(input) {
    return prisma.moderationAction.create({
      data: {
        communityId: input.communityId,
        actorId: input.actorId,
        type: input.type,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason ?? null,
      },
    });
  },
  async listModerationActions(communityId) {
    return prisma.moderationAction.findMany({ where: { communityId }, orderBy: { createdAt: "desc" } });
  },
  async createNotification(input) {
    return toNotification(
      await prisma.notification.create({
        data: {
          userId: input.userId,
          communityId: input.communityId ?? null,
          type: input.type,
          title: input.title,
          body: input.body,
          data: (input.data ?? {}) as Prisma.InputJsonValue,
        },
      }),
    );
  },
  async findNotificationById(userId, notificationId) {
    const row = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!row || row.userId !== userId) {
      return null;
    }
    return toNotification(row);
  },
  async listNotifications(userId) {
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toNotification);
  },
  async markNotificationRead(id, readAt) {
    return toNotification(await prisma.notification.update({ where: { id }, data: { readAt } }));
  },
};

let activeStore: CommunityStore = prismaCommunityStore;

export function getCommunityStore(): CommunityStore {
  return activeStore;
}

export function setCommunityStore(store: CommunityStore): void {
  activeStore = store;
}

export function resetCommunityStore(): void {
  activeStore = prismaCommunityStore;
}
