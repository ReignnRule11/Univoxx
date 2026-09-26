import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { conflict } from "@/lib/errors";
import type {
  EventAccessType,
  EventAttendeeRecord,
  EventChatMessageRecord,
  EventRecord,
  EventRecordingRecord,
  EventRecordingStatus,
  EventStatus,
  EventTranscriptRecord,
  TranscriptJobStatus,
} from "./types";

export type CreateEventInput = {
  communityId?: string | null;
  organizationId?: string | null;
  hostId: string;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  accessType: EventAccessType;
  priceCents?: number | null;
  currency: string;
  capacity?: number | null;
};

export type UpdateEventInput = Partial<
  Pick<
    EventRecord,
    | "title"
    | "description"
    | "startsAt"
    | "endsAt"
    | "accessType"
    | "priceCents"
    | "currency"
    | "capacity"
    | "status"
    | "publishedAt"
    | "startedAt"
    | "endedAt"
    | "cancelledAt"
    | "liveProvider"
    | "liveRoomId"
    | "recordingStatus"
  >
>;

export type EventsStore = {
  createEvent(input: CreateEventInput): Promise<EventRecord>;
  findEventById(id: string): Promise<EventRecord | null>;
  listEventsByHost(hostId: string): Promise<EventRecord[]>;
  updateEvent(id: string, data: UpdateEventInput): Promise<EventRecord>;
  createAttendee(input: {
    eventId: string;
    userId: string;
    transactionId?: string | null;
  }): Promise<EventAttendeeRecord>;
  findAttendee(eventId: string, userId: string): Promise<EventAttendeeRecord | null>;
  listAttendees(eventId: string): Promise<EventAttendeeRecord[]>;
  countAttendees(eventId: string): Promise<number>;
  updateAttendee(
    id: string,
    data: Partial<Pick<EventAttendeeRecord, "status" | "checkedInAt" | "leftAt">>,
  ): Promise<EventAttendeeRecord>;
  createChatMessage(input: { eventId: string; authorId: string; body: string }): Promise<EventChatMessageRecord>;
  listChatMessages(eventId: string): Promise<EventChatMessageRecord[]>;
  createRecording(input: {
    eventId: string;
    provider: string;
    providerRef?: string | null;
    storageKey?: string | null;
    mimeType?: string | null;
    byteSize?: number | null;
    status?: EventRecordingStatus;
  }): Promise<EventRecordingRecord>;
  findRecordingById(id: string): Promise<EventRecordingRecord | null>;
  listRecordings(eventId: string): Promise<EventRecordingRecord[]>;
  updateRecording(
    id: string,
    data: Partial<Pick<EventRecordingRecord, "status" | "providerRef" | "storageKey" | "mimeType" | "byteSize">>,
  ): Promise<EventRecordingRecord>;
  createTranscript(input: {
    eventId: string;
    recordingId?: string | null;
    source: string;
    text: string;
    summary?: string | null;
    jobStatus?: TranscriptJobStatus;
  }): Promise<EventTranscriptRecord>;
  listTranscripts(eventId: string): Promise<EventTranscriptRecord[]>;
  updateTranscript(
    id: string,
    data: Partial<Pick<EventTranscriptRecord, "summary" | "jobStatus">>,
  ): Promise<EventTranscriptRecord>;
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const prismaEventsStore: EventsStore = {
  async createEvent(input) {
    return prisma.event.create({
      data: {
        communityId: input.communityId ?? null,
        organizationId: input.organizationId ?? null,
        hostId: input.hostId,
        title: input.title,
        description: input.description ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        accessType: input.accessType,
        priceCents: input.priceCents ?? null,
        currency: input.currency,
        capacity: input.capacity ?? null,
      },
    });
  },
  async findEventById(id) {
    return prisma.event.findUnique({ where: { id } });
  },
  async listEventsByHost(hostId) {
    return prisma.event.findMany({ where: { hostId }, orderBy: { startsAt: "desc" } });
  },
  async updateEvent(id, data) {
    return prisma.event.update({ where: { id }, data });
  },
  async createAttendee(input) {
    try {
      return await prisma.eventAttendee.create({
        data: {
          eventId: input.eventId,
          userId: input.userId,
          transactionId: input.transactionId ?? null,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Already registered for this event");
      }
      throw error;
    }
  },
  async findAttendee(eventId, userId) {
    return prisma.eventAttendee.findUnique({ where: { eventId_userId: { eventId, userId } } });
  },
  async listAttendees(eventId) {
    return prisma.eventAttendee.findMany({ where: { eventId }, orderBy: { registeredAt: "asc" } });
  },
  async countAttendees(eventId) {
    return prisma.eventAttendee.count({ where: { eventId } });
  },
  async updateAttendee(id, data) {
    return prisma.eventAttendee.update({ where: { id }, data });
  },
  async createChatMessage(input) {
    return prisma.eventChatMessage.create({
      data: { eventId: input.eventId, authorId: input.authorId, body: input.body },
    });
  },
  async listChatMessages(eventId) {
    return prisma.eventChatMessage.findMany({
      where: { eventId, status: "VISIBLE" },
      orderBy: { createdAt: "asc" },
    });
  },
  async createRecording(input) {
    return prisma.eventRecording.create({
      data: {
        eventId: input.eventId,
        provider: input.provider,
        providerRef: input.providerRef ?? null,
        storageKey: input.storageKey ?? null,
        mimeType: input.mimeType ?? null,
        byteSize: input.byteSize ?? null,
        status: input.status ?? "REQUESTED",
      },
    });
  },
  async findRecordingById(id) {
    return prisma.eventRecording.findUnique({ where: { id } });
  },
  async listRecordings(eventId) {
    return prisma.eventRecording.findMany({ where: { eventId }, orderBy: { createdAt: "desc" } });
  },
  async updateRecording(id, data) {
    return prisma.eventRecording.update({ where: { id }, data });
  },
  async createTranscript(input) {
    return prisma.eventTranscript.create({
      data: {
        eventId: input.eventId,
        recordingId: input.recordingId ?? null,
        source: input.source,
        text: input.text,
        summary: input.summary ?? null,
        jobStatus: input.jobStatus ?? "QUEUED",
      },
    });
  },
  async listTranscripts(eventId) {
    return prisma.eventTranscript.findMany({ where: { eventId }, orderBy: { createdAt: "desc" } });
  },
  async updateTranscript(id, data) {
    return prisma.eventTranscript.update({ where: { id }, data });
  },
};

let activeStore: EventsStore = prismaEventsStore;

export function getEventsStore(): EventsStore {
  return activeStore;
}

export function setEventsStore(store: EventsStore): void {
  activeStore = store;
}

export function resetEventsStore(): void {
  activeStore = prismaEventsStore;
}

export type { EventStatus };
