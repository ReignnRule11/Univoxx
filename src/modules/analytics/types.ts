export const ANALYTICS_EVENT_NAMES = ["content.view"] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type DateRange = {
  from: Date;
  to: Date;
};

export type AnalyticsEventRecord = {
  id: string;
  name: string;
  userId: string | null;
  creatorId: string | null;
  organizationId: string | null;
  contentId: string | null;
  communityId: string | null;
  eventId: string | null;
  payload: unknown;
  createdAt: Date;
};

export type ChartPoint = {
  date: string;
  value: number;
};

export type AudienceMetrics = {
  followers: number;
  followerGrowth: number;
  activeMembers: number;
};

export type ContentMetrics = {
  published: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
};

export type CommunityMetrics = {
  communities: number;
  members: number;
  activeMembers: number;
  posts: number;
  comments: number;
  reactions: number;
  engagement: number;
};

export type MonetizationMetrics = {
  grossRevenueCents: number;
  platformFeeCents: number;
  creatorEarningsCents: number;
  succeededPayments: number;
  refundedPayments: number;
  subscriptions: number;
  payingMembers: number;
  currency: string;
};

export type EventMetrics = {
  events: number;
  registrations: number;
  attendance: number;
};

export type CreatorDashboard = {
  range: { from: string; to: string };
  audience: AudienceMetrics;
  content: ContentMetrics;
  community: CommunityMetrics;
  monetization: MonetizationMetrics;
  events: EventMetrics;
  charts: {
    followers: ChartPoint[];
    views: ChartPoint[];
    revenueCents: ChartPoint[];
    eventRegistrations: ChartPoint[];
  };
};

export type PublicAnalyticsEvent = {
  id: string;
  name: string;
  createdAt: string;
};
