-- AlterTable
ALTER TABLE "AiJob" ADD COLUMN "provider" TEXT;
ALTER TABLE "AiJob" ADD COLUMN "model" TEXT;
ALTER TABLE "AiJob" ADD COLUMN "promptHash" TEXT;
ALTER TABLE "AiJob" ADD COLUMN "inputTokens" INTEGER;
ALTER TABLE "AiJob" ADD COLUMN "outputTokens" INTEGER;
ALTER TABLE "AiJob" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "AiJob" ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "AiJob_userId_createdAt_idx" ON "AiJob"("userId", "createdAt");
CREATE INDEX "AiJob_kind_status_idx" ON "AiJob"("kind", "status");

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiUsage_userId_createdAt_idx" ON "AiUsage"("userId", "createdAt");
CREATE INDEX "AiUsage_provider_createdAt_idx" ON "AiUsage"("provider", "createdAt");

ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AiJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
