import type { AnalyticsEventRecord, PublicAnalyticsEvent } from "./types";

export function publicAnalyticsEvent(row: AnalyticsEventRecord): PublicAnalyticsEvent {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}
