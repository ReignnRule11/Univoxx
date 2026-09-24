export const COMMUNITY_ROLES = ["OWNER", "ADMIN", "MODERATOR", "MEMBER"] as const;
export type CommunityRole = (typeof COMMUNITY_ROLES)[number];

export const COMMUNITY_ROLE_RANK: Record<CommunityRole, number> = {
  OWNER: 40,
  ADMIN: 30,
  MODERATOR: 20,
  MEMBER: 10,
};

export const MEMBERSHIP_STATUSES = ["ACTIVE", "INVITED", "BANNED"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const COMMUNITY_VISIBILITIES = ["PUBLIC", "PRIVATE"] as const;
export type CommunityVisibility = (typeof COMMUNITY_VISIBILITIES)[number];

export const CHANNEL_VISIBILITIES = ["OPEN", "RESTRICTED", "PRIVATE"] as const;
export type ChannelVisibility = (typeof CHANNEL_VISIBILITIES)[number];

export const POST_STATUSES = ["PUBLISHED", "HIDDEN", "DELETED"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const COMMENT_STATUSES = ["PUBLISHED", "HIDDEN", "DELETED"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export const REACTION_TARGET_TYPES = ["POST", "COMMENT"] as const;
export type ReactionTargetType = (typeof REACTION_TARGET_TYPES)[number];

export const REPORT_TARGET_TYPES = ["POST", "COMMENT"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const MODERATION_ACTION_TYPES = [
  "HIDE_POST",
  "UNHIDE_POST",
  "REMOVE_POST",
  "HIDE_COMMENT",
  "UNHIDE_COMMENT",
  "REMOVE_COMMENT",
  "BAN_MEMBER",
  "UNBAN_MEMBER",
] as const;
export type ModerationActionType = (typeof MODERATION_ACTION_TYPES)[number];

export const NOTIFICATION_TYPES = [
  "MEMBERSHIP_ADDED",
  "MEMBERSHIP_BANNED",
  "POST_COMMENT",
  "REPORT_OPENED",
  "MODERATION_ACTION",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type CommunityRecord = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: CommunityVisibility;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MembershipRecord = {
  id: string;
  communityId: string;
  userId: string;
  role: CommunityRole;
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ChannelRecord = {
  id: string;
  communityId: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: ChannelVisibility;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PostRecord = {
  id: string;
  communityId: string;
  channelId: string;
  authorId: string;
  title: string;
  body: string;
  status: PostStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CommentRecord = {
  id: string;
  communityId: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  status: CommentStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ReactionRecord = {
  id: string;
  communityId: string;
  userId: string;
  targetType: ReactionTargetType;
  targetId: string;
  emoji: string;
  createdAt: Date;
};

export type ReportRecord = {
  id: string;
  communityId: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ModerationActionRecord = {
  id: string;
  communityId: string;
  actorId: string;
  type: ModerationActionType;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: Date;
};

export type NotificationRecord = {
  id: string;
  userId: string;
  communityId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
};

export type PublicCommunity = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: CommunityVisibility;
  createdAt: string;
  membership: { role: CommunityRole; status: MembershipStatus } | null;
};

export type PublicMembership = {
  id: string;
  communityId: string;
  userId: string;
  role: CommunityRole;
  status: MembershipStatus;
  createdAt: string;
};

export type PublicChannel = {
  id: string;
  communityId: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: ChannelVisibility;
  createdAt: string;
};

export type PublicPost = {
  id: string;
  communityId: string;
  channelId: string;
  authorId: string;
  title: string;
  body: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
};

export type PublicComment = {
  id: string;
  communityId: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
};

export type PublicReaction = {
  id: string;
  communityId: string;
  userId: string;
  targetType: ReactionTargetType;
  targetId: string;
  emoji: string;
  createdAt: string;
};

export type PublicReport = {
  id: string;
  communityId: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type PublicModerationAction = {
  id: string;
  communityId: string;
  actorId: string;
  type: ModerationActionType;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: string;
};

export type PublicNotification = {
  id: string;
  communityId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};
