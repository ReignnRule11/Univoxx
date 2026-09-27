import type { AnalyticsStore, CreateAnalyticsEventInput } from "@/modules/analytics/store";
import type { AnalyticsEventRecord } from "@/modules/analytics/types";

function now(): Date {
  return new Date();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createAnalyticsMemoryStore(): AnalyticsStore {
  const events = new Map<string, AnalyticsEventRecord>();

  return {
    async createEvent(input: CreateAnalyticsEventInput) {
      if (input.name === "content.view" && input.userId && input.contentId) {
        const existing = [...events.values()].find(
          (row) => row.name === "content.view" && row.userId === input.userId && row.contentId === input.contentId,
        );
        if (existing) {
          return existing;
        }
      }
      const created: AnalyticsEventRecord = {
        id: id("analev"),
        name: input.name,
        userId: input.userId ?? null,
        creatorId: input.creatorId ?? null,
        organizationId: input.organizationId ?? null,
        contentId: input.contentId ?? null,
        communityId: input.communityId ?? null,
        eventId: input.eventId ?? null,
        payload: input.payload ?? null,
        createdAt: now(),
      };
      events.set(created.id, created);
      return created;
    },
    async findView(userId, contentId) {
      return (
        [...events.values()].find(
          (row) => row.name === "content.view" && row.userId === userId && row.contentId === contentId,
        ) ?? null
      );
    },
    async listEvents(query) {
      return [...events.values()]
        .filter((row) => {
          if (query.name && row.name !== query.name) {
            return false;
          }
          if (query.creatorId && row.creatorId !== query.creatorId) {
            return false;
          }
          if (query.organizationId && row.organizationId !== query.organizationId) {
            return false;
          }
          if (query.contentIds) {
            if (query.contentIds.length === 0 || !row.contentId || !query.contentIds.includes(row.contentId)) {
              return false;
            }
          }
          return true;
        })
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
  };
}
