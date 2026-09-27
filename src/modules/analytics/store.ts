import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AnalyticsEventRecord } from "./types";

export type CreateAnalyticsEventInput = {
  name: string;
  userId?: string | null;
  creatorId?: string | null;
  organizationId?: string | null;
  contentId?: string | null;
  communityId?: string | null;
  eventId?: string | null;
  payload?: unknown;
};

export type AnalyticsStore = {
  createEvent(input: CreateAnalyticsEventInput): Promise<AnalyticsEventRecord>;
  findView(userId: string, contentId: string): Promise<AnalyticsEventRecord | null>;
  listEvents(query: {
    name?: string;
    creatorId?: string;
    organizationId?: string;
    contentIds?: string[];
  }): Promise<AnalyticsEventRecord[]>;
};

function toRecord(row: {
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
}): AnalyticsEventRecord {
  return row;
}

export const prismaAnalyticsStore: AnalyticsStore = {
  async createEvent(input) {
    return toRecord(
      await prisma.analyticsEvent.create({
        data: {
          name: input.name,
          userId: input.userId ?? null,
          creatorId: input.creatorId ?? null,
          organizationId: input.organizationId ?? null,
          contentId: input.contentId ?? null,
          communityId: input.communityId ?? null,
          eventId: input.eventId ?? null,
          payload: (input.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      }),
    );
  },
  async findView(userId, contentId) {
    const row = await prisma.analyticsEvent.findUnique({
      where: { name_userId_contentId: { name: "content.view", userId, contentId } },
    });
    return row ? toRecord(row) : null;
  },
  async listEvents(query) {
    if (query.contentIds && query.contentIds.length === 0) {
      return [];
    }
    return (
      await prisma.analyticsEvent.findMany({
        where: {
          ...(query.name ? { name: query.name } : {}),
          ...(query.creatorId ? { creatorId: query.creatorId } : {}),
          ...(query.organizationId ? { organizationId: query.organizationId } : {}),
          ...(query.contentIds ? { contentId: { in: query.contentIds } } : {}),
        },
        orderBy: { createdAt: "asc" },
      })
    ).map(toRecord);
  },
};

let activeStore: AnalyticsStore = prismaAnalyticsStore;

export function getAnalyticsStore(): AnalyticsStore {
  return activeStore;
}

export function setAnalyticsStore(store: AnalyticsStore): void {
  activeStore = store;
}

export function resetAnalyticsStore(): void {
  activeStore = prismaAnalyticsStore;
}
