-- CreateEnum
CREATE TYPE "EventAccessType" AS ENUM ('FREE', 'SUBSCRIBER', 'PAID');

-- CreateEnum
CREATE TYPE "EventAttendeeStatus" AS ENUM ('REGISTERED', 'CHECKED_IN', 'LEFT');

-- CreateEnum
CREATE TYPE "EventRecordingStatus" AS ENUM ('NONE', 'REQUESTED', 'AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "EventChatStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "communityId" DROP NOT NULL;
ALTER TABLE "Event" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Event" ADD COLUMN "description" TEXT;
ALTER TABLE "Event" ADD COLUMN "accessType" "EventAccessType" NOT NULL DEFAULT 'FREE';
ALTER TABLE "Event" ADD COLUMN "priceCents" INTEGER;
ALTER TABLE "Event" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Event" ADD COLUMN "capacity" INTEGER;
ALTER TABLE "Event" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "endedAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "liveProvider" TEXT;
ALTER TABLE "Event" ADD COLUMN "liveRoomId" TEXT;
ALTER TABLE "Event" ADD COLUMN "recordingStatus" "EventRecordingStatus" NOT NULL DEFAULT 'NONE';

ALTER TABLE "Event" DROP CONSTRAINT "Event_communityId_fkey";
ALTER TABLE "Event" ADD CONSTRAINT "Event_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Event_hostId_startsAt_idx" ON "Event"("hostId", "startsAt");
CREATE INDEX "Event_communityId_status_idx" ON "Event"("communityId", "status");
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");

-- CreateTable
CREATE TABLE "EventAttendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EventAttendeeStatus" NOT NULL DEFAULT 'REGISTERED',
    "transactionId" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAttendee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventAttendee_eventId_userId_key" ON "EventAttendee"("eventId", "userId");
CREATE INDEX "EventAttendee_eventId_status_idx" ON "EventAttendee"("eventId", "status");
CREATE INDEX "EventAttendee_userId_idx" ON "EventAttendee"("userId");

ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "EventChatMessage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "EventChatStatus" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventChatMessage_eventId_createdAt_idx" ON "EventChatMessage"("eventId", "createdAt");

ALTER TABLE "EventChatMessage" ADD CONSTRAINT "EventChatMessage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventChatMessage" ADD CONSTRAINT "EventChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "EventRecording" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "status" "EventRecordingStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRecording_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventRecording_eventId_status_idx" ON "EventRecording"("eventId", "status");

ALTER TABLE "EventRecording" ADD CONSTRAINT "EventRecording_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "EventTranscript" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "recordingId" TEXT,
    "source" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "summary" TEXT,
    "jobStatus" "AiJobStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTranscript_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventTranscript_eventId_idx" ON "EventTranscript"("eventId");

ALTER TABLE "EventTranscript" ADD CONSTRAINT "EventTranscript_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
