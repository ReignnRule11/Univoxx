import { forbidden } from "@/lib/errors";
import { getCommunityStore } from "@/modules/community/store";
import type { CommentRecord, CommunityRecord, MembershipRecord, PostRecord, ReactionRecord } from "@/modules/community/types";
import { requireViewableContent } from "@/modules/content/authorization";
import { getContentStore } from "@/modules/content/store";
import type { ContentCommentRecord, ContentReactionRecord, ContentRecord, ContentShareRecord, CreatorFollowRecord } from "@/modules/content/types";
import { getEventsStore } from "@/modules/events/store";
import type { EventAttendeeRecord, EventRecord } from "@/modules/events/types";
import { requireOrganizationMember } from "@/modules/identity/authorization";
import type { UserRecord } from "@/modules/identity/types";
import { getPaymentsStore } from "@/modules/payments/store";
import type { CreatorMembershipRecord, TransactionRecord } from "@/modules/payments/types";
import { publicAnalyticsEvent } from "./serializers";
import { getAnalyticsStore } from "./store";
import type {
  AnalyticsEventRecord,
  ChartPoint,
  CommunityMetrics,
  ContentMetrics,
  CreatorDashboard,
  DateRange,
  EventMetrics,
  MonetizationMetrics,
  PublicAnalyticsEvent,
} from "./types";

const DEFAULT_RANGE_MS = 30 * 24 * 60 * 60 * 1000;

function inRange(at: Date, range: DateRange): boolean {
  return at.getTime() >= range.from.getTime() && at.getTime() <= range.to.getTime();
}

function onOrBefore(at: Date, end: Date): boolean {
  return at.getTime() <= end.getTime();
}

function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfUtcDay(value: Date): Date {
  return new Date(`${utcDay(value)}T00:00:00.000Z`);
}

function eachUtcDay(range: DateRange): string[] {
  const days: string[] = [];
  const cursor = startOfUtcDay(range.from);
  const last = startOfUtcDay(range.to);
  while (cursor.getTime() <= last.getTime()) {
    days.push(utcDay(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function series(range: DateRange, timestamps: Date[]): ChartPoint[] {
  const counts = new Map<string, number>();
  for (const day of eachUtcDay(range)) {
    counts.set(day, 0);
  }
  for (const at of timestamps) {
    if (!inRange(at, range)) {
      continue;
    }
    const day = utcDay(at);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()].map(([date, value]) => ({ date, value }));
}

function moneySeries(range: DateRange, rows: Array<{ at: Date; amount: number }>): ChartPoint[] {
  const counts = new Map<string, number>();
  for (const day of eachUtcDay(range)) {
    counts.set(day, 0);
  }
  for (const row of rows) {
    if (!inRange(row.at, range)) {
      continue;
    }
    const day = utcDay(row.at);
    counts.set(day, (counts.get(day) ?? 0) + row.amount);
  }
  return [...counts.entries()].map(([date, value]) => ({ date, value }));
}

export function resolveRange(input?: { from?: string; to?: string }, now = new Date()): DateRange {
  const to = input?.to ? new Date(input.to) : now;
  const from = input?.from ? new Date(input.from) : new Date(to.getTime() - DEFAULT_RANGE_MS);
  return { from, to };
}

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Number((numerator / denominator).toFixed(4));
}

function isActiveMembership(row: MembershipRecord): boolean {
  return row.status === "ACTIVE";
}

function uniqueCount(ids: string[]): number {
  return new Set(ids).size;
}

function succeededAt(row: TransactionRecord): Date {
  return row.succeededAt ?? row.createdAt;
}

async function scopedCommunities(userId: string, organizationId?: string): Promise<CommunityRecord[]> {
  const created = await getCommunityStore().listCommunitiesByCreator(userId);
  if (!organizationId) {
    return created;
  }
  return created.filter((row) => row.organizationId === organizationId);
}

function contentInScope(rows: ContentRecord[], communities: CommunityRecord[], organizationId?: string): ContentRecord[] {
  if (!organizationId) {
    return rows.filter((row) => !row.deletedAt);
  }
  const ids = new Set(communities.map((row) => row.id));
  return rows.filter((row) => !row.deletedAt && row.communityId && ids.has(row.communityId));
}

function eventsInScope(rows: EventRecord[], organizationId?: string): EventRecord[] {
  if (!organizationId) {
    return rows;
  }
  return rows.filter((row) => row.organizationId === organizationId);
}

function audienceMetrics(followers: CreatorFollowRecord[], memberships: MembershipRecord[], range: DateRange) {
  const currentFollowers = followers.filter((row) => onOrBefore(row.createdAt, range.to));
  const joined = currentFollowers.filter((row) => inRange(row.createdAt, range));
  const activeMembers = uniqueCount(
    memberships.filter((row) => isActiveMembership(row) && onOrBefore(row.createdAt, range.to)).map((row) => row.userId),
  );
  return {
    followers: currentFollowers.length,
    followerGrowth: joined.length,
    activeMembers,
  };
}

function contentMetrics(
  contents: ContentRecord[],
  views: AnalyticsEventRecord[],
  likes: ContentReactionRecord[],
  comments: ContentCommentRecord[],
  shares: ContentShareRecord[],
  range: DateRange,
): ContentMetrics {
  const published = contents.filter((row) => row.status === "PUBLISHED" && row.publishedAt && inRange(row.publishedAt, range));
  const ids = new Set(contents.map((row) => row.id));
  const viewCount = views.filter((row) => row.contentId && ids.has(row.contentId) && inRange(row.createdAt, range)).length;
  const likeCount = likes.filter((row) => ids.has(row.contentId) && inRange(row.createdAt, range)).length;
  const commentCount = comments.filter((row) => ids.has(row.contentId) && inRange(row.createdAt, range)).length;
  const shareCount = shares.filter((row) => ids.has(row.contentId) && inRange(row.createdAt, range)).length;
  return {
    published: published.length,
    views: viewCount,
    likes: likeCount,
    comments: commentCount,
    shares: shareCount,
    engagementRate: rate(likeCount + commentCount + shareCount, viewCount),
  };
}

function communityMetrics(
  communities: CommunityRecord[],
  memberships: MembershipRecord[],
  posts: PostRecord[],
  comments: CommentRecord[],
  reactions: ReactionRecord[],
  range: DateRange,
): CommunityMetrics {
  const communityIds = new Set(communities.map((row) => row.id));
  const members = memberships.filter(
    (row) => communityIds.has(row.communityId) && isActiveMembership(row) && onOrBefore(row.createdAt, range.to),
  );
  const rangedPosts = posts.filter((row) => communityIds.has(row.communityId) && inRange(row.createdAt, range));
  const rangedComments = comments.filter((row) => communityIds.has(row.communityId) && inRange(row.createdAt, range));
  const rangedReactions = reactions.filter((row) => communityIds.has(row.communityId) && inRange(row.createdAt, range));
  const activeIds = [
    ...rangedPosts.map((row) => row.authorId),
    ...rangedComments.map((row) => row.authorId),
    ...rangedReactions.map((row) => row.userId),
  ];
  return {
    communities: communities.length,
    members: uniqueCount(members.map((row) => row.userId)),
    activeMembers: uniqueCount(activeIds),
    posts: rangedPosts.length,
    comments: rangedComments.length,
    reactions: rangedReactions.length,
    engagement: rangedPosts.length + rangedComments.length + rangedReactions.length,
  };
}

function monetizationMetrics(
  transactions: TransactionRecord[],
  memberships: CreatorMembershipRecord[],
  range: DateRange,
): MonetizationMetrics {
  const succeeded = transactions.filter(
    (row) => row.status === "SUCCEEDED" && inRange(succeededAt(row), range),
  );
  const refunded = transactions.filter((row) => row.status === "REFUNDED" && row.refundedAt && inRange(row.refundedAt, range));
  const subscriptions = memberships.filter((row) => inRange(row.startsAt, range)).length;
  const payingMembers = uniqueCount(
    memberships
      .filter(
        (row) =>
          row.status === "ACTIVE" &&
          onOrBefore(row.startsAt, range.to) &&
          (!row.expiresAt || row.expiresAt.getTime() > range.to.getTime()),
      )
      .map((row) => row.subscriberId),
  );
  return {
    grossRevenueCents: succeeded.reduce((sum, row) => sum + row.amountCents, 0),
    platformFeeCents: succeeded.reduce((sum, row) => sum + row.platformFeeCents, 0),
    creatorEarningsCents: succeeded.reduce((sum, row) => sum + row.creatorAmountCents, 0),
    succeededPayments: succeeded.length,
    refundedPayments: refunded.length,
    subscriptions,
    payingMembers,
    currency: succeeded[0]?.currency ?? transactions[0]?.currency ?? "USD",
  };
}

function eventMetrics(events: EventRecord[], attendees: EventAttendeeRecord[], range: DateRange): EventMetrics {
  const ids = new Set(events.map((row) => row.id));
  const registrations = attendees.filter((row) => ids.has(row.eventId) && inRange(row.registeredAt, range));
  const attendance = attendees.filter(
    (row) =>
      ids.has(row.eventId) &&
      row.checkedInAt &&
      inRange(row.checkedInAt, range) &&
      (row.status === "CHECKED_IN" || row.status === "LEFT"),
  );
  const hosted = events.filter((row) => inRange(row.createdAt, range) || (row.publishedAt && inRange(row.publishedAt, range)));
  return {
    events: hosted.length,
    registrations: registrations.length,
    attendance: attendance.length,
  };
}

export async function getCreatorDashboard(
  user: UserRecord,
  input: { from?: string; to?: string; organizationId?: string } = {},
): Promise<CreatorDashboard> {
  if (input.organizationId) {
    await requireOrganizationMember(user.id, input.organizationId);
  }
  const range = resolveRange(input);
  const [
    contents,
    followers,
    transactions,
    membershipGrants,
    hostedEvents,
    communities,
  ] = await Promise.all([
    getContentStore().listContentByAuthor(user.id),
    getContentStore().listFollowersByCreator(user.id),
    getPaymentsStore().listTransactionsByRecipient(user.id),
    getPaymentsStore().listMembershipsByCreator(user.id),
    getEventsStore().listEventsByHost(user.id),
    scopedCommunities(user.id, input.organizationId),
  ]);
  const scopedContent = contentInScope(contents, communities, input.organizationId);
  const scopedEvents = eventsInScope(hostedEvents, input.organizationId);
  const contentIds = scopedContent.map((row) => row.id);
  const communityIds = communities.map((row) => row.id);
  const eventIds = scopedEvents.map((row) => row.id);
  const [
    views,
    likes,
    comments,
    shares,
    communityMemberships,
    posts,
    communityComments,
    communityReactions,
    attendees,
  ] = await Promise.all([
    getAnalyticsStore().listEvents({ name: "content.view", creatorId: user.id, contentIds }),
    getContentStore().listReactionsByContentIds(contentIds),
    getContentStore().listCommentsByContentIds(contentIds),
    getContentStore().listSharesByContentIds(contentIds),
    Promise.all(communityIds.map((id) => getCommunityStore().listMemberships(id))).then((rows) => rows.flat()),
    getCommunityStore().listPostsByCommunityIds(communityIds),
    getCommunityStore().listCommentsByCommunityIds(communityIds),
    getCommunityStore().listReactionsByCommunityIds(communityIds),
    getEventsStore().listAttendeesByEventIds(eventIds),
  ]);

  const content = contentMetrics(scopedContent, views, likes, comments, shares, range);
  const community = communityMetrics(communities, communityMemberships, posts, communityComments, communityReactions, range);
  const monetization = monetizationMetrics(transactions, membershipGrants, range);
  const events = eventMetrics(scopedEvents, attendees, range);
  const audience = audienceMetrics(followers, communityMemberships, range);

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    audience,
    content,
    community,
    monetization,
    events,
    charts: {
      followers: series(
        range,
        followers.filter((row) => onOrBefore(row.createdAt, range.to)).map((row) => row.createdAt),
      ),
      views: series(
        range,
        views.filter((row) => row.contentId && contentIds.includes(row.contentId)).map((row) => row.createdAt),
      ),
      revenueCents: moneySeries(
        range,
        transactions
          .filter((row) => row.status === "SUCCEEDED")
          .map((row) => ({ at: succeededAt(row), amount: row.amountCents })),
      ),
      eventRegistrations: series(range, attendees.filter((row) => eventIds.includes(row.eventId)).map((row) => row.registeredAt)),
    },
  };
}

export async function recordContentView(viewerId: string, contentId: string): Promise<PublicAnalyticsEvent | null> {
  const content = await requireViewableContent(contentId, viewerId);
  if (content.authorId === viewerId) {
    return null;
  }
  const store = getAnalyticsStore();
  const existing = await store.findView(viewerId, content.id);
  if (existing) {
    return publicAnalyticsEvent(existing);
  }
  try {
    const created = await store.createEvent({
      name: "content.view",
      userId: viewerId,
      creatorId: content.authorId,
      contentId: content.id,
      communityId: content.communityId,
    });
    return publicAnalyticsEvent(created);
  } catch {
    const raced = await store.findView(viewerId, content.id);
    if (raced) {
      return publicAnalyticsEvent(raced);
    }
    throw forbidden("Unable to record content view");
  }
}

export function verifiedAnalyticsSnapshot(dashboard: CreatorDashboard): Record<string, number | string> {
  return {
    followers: dashboard.audience.followers,
    followerGrowth: dashboard.audience.followerGrowth,
    activeMembers: dashboard.audience.activeMembers,
    published: dashboard.content.published,
    views: dashboard.content.views,
    likes: dashboard.content.likes,
    comments: dashboard.content.comments,
    shares: dashboard.content.shares,
    engagementRate: dashboard.content.engagementRate,
    communityMembers: dashboard.community.members,
    communityActiveMembers: dashboard.community.activeMembers,
    communityPosts: dashboard.community.posts,
    communityEngagement: dashboard.community.engagement,
    grossRevenueCents: dashboard.monetization.grossRevenueCents,
    platformFeeCents: dashboard.monetization.platformFeeCents,
    creatorEarningsCents: dashboard.monetization.creatorEarningsCents,
    subscriptions: dashboard.monetization.subscriptions,
    payingMembers: dashboard.monetization.payingMembers,
    eventRegistrations: dashboard.events.registrations,
    eventAttendance: dashboard.events.attendance,
    rangeFrom: dashboard.range.from,
    rangeTo: dashboard.range.to,
  };
}
