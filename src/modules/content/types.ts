export const CONTENT_TYPES = ["TEXT", "IMAGE", "VIDEO"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_VISIBILITIES = ["PUBLIC", "UNLISTED", "FOLLOWERS", "PRIVATE"] as const;
export type ContentVisibility = (typeof CONTENT_VISIBILITIES)[number];

export const CONTENT_COMMENT_STATUSES = ["PUBLISHED", "HIDDEN", "DELETED"] as const;
export type ContentCommentStatus = (typeof CONTENT_COMMENT_STATUSES)[number];

export const FEED_SCOPES = ["newest", "following", "community"] as const;
export type FeedScope = (typeof FEED_SCOPES)[number];

export type ContentRecord = {
  id: string;
  communityId: string | null;
  authorId: string;
  type: ContentType;
  title: string;
  body: string | null;
  status: ContentStatus;
  visibility: ContentVisibility;
  publishedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MediaAssetRecord = {
  id: string;
  contentId: string;
  ownerId: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  originalName: string | null;
  createdAt: Date;
};

export type CreatorFollowRecord = {
  id: string;
  followerId: string;
  creatorId: string;
  createdAt: Date;
};

export type ContentReactionRecord = {
  id: string;
  contentId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
};

export type ContentCommentRecord = {
  id: string;
  contentId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  status: ContentCommentStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ContentShareRecord = {
  id: string;
  contentId: string;
  userId: string;
  createdAt: Date;
};

export type PublicMediaAsset = {
  id: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  originalName: string | null;
  downloadPath: string;
};

export type PublicContent = {
  id: string;
  communityId: string | null;
  authorId: string;
  type: ContentType;
  title: string;
  body: string | null;
  status: ContentStatus;
  visibility: ContentVisibility;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  media: PublicMediaAsset[];
};

export type PublicContentComment = {
  id: string;
  contentId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  status: ContentCommentStatus;
  createdAt: string;
  updatedAt: string;
};

export type PublicContentReaction = {
  id: string;
  contentId: string;
  userId: string;
  emoji: string;
  createdAt: string;
};

export type PublicContentShare = {
  id: string;
  contentId: string;
  userId: string;
  createdAt: string;
};

export type PublicFollow = {
  id: string;
  followerId: string;
  creatorId: string;
  createdAt: string;
};

export type FeedPage = {
  items: PublicContent[];
  nextCursor: string | null;
};
