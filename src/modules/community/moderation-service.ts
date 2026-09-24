import { forbidden, notFound, validationError } from "@/lib/errors";
import type { UserRecord } from "@/modules/identity/types";
import { isActiveMember, requireActiveCommunityMember } from "./authorization";
import { publicModerationAction, publicReport } from "./serializers";
import { getCommunityStore } from "./store";
import type {
  ModerationActionType,
  PublicModerationAction,
  PublicReport,
  ReportStatus,
  ReportTargetType,
} from "./types";

async function notifyModerators(
  communityId: string,
  actorId: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  const store = getCommunityStore();
  const moderatorIds = await store.listModeratorUserIds(communityId);
  await Promise.all(
    moderatorIds
      .filter((userId) => userId !== actorId)
      .map((userId) =>
        store.createNotification({
          userId,
          communityId,
          type: "REPORT_OPENED",
          title,
          body,
          data,
        }),
      ),
  );
}

async function notifyTarget(
  userId: string,
  communityId: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  await getCommunityStore().createNotification({
    userId,
    communityId,
    type: "MODERATION_ACTION",
    title,
    body,
    data,
  });
}

async function requireTarget(
  communityId: string,
  targetType: ReportTargetType,
  targetId: string,
) {
  const store = getCommunityStore();
  if (targetType === "POST") {
    const post = await store.findPostById(targetId);
    if (!post || post.communityId !== communityId) {
      throw notFound("Post not found");
    }
    return { authorId: post.authorId };
  }
  const comment = await store.findCommentById(targetId);
  if (!comment || comment.communityId !== communityId) {
    throw notFound("Comment not found");
  }
  return { authorId: comment.authorId };
}

export async function createReport(
  user: UserRecord,
  communityId: string,
  input: { targetType: ReportTargetType; targetId: string; reason: string; details?: string },
): Promise<PublicReport> {
  const { membership } = await requireActiveCommunityMember(user.id, communityId);
  if (!isActiveMember(membership)) {
    throw forbidden("Not a member of this community");
  }
  await requireTarget(communityId, input.targetType, input.targetId);
  const report = await getCommunityStore().createReport({
    communityId,
    reporterId: user.id,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    details: input.details ?? null,
  });
  await notifyModerators(communityId, user.id, "New report", "A member reported content", {
    communityId,
    reportId: report.id,
    targetType: input.targetType,
    targetId: input.targetId,
  });
  return publicReport(report);
}

export async function listReports(userId: string, communityId: string): Promise<PublicReport[]> {
  await requireActiveCommunityMember(userId, communityId, "MODERATOR");
  const reports = await getCommunityStore().listReports(communityId);
  return reports.map(publicReport);
}

export async function updateReport(
  user: UserRecord,
  communityId: string,
  reportId: string,
  status: ReportStatus,
): Promise<PublicReport> {
  await requireActiveCommunityMember(user.id, communityId, "MODERATOR");
  if (status === "OPEN") {
    throw validationError("Report status must be RESOLVED or DISMISSED");
  }
  const store = getCommunityStore();
  const report = await store.findReportById(communityId, reportId);
  if (!report) {
    throw notFound("Report not found");
  }
  const updated = await store.updateReport(report.id, {
    status,
    resolvedById: user.id,
    resolvedAt: new Date(),
  });
  return publicReport(updated);
}

export async function listModerationActions(userId: string, communityId: string): Promise<PublicModerationAction[]> {
  await requireActiveCommunityMember(userId, communityId, "MODERATOR");
  const actions = await getCommunityStore().listModerationActions(communityId);
  return actions.map(publicModerationAction);
}

export async function applyModerationAction(
  user: UserRecord,
  communityId: string,
  input: { type: ModerationActionType; targetType: string; targetId: string; reason?: string },
): Promise<PublicModerationAction> {
  await requireActiveCommunityMember(user.id, communityId, "MODERATOR");
  const store = getCommunityStore();

  switch (input.type) {
    case "HIDE_POST":
    case "UNHIDE_POST":
    case "REMOVE_POST": {
      const post = await store.findPostById(input.targetId);
      if (!post || post.communityId !== communityId) {
        throw notFound("Post not found");
      }
      const status = input.type === "HIDE_POST" ? "HIDDEN" : input.type === "UNHIDE_POST" ? "PUBLISHED" : "DELETED";
      await store.updatePost(post.id, { status });
      await notifyTarget(post.authorId, communityId, "Post moderated", `A moderator applied ${input.type}`, {
        communityId,
        postId: post.id,
        type: input.type,
      });
      break;
    }
    case "HIDE_COMMENT":
    case "UNHIDE_COMMENT":
    case "REMOVE_COMMENT": {
      const comment = await store.findCommentById(input.targetId);
      if (!comment || comment.communityId !== communityId) {
        throw notFound("Comment not found");
      }
      const status = input.type === "HIDE_COMMENT" ? "HIDDEN" : input.type === "UNHIDE_COMMENT" ? "PUBLISHED" : "DELETED";
      await store.updateComment(comment.id, { status });
      await notifyTarget(comment.authorId, communityId, "Comment moderated", `A moderator applied ${input.type}`, {
        communityId,
        commentId: comment.id,
        type: input.type,
      });
      break;
    }
    case "BAN_MEMBER":
    case "UNBAN_MEMBER": {
      const member = await store.findMembershipById(communityId, input.targetId);
      if (!member) {
        throw notFound("Member not found");
      }
      if (member.userId === user.id) {
        throw forbidden("Cannot moderate your own membership");
      }
      if (member.role === "OWNER" || member.role === "ADMIN") {
        throw forbidden("Cannot moderate this member");
      }
      await store.updateMembership(member.id, { status: input.type === "BAN_MEMBER" ? "BANNED" : "ACTIVE" });
      await notifyTarget(
        member.userId,
        communityId,
        input.type === "BAN_MEMBER" ? "You were banned" : "You were unbanned",
        `A moderator applied ${input.type}`,
        { communityId, memberId: member.id, type: input.type },
      );
      break;
    }
    default:
      throw validationError("Unsupported moderation action");
  }

  const action = await store.createModerationAction({
    communityId,
    actorId: user.id,
    type: input.type,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason ?? null,
  });
  return publicModerationAction(action);
}
