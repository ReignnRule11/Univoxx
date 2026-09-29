export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ path?: string; message?: string }> | unknown;
  };
};

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  createdAt: string;
};

export type PublicProfile = {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  category: string | null;
  links: Array<{ label: string; url: string }>;
  visibility: string;
  creatorStatus: string;
};

export type PublicOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export type SessionUser = {
  user: PublicUser;
  profile: PublicProfile | null;
  organizations: PublicOrganization[];
};

export type PublicContent = {
  id: string;
  communityId: string | null;
  authorId: string;
  type: string;
  title: string;
  body: string | null;
  status: string;
  visibility: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  media: Array<{
    id: string;
    mimeType: string;
    byteSize: number;
    checksumSha256: string;
    originalName: string | null;
    downloadPath: string;
  }>;
};

export type FeedPage = {
  items: PublicContent[];
  nextCursor: string | null;
};

export type PublicCommunity = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
  createdAt: string;
  membership: { role: string; status: string } | null;
};

export type PublicChannel = {
  id: string;
  communityId: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
  createdAt: string;
};

export type PublicPost = {
  id: string;
  communityId: string;
  channelId: string;
  authorId: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicEvent = {
  id: string;
  communityId: string | null;
  organizationId: string | null;
  hostId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  accessType: string;
  priceCents: number | null;
  currency: string;
  capacity: number | null;
  status: string;
  publishedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  cancelledAt: string | null;
  liveProvider: string | null;
  recordingStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicProduct = {
  id: string;
  creatorId: string;
  type: string;
  name: string;
  description: string | null;
  amountCents: number;
  currency: string;
  intervalDays: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicTransaction = {
  id: string;
  payerId: string;
  recipientId: string;
  productId: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerReference: string;
  platformFeeCents: number;
  creatorAmountCents: number;
  status: string;
  failureReason: string | null;
  succeededAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicNotification = {
  id: string;
  communityId: string | null;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type CreatorDashboard = {
  range: { from: string; to: string };
  audience: { followers: number; followerGrowth: number; activeMembers: number };
  content: {
    published: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagementRate: number;
  };
  community: {
    communities: number;
    members: number;
    activeMembers: number;
    posts: number;
    comments: number;
    reactions: number;
    engagement: number;
  };
  monetization: {
    grossRevenueCents: number;
    platformFeeCents: number;
    creatorEarningsCents: number;
    succeededPayments: number;
    refundedPayments: number;
    subscriptions: number;
    payingMembers: number;
    currency: string;
  };
  events: { events: number; registrations: number; attendance: number };
  charts: {
    followers: Array<{ date: string; value: number }>;
    views: Array<{ date: string; value: number }>;
    revenueCents: Array<{ date: string; value: number }>;
    eventRegistrations: Array<{ date: string; value: number }>;
  };
};
