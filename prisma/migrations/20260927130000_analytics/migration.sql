ALTER TABLE "AnalyticsEvent" ADD COLUMN "creatorId" TEXT;
ALTER TABLE "AnalyticsEvent" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AnalyticsEvent" ADD COLUMN "contentId" TEXT;
ALTER TABLE "AnalyticsEvent" ADD COLUMN "communityId" TEXT;
ALTER TABLE "AnalyticsEvent" ADD COLUMN "eventId" TEXT;

CREATE UNIQUE INDEX "AnalyticsEvent_name_userId_contentId_key" ON "AnalyticsEvent"("name", "userId", "contentId");
CREATE INDEX "AnalyticsEvent_creatorId_name_createdAt_idx" ON "AnalyticsEvent"("creatorId", "name", "createdAt");
CREATE INDEX "AnalyticsEvent_organizationId_name_createdAt_idx" ON "AnalyticsEvent"("organizationId", "name", "createdAt");
CREATE INDEX "AnalyticsEvent_contentId_createdAt_idx" ON "AnalyticsEvent"("contentId", "createdAt");
