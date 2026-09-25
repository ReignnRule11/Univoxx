import type {
  ContentCommentRecord,
  ContentReactionRecord,
  ContentRecord,
  ContentShareRecord,
  CreatorFollowRecord,
  MediaAssetRecord,
  PublicContent,
  PublicContentComment,
  PublicContentReaction,
  PublicContentShare,
  PublicFollow,
  PublicMediaAsset,
} from "./types";

export function publicMedia(asset: MediaAssetRecord): PublicMediaAsset {
  return {
    id: asset.id,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    checksumSha256: asset.checksumSha256,
    originalName: asset.originalName,
    downloadPath: `/api/v1/content/${asset.contentId}/media/${asset.id}`,
  };
}

export function publicContent(content: ContentRecord, media: MediaAssetRecord[] = []): PublicContent {
  return {
    id: content.id,
    communityId: content.communityId,
    authorId: content.authorId,
    type: content.type,
    title: content.title,
    body: content.body,
    status: content.status,
    visibility: content.visibility,
    publishedAt: content.publishedAt ? content.publishedAt.toISOString() : null,
    createdAt: content.createdAt.toISOString(),
    updatedAt: content.updatedAt.toISOString(),
    media: media.map(publicMedia),
  };
}

export function publicContentComment(comment: ContentCommentRecord): PublicContentComment {
  return {
    id: comment.id,
    contentId: comment.contentId,
    authorId: comment.authorId,
    parentId: comment.parentId,
    body: comment.body,
    status: comment.status,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

export function publicContentReaction(reaction: ContentReactionRecord): PublicContentReaction {
  return {
    id: reaction.id,
    contentId: reaction.contentId,
    userId: reaction.userId,
    emoji: reaction.emoji,
    createdAt: reaction.createdAt.toISOString(),
  };
}

export function publicContentShare(share: ContentShareRecord): PublicContentShare {
  return {
    id: share.id,
    contentId: share.contentId,
    userId: share.userId,
    createdAt: share.createdAt.toISOString(),
  };
}

export function publicFollow(follow: CreatorFollowRecord): PublicFollow {
  return {
    id: follow.id,
    followerId: follow.followerId,
    creatorId: follow.creatorId,
    createdAt: follow.createdAt.toISOString(),
  };
}
