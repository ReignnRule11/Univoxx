import { forbidden, notFound } from "@/lib/errors";
import type { UserRecord } from "@/modules/identity/types";
import {
  canPostInChannel,
  canSeeContent,
  canViewChannel,
  hasMinCommunityRole,
  isActiveMember,
  requireActiveCommunityMember,
  requireCommunityView,
} from "./authorization";
import { publicChannel, publicComment, publicPost, publicReaction } from "./serializers";
import { getCommunityStore } from "./store";
import type {
  ChannelVisibility,
  PublicChannel,
  PublicComment,
  PublicPost,
  PublicReaction,
  ReactionTargetType,
} from "./types";

export async function listChannels(userId: string, communityId: string): Promise<PublicChannel[]> {
  const { membership } = await requireCommunityView(userId, communityId);
  const channels = await getCommunityStore().listChannels(communityId);
  return channels.filter((channel) => canViewChannel(membership, channel.visibility)).map(publicChannel);
}

export async function createChannel(
  user: UserRecord,
  communityId: string,
  input: { name: string; slug: string; description?: string; visibility?: ChannelVisibility },
): Promise<PublicChannel> {
  await requireActiveCommunityMember(user.id, communityId, "ADMIN");
  const channel = await getCommunityStore().createChannel({
    communityId,
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    visibility: input.visibility ?? "OPEN",
    createdById: user.id,
  });
  return publicChannel(channel);
}

export async function getChannel(userId: string, communityId: string, channelId: string): Promise<PublicChannel> {
  const { membership } = await requireCommunityView(userId, communityId);
  const channel = await getCommunityStore().findChannelById(channelId);
  if (!channel || channel.communityId !== communityId) {
    throw notFound("Channel not found");
  }
  if (!canViewChannel(membership, channel.visibility)) {
    throw forbidden("Insufficient permissions for this channel");
  }
  return publicChannel(channel);
}

export async function updateChannel(
  user: UserRecord,
  communityId: string,
  channelId: string,
  input: { name?: string; description?: string | null; visibility?: ChannelVisibility },
): Promise<PublicChannel> {
  await requireActiveCommunityMember(user.id, communityId, "ADMIN");
  const channel = await getCommunityStore().findChannelById(channelId);
  if (!channel || channel.communityId !== communityId) {
    throw notFound("Channel not found");
  }
  return publicChannel(await getCommunityStore().updateChannel(channelId, input));
}

export async function deleteChannel(user: UserRecord, communityId: string, channelId: string): Promise<void> {
  await requireActiveCommunityMember(user.id, communityId, "ADMIN");
  const channel = await getCommunityStore().findChannelById(channelId);
  if (!channel || channel.communityId !== communityId) {
    throw notFound("Channel not found");
  }
  await getCommunityStore().deleteChannel(channelId);
}

async function requireVisibleChannel(userId: string, communityId: string, channelId: string) {
  const view = await requireCommunityView(userId, communityId);
  const channel = await getCommunityStore().findChannelById(channelId);
  if (!channel || channel.communityId !== communityId) {
    throw notFound("Channel not found");
  }
  if (!canViewChannel(view.membership, channel.visibility)) {
    throw forbidden("Insufficient permissions for this channel");
  }
  return { ...view, channel };
}

export async function listPosts(userId: string, communityId: string, channelId: string): Promise<PublicPost[]> {
  const { membership } = await requireVisibleChannel(userId, communityId, channelId);
  const posts = await getCommunityStore().listPostsByChannel(channelId);
  return posts
    .filter((post) => post.communityId === communityId && canSeeContent(post.status, post.authorId, userId, membership))
    .map(publicPost);
}

export async function createPost(
  user: UserRecord,
  communityId: string,
  channelId: string,
  input: { title: string; body: string },
): Promise<PublicPost> {
  const { membership, channel } = await requireVisibleChannel(user.id, communityId, channelId);
  if (!canPostInChannel(membership, channel.visibility)) {
    throw forbidden("Insufficient permissions to post in this channel");
  }
  const post = await getCommunityStore().createPost({
    communityId,
    channelId,
    authorId: user.id,
    title: input.title,
    body: input.body,
  });
  return publicPost(post);
}

export async function getPost(userId: string, communityId: string, postId: string): Promise<PublicPost> {
  const post = await getCommunityStore().findPostById(postId);
  if (!post || post.communityId !== communityId) {
    throw notFound("Post not found");
  }
  const { membership } = await requireVisibleChannel(userId, communityId, post.channelId);
  if (!canSeeContent(post.status, post.authorId, userId, membership)) {
    throw notFound("Post not found");
  }
  return publicPost(post);
}

export async function updatePost(
  user: UserRecord,
  communityId: string,
  postId: string,
  input: { title?: string; body?: string },
): Promise<PublicPost> {
  const post = await getCommunityStore().findPostById(postId);
  if (!post || post.communityId !== communityId) {
    throw notFound("Post not found");
  }
  const { membership } = await requireVisibleChannel(user.id, communityId, post.channelId);
  if (post.status === "DELETED") {
    throw notFound("Post not found");
  }
  if (post.authorId !== user.id) {
    throw forbidden("Cannot edit another member's post");
  }
  if (!isActiveMember(membership)) {
    throw forbidden("Not a member of this community");
  }
  return publicPost(await getCommunityStore().updatePost(postId, input));
}

export async function deletePost(user: UserRecord, communityId: string, postId: string): Promise<PublicPost> {
  const post = await getCommunityStore().findPostById(postId);
  if (!post || post.communityId !== communityId) {
    throw notFound("Post not found");
  }
  const { membership } = await requireVisibleChannel(user.id, communityId, post.channelId);
  const isModerator = isActiveMember(membership) && hasMinCommunityRole(membership.role, "MODERATOR");
  if (post.authorId !== user.id && !isModerator) {
    throw forbidden("Cannot delete this post");
  }
  return publicPost(await getCommunityStore().updatePost(postId, { status: "DELETED" }));
}

export async function listComments(userId: string, communityId: string, postId: string): Promise<PublicComment[]> {
  await getPost(userId, communityId, postId);
  const { membership } = await requireCommunityView(userId, communityId);
  const comments = await getCommunityStore().listCommentsByPost(postId);
  return comments
    .filter((comment) => comment.communityId === communityId && canSeeContent(comment.status, comment.authorId, userId, membership))
    .map(publicComment);
}

export async function createComment(
  user: UserRecord,
  communityId: string,
  postId: string,
  input: { body: string; parentId?: string },
): Promise<PublicComment> {
  const post = await getCommunityStore().findPostById(postId);
  if (!post || post.communityId !== communityId || post.status !== "PUBLISHED") {
    throw notFound("Post not found");
  }
  const { membership } = await requireVisibleChannel(user.id, communityId, post.channelId);
  if (!isActiveMember(membership)) {
    throw forbidden("Not a member of this community");
  }
  if (input.parentId) {
    const parent = await getCommunityStore().findCommentById(input.parentId);
    if (!parent || parent.postId !== postId || parent.communityId !== communityId) {
      throw notFound("Parent comment not found");
    }
  }
  const comment = await getCommunityStore().createComment({
    communityId,
    postId,
    authorId: user.id,
    parentId: input.parentId ?? null,
    body: input.body,
  });
  if (post.authorId !== user.id) {
    await getCommunityStore().createNotification({
      userId: post.authorId,
      communityId,
      type: "POST_COMMENT",
      title: "New comment on your post",
      body: "Someone commented on your post",
      data: { communityId, postId, commentId: comment.id },
    });
  }
  return publicComment(comment);
}

export async function updateComment(
  user: UserRecord,
  communityId: string,
  commentId: string,
  body: string,
): Promise<PublicComment> {
  const comment = await getCommunityStore().findCommentById(commentId);
  if (!comment || comment.communityId !== communityId) {
    throw notFound("Comment not found");
  }
  await getPost(user.id, communityId, comment.postId);
  if (comment.authorId !== user.id) {
    throw forbidden("Cannot edit another member's comment");
  }
  if (comment.status === "DELETED") {
    throw notFound("Comment not found");
  }
  return publicComment(await getCommunityStore().updateComment(commentId, { body }));
}

export async function deleteComment(user: UserRecord, communityId: string, commentId: string): Promise<PublicComment> {
  const comment = await getCommunityStore().findCommentById(commentId);
  if (!comment || comment.communityId !== communityId) {
    throw notFound("Comment not found");
  }
  const { membership } = await requireCommunityView(user.id, communityId);
  const isModerator = isActiveMember(membership) && hasMinCommunityRole(membership.role, "MODERATOR");
  if (comment.authorId !== user.id && !isModerator) {
    throw forbidden("Cannot delete this comment");
  }
  return publicComment(await getCommunityStore().updateComment(commentId, { status: "DELETED" }));
}

async function requireReactionTarget(
  userId: string,
  communityId: string,
  targetType: ReactionTargetType,
  targetId: string,
) {
  if (targetType === "POST") {
    await getPost(userId, communityId, targetId);
    return;
  }
  const comment = await getCommunityStore().findCommentById(targetId);
  if (!comment || comment.communityId !== communityId) {
    throw notFound("Comment not found");
  }
  await getPost(userId, communityId, comment.postId);
}

export async function listReactions(
  userId: string,
  communityId: string,
  targetType: ReactionTargetType,
  targetId: string,
): Promise<PublicReaction[]> {
  await requireReactionTarget(userId, communityId, targetType, targetId);
  const reactions = await getCommunityStore().listReactions(communityId, targetType, targetId);
  return reactions.map(publicReaction);
}

export async function createReaction(
  user: UserRecord,
  communityId: string,
  input: { targetType: ReactionTargetType; targetId: string; emoji: string },
): Promise<PublicReaction> {
  const { membership } = await requireCommunityView(user.id, communityId);
  if (!isActiveMember(membership)) {
    throw forbidden("Not a member of this community");
  }
  await requireReactionTarget(user.id, communityId, input.targetType, input.targetId);
  const reaction = await getCommunityStore().createReaction({
    communityId,
    userId: user.id,
    targetType: input.targetType,
    targetId: input.targetId,
    emoji: input.emoji,
  });
  return publicReaction(reaction);
}

export async function removeReaction(
  user: UserRecord,
  communityId: string,
  input: { targetType: ReactionTargetType; targetId: string; emoji: string },
): Promise<void> {
  await requireActiveCommunityMember(user.id, communityId);
  const reaction = await getCommunityStore().findReaction(user.id, input.targetType, input.targetId, input.emoji);
  if (!reaction || reaction.communityId !== communityId) {
    throw notFound("Reaction not found");
  }
  await getCommunityStore().deleteReaction(reaction.id);
}
