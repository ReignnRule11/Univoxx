import type {
  ChannelRecord,
  CommentRecord,
  CommunityRecord,
  MembershipRecord,
  ModerationActionRecord,
  NotificationRecord,
  PostRecord,
  PublicChannel,
  PublicComment,
  PublicCommunity,
  PublicMembership,
  PublicModerationAction,
  PublicNotification,
  PublicPost,
  PublicReaction,
  PublicReport,
  ReactionRecord,
  ReportRecord,
} from "./types";

export function publicCommunity(
  community: CommunityRecord,
  membership: MembershipRecord | null,
): PublicCommunity {
  return {
    id: community.id,
    organizationId: community.organizationId,
    slug: community.slug,
    name: community.name,
    description: community.description,
    visibility: community.visibility,
    createdAt: community.createdAt.toISOString(),
    membership: membership
      ? { role: membership.role, status: membership.status }
      : null,
  };
}

export function publicMembership(member: MembershipRecord): PublicMembership {
  return {
    id: member.id,
    communityId: member.communityId,
    userId: member.userId,
    role: member.role,
    status: member.status,
    createdAt: member.createdAt.toISOString(),
  };
}

export function publicChannel(channel: ChannelRecord): PublicChannel {
  return {
    id: channel.id,
    communityId: channel.communityId,
    slug: channel.slug,
    name: channel.name,
    description: channel.description,
    visibility: channel.visibility,
    createdAt: channel.createdAt.toISOString(),
  };
}

export function publicPost(post: PostRecord): PublicPost {
  return {
    id: post.id,
    communityId: post.communityId,
    channelId: post.channelId,
    authorId: post.authorId,
    title: post.title,
    body: post.body,
    status: post.status,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

export function publicComment(comment: CommentRecord): PublicComment {
  return {
    id: comment.id,
    communityId: comment.communityId,
    postId: comment.postId,
    authorId: comment.authorId,
    parentId: comment.parentId,
    body: comment.body,
    status: comment.status,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

export function publicReaction(reaction: ReactionRecord): PublicReaction {
  return {
    id: reaction.id,
    communityId: reaction.communityId,
    userId: reaction.userId,
    targetType: reaction.targetType,
    targetId: reaction.targetId,
    emoji: reaction.emoji,
    createdAt: reaction.createdAt.toISOString(),
  };
}

export function publicReport(report: ReportRecord): PublicReport {
  return {
    id: report.id,
    communityId: report.communityId,
    reporterId: report.reporterId,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    details: report.details,
    status: report.status,
    resolvedById: report.resolvedById,
    resolvedAt: report.resolvedAt ? report.resolvedAt.toISOString() : null,
    createdAt: report.createdAt.toISOString(),
  };
}

export function publicModerationAction(action: ModerationActionRecord): PublicModerationAction {
  return {
    id: action.id,
    communityId: action.communityId,
    actorId: action.actorId,
    type: action.type,
    targetType: action.targetType,
    targetId: action.targetId,
    reason: action.reason,
    createdAt: action.createdAt.toISOString(),
  };
}

export function publicNotification(notification: NotificationRecord): PublicNotification {
  return {
    id: notification.id,
    communityId: notification.communityId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
  };
}
