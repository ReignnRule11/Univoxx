import { conflict } from "@/lib/errors";
import type { CreateEventInput, EventsStore, UpdateEventInput } from "@/modules/events/store";
import type {
  EventAttendeeRecord,
  EventChatMessageRecord,
  EventRecord,
  EventRecordingRecord,
  EventTranscriptRecord,
} from "@/modules/events/types";

function now(): Date {
  return new Date();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createEventsMemoryStore(): EventsStore {
  const events = new Map<string, EventRecord>();
  const attendees = new Map<string, EventAttendeeRecord>();
  const messages = new Map<string, EventChatMessageRecord>();
  const recordings = new Map<string, EventRecordingRecord>();
  const transcripts = new Map<string, EventTranscriptRecord>();

  const store: EventsStore = {
    async createEvent(input: CreateEventInput) {
      const created: EventRecord = {
        id: id("event"),
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
        status: "DRAFT",
        publishedAt: null,
        startedAt: null,
        endedAt: null,
        cancelledAt: null,
        liveProvider: null,
        liveRoomId: null,
        recordingStatus: "NONE",
        createdAt: now(),
        updatedAt: now(),
      };
      events.set(created.id, created);
      return created;
    },
    async findEventById(eventId) {
      return events.get(eventId) ?? null;
    },
    async listEventsByHost(hostId) {
      return [...events.values()]
        .filter((row) => row.hostId === hostId)
        .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
    },
    async updateEvent(eventId, data: UpdateEventInput) {
      const current = events.get(eventId);
      if (!current) {
        throw new Error("Event not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      events.set(eventId, updated);
      return updated;
    },
    async createAttendee(input) {
      if ([...attendees.values()].some((row) => row.eventId === input.eventId && row.userId === input.userId)) {
        throw conflict("Already registered for this event");
      }
      const created: EventAttendeeRecord = {
        id: id("attendee"),
        eventId: input.eventId,
        userId: input.userId,
        status: "REGISTERED",
        transactionId: input.transactionId ?? null,
        registeredAt: now(),
        checkedInAt: null,
        leftAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      attendees.set(created.id, created);
      return created;
    },
    async findAttendee(eventId, userId) {
      return [...attendees.values()].find((row) => row.eventId === eventId && row.userId === userId) ?? null;
    },
    async listAttendees(eventId) {
      return [...attendees.values()]
        .filter((row) => row.eventId === eventId)
        .sort((a, b) => a.registeredAt.getTime() - b.registeredAt.getTime());
    },
    async countAttendees(eventId) {
      return [...attendees.values()].filter((row) => row.eventId === eventId).length;
    },
    async updateAttendee(attendeeId, data) {
      const current = attendees.get(attendeeId);
      if (!current) {
        throw new Error("Attendee not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      attendees.set(attendeeId, updated);
      return updated;
    },
    async createChatMessage(input) {
      const created: EventChatMessageRecord = {
        id: id("chat"),
        eventId: input.eventId,
        authorId: input.authorId,
        body: input.body,
        status: "VISIBLE",
        createdAt: now(),
      };
      messages.set(created.id, created);
      return created;
    },
    async listChatMessages(eventId) {
      return [...messages.values()]
        .filter((row) => row.eventId === eventId && row.status === "VISIBLE")
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    async createRecording(input) {
      const created: EventRecordingRecord = {
        id: id("recording"),
        eventId: input.eventId,
        provider: input.provider,
        providerRef: input.providerRef ?? null,
        storageKey: input.storageKey ?? null,
        mimeType: input.mimeType ?? null,
        byteSize: input.byteSize ?? null,
        status: input.status ?? "REQUESTED",
        createdAt: now(),
        updatedAt: now(),
      };
      recordings.set(created.id, created);
      return created;
    },
    async findRecordingById(recordingId) {
      return recordings.get(recordingId) ?? null;
    },
    async listRecordings(eventId) {
      return [...recordings.values()]
        .filter((row) => row.eventId === eventId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async updateRecording(recordingId, data) {
      const current = recordings.get(recordingId);
      if (!current) {
        throw new Error("Recording not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      recordings.set(recordingId, updated);
      return updated;
    },
    async createTranscript(input) {
      const created: EventTranscriptRecord = {
        id: id("transcript"),
        eventId: input.eventId,
        recordingId: input.recordingId ?? null,
        source: input.source,
        text: input.text,
        summary: input.summary ?? null,
        jobStatus: input.jobStatus ?? "QUEUED",
        createdAt: now(),
        updatedAt: now(),
      };
      transcripts.set(created.id, created);
      return created;
    },
    async listTranscripts(eventId) {
      return [...transcripts.values()]
        .filter((row) => row.eventId === eventId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async updateTranscript(transcriptId, data) {
      const current = transcripts.get(transcriptId);
      if (!current) {
        throw new Error("Transcript not found");
      }
      const updated = { ...current, ...data, updatedAt: now() };
      transcripts.set(transcriptId, updated);
      return updated;
    },
  };

  return store;
}
