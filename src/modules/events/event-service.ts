import { conflict, forbidden, notFound, serviceUnavailable, validationError } from "@/lib/errors";
import { getLiveRoomProvider } from "@/lib/live";
import { checksumSha256, getStorageProvider } from "@/lib/storage";
import { requireCommunityView } from "@/modules/community/authorization";
import { requireOrganizationMember } from "@/modules/identity/authorization";
import type { UserRecord } from "@/modules/identity/types";
import { getPaymentsStore } from "@/modules/payments/store";
import { isPublishedEvent, requireEvent, requireEventHost, requireRegisteredAttendee } from "./authorization";
import { publicAttendee, publicChatMessage, publicEvent, publicRecording, publicTranscript } from "./serializers";
import { getEventsStore } from "./store";
import type {
  EventAccessType,
  EventRecord,
  PublicAttendee,
  PublicChatMessage,
  PublicEvent,
  PublicLiveRoom,
  PublicRecording,
  PublicTranscript,
} from "./types";

const ALLOWED_TRANSITIONS: Record<EventRecord["status"], EventRecord["status"][]> = {
  DRAFT: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["LIVE", "CANCELLED"],
  LIVE: ["ENDED"],
  ENDED: [],
  CANCELLED: [],
};

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError(`Invalid ${field}`);
  }
  return date;
}

function assertTransition(from: EventRecord["status"], to: EventRecord["status"]): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw conflict(`Invalid event transition ${from} -> ${to}`);
  }
}

async function assertTenantAccess(
  user: UserRecord,
  input: { communityId?: string | null; organizationId?: string | null },
): Promise<{ communityId: string | null; organizationId: string | null }> {
  if (input.communityId) {
    const { community } = await requireCommunityView(user.id, input.communityId);
    return { communityId: community.id, organizationId: community.organizationId };
  }
  if (input.organizationId) {
    await requireOrganizationMember(user.id, input.organizationId, "CREATOR");
    return { communityId: null, organizationId: input.organizationId };
  }
  return { communityId: null, organizationId: null };
}

async function assertCanViewEvent(event: EventRecord, userId: string): Promise<void> {
  if (event.hostId === userId) {
    return;
  }
  if (event.status === "DRAFT" || event.status === "CANCELLED") {
    throw notFound("Event not found");
  }
  if (event.communityId) {
    await requireCommunityView(userId, event.communityId);
  }
}

async function hasSubscriberAccess(userId: string, creatorId: string): Promise<boolean> {
  const membership = await getPaymentsStore().findActiveMembership(userId, creatorId);
  return Boolean(membership);
}

async function hasPaidAccess(event: EventRecord, userId: string, transactionId?: string): Promise<boolean> {
  if (!transactionId) {
    return false;
  }
  const transaction = await getPaymentsStore().findTransactionById(transactionId);
  if (!transaction) {
    return false;
  }
  return (
    transaction.status === "SUCCEEDED" &&
    transaction.payerId === userId &&
    transaction.recipientId === event.hostId
  );
}

export async function createEvent(
  user: UserRecord,
  input: {
    title: string;
    description?: string;
    communityId?: string;
    organizationId?: string;
    startsAt: string;
    endsAt?: string;
    accessType?: EventAccessType;
    priceCents?: number;
    currency?: string;
    capacity?: number;
  },
): Promise<PublicEvent> {
  const tenant = await assertTenantAccess(user, input);
  const startsAt = parseDate(input.startsAt, "startsAt");
  const endsAt = input.endsAt ? parseDate(input.endsAt, "endsAt") : null;
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw validationError("endsAt must be after startsAt");
  }
  const accessType = input.accessType ?? "FREE";
  const event = await getEventsStore().createEvent({
    communityId: tenant.communityId,
    organizationId: tenant.organizationId,
    hostId: user.id,
    title: input.title,
    description: input.description ?? null,
    startsAt,
    endsAt,
    accessType,
    priceCents: accessType === "PAID" ? (input.priceCents ?? null) : null,
    currency: (input.currency ?? "USD").toUpperCase(),
    capacity: input.capacity ?? null,
  });
  return publicEvent(event);
}

export async function listOwnEvents(userId: string): Promise<PublicEvent[]> {
  const events = await getEventsStore().listEventsByHost(userId);
  return events.map(publicEvent);
}

export async function getEvent(eventId: string, userId: string): Promise<PublicEvent> {
  const event = await requireEvent(eventId);
  await assertCanViewEvent(event, userId);
  return publicEvent(event);
}

export async function updateEvent(
  user: UserRecord,
  eventId: string,
  input: {
    title?: string;
    description?: string | null;
    startsAt?: string;
    endsAt?: string | null;
    accessType?: EventAccessType;
    priceCents?: number | null;
    currency?: string;
    capacity?: number | null;
  },
): Promise<PublicEvent> {
  const event = await requireEventHost(eventId, user.id);
  if (event.status === "LIVE" || event.status === "ENDED" || event.status === "CANCELLED") {
    throw forbidden("Event can no longer be edited");
  }
  const startsAt = input.startsAt ? parseDate(input.startsAt, "startsAt") : event.startsAt;
  const endsAt =
    input.endsAt === undefined ? event.endsAt : input.endsAt === null ? null : parseDate(input.endsAt, "endsAt");
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw validationError("endsAt must be after startsAt");
  }
  const accessType = input.accessType ?? event.accessType;
  if (accessType === "PAID" && input.priceCents === null) {
    throw validationError("priceCents is required for paid events");
  }
  const updated = await getEventsStore().updateEvent(event.id, {
    title: input.title,
    description: input.description,
    startsAt,
    endsAt,
    accessType,
    priceCents: accessType === "PAID" ? (input.priceCents ?? event.priceCents) : null,
    currency: input.currency,
    capacity: input.capacity,
  });
  return publicEvent(updated);
}

export async function publishEvent(user: UserRecord, eventId: string): Promise<PublicEvent> {
  const event = await requireEventHost(eventId, user.id);
  assertTransition(event.status, "SCHEDULED");
  const updated = await getEventsStore().updateEvent(event.id, {
    status: "SCHEDULED",
    publishedAt: new Date(),
  });
  return publicEvent(updated);
}

export async function cancelEvent(user: UserRecord, eventId: string): Promise<PublicEvent> {
  const event = await requireEventHost(eventId, user.id);
  assertTransition(event.status, "CANCELLED");
  const updated = await getEventsStore().updateEvent(event.id, {
    status: "CANCELLED",
    cancelledAt: new Date(),
  });
  return publicEvent(updated);
}

export async function startEvent(user: UserRecord, eventId: string): Promise<{ event: PublicEvent; room: PublicLiveRoom }> {
  const event = await requireEventHost(eventId, user.id);
  assertTransition(event.status, "LIVE");
  const provider = getLiveRoomProvider();
  const room = await provider.createRoom({ eventId: event.id, title: event.title });
  const updated = await getEventsStore().updateEvent(event.id, {
    status: "LIVE",
    startedAt: new Date(),
    liveProvider: room.provider,
    liveRoomId: room.roomId,
  });
  return {
    event: publicEvent(updated),
    room: {
      provider: room.provider,
      roomId: room.roomId,
      joinUrl: room.joinUrl,
      token: room.hostToken,
      role: "host",
      recordingSupported: room.recordingSupported,
    },
  };
}

export async function endEvent(user: UserRecord, eventId: string): Promise<PublicEvent> {
  const event = await requireEventHost(eventId, user.id);
  assertTransition(event.status, "ENDED");
  if (event.liveRoomId) {
    await getLiveRoomProvider().closeRoom(event.liveRoomId);
  }
  const updated = await getEventsStore().updateEvent(event.id, {
    status: "ENDED",
    endedAt: new Date(),
  });
  return publicEvent(updated);
}

export async function registerForEvent(
  user: UserRecord,
  eventId: string,
  transactionId?: string,
): Promise<PublicAttendee> {
  const event = await requireEvent(eventId);
  if (event.hostId === user.id) {
    throw forbidden("Hosts do not register for their own event");
  }
  if (!isPublishedEvent(event) && event.status !== "SCHEDULED") {
    throw forbidden("Event is not open for registration");
  }
  if (event.status === "CANCELLED" || event.status === "ENDED" || event.status === "DRAFT") {
    throw forbidden("Event is not open for registration");
  }
  if (event.communityId) {
    await requireCommunityView(user.id, event.communityId);
  }
  if (event.accessType === "SUBSCRIBER") {
    if (!(await hasSubscriberAccess(user.id, event.hostId))) {
      throw forbidden("Active creator subscription required");
    }
  }
  if (event.accessType === "PAID") {
    if (!(await hasPaidAccess(event, user.id, transactionId))) {
      throw forbidden("Verified payment required for this event");
    }
  }
  const store = getEventsStore();
  if (event.capacity) {
    const count = await store.countAttendees(event.id);
    if (count >= event.capacity) {
      throw conflict("Event is at capacity");
    }
  }
  const attendee = await store.createAttendee({
    eventId: event.id,
    userId: user.id,
    transactionId: transactionId ?? null,
  });
  return publicAttendee(attendee);
}

export async function listAttendees(user: UserRecord, eventId: string): Promise<PublicAttendee[]> {
  const event = await requireEventHost(eventId, user.id);
  const attendees = await getEventsStore().listAttendees(event.id);
  return attendees.map(publicAttendee);
}

export async function checkInAttendee(user: UserRecord, eventId: string): Promise<{ attendee: PublicAttendee; room: PublicLiveRoom }> {
  const event = await requireEvent(eventId);
  if (event.status !== "LIVE" || !event.liveRoomId || !event.liveProvider) {
    throw forbidden("Event is not live");
  }
  if (event.hostId === user.id) {
    const room = await hostRoom(event);
    const hostAttendee = await getEventsStore().findAttendee(event.id, user.id);
    return {
      attendee: hostAttendee
        ? publicAttendee(hostAttendee)
        : {
            id: event.hostId,
            eventId: event.id,
            userId: event.hostId,
            status: "CHECKED_IN",
            registeredAt: event.createdAt.toISOString(),
            checkedInAt: new Date().toISOString(),
            leftAt: null,
          },
      room,
    };
  }
  const attendee = await requireRegisteredAttendee(event.id, user.id);
  const now = new Date();
  const updated = await getEventsStore().updateAttendee(attendee.id, {
    status: "CHECKED_IN",
    checkedInAt: attendee.checkedInAt ?? now,
    leftAt: null,
  });
  const provider = getLiveRoomProvider();
  return {
    attendee: publicAttendee(updated),
    room: {
      provider: event.liveProvider,
      roomId: event.liveRoomId,
      joinUrl: `/live/${event.liveRoomId}`,
      token: `attendee_${event.liveRoomId}`,
      role: "attendee",
      recordingSupported: provider.name !== "local",
    },
  };
}

async function hostRoom(event: EventRecord): Promise<PublicLiveRoom> {
  if (!event.liveRoomId || !event.liveProvider) {
    throw forbidden("Event is not live");
  }
  return {
    provider: event.liveProvider,
    roomId: event.liveRoomId,
    joinUrl: `/live/${event.liveRoomId}`,
    token: `host_${event.liveRoomId}`,
    role: "host",
    recordingSupported: event.liveProvider !== "local",
  };
}

export async function leaveEvent(user: UserRecord, eventId: string): Promise<PublicAttendee> {
  const attendee = await requireRegisteredAttendee(eventId, user.id);
  const updated = await getEventsStore().updateAttendee(attendee.id, {
    status: "LEFT",
    leftAt: new Date(),
  });
  return publicAttendee(updated);
}

export async function postChatMessage(user: UserRecord, eventId: string, body: string): Promise<PublicChatMessage> {
  const event = await requireEvent(eventId);
  if (event.status !== "LIVE") {
    throw forbidden("Chat is only available while the event is live");
  }
  if (event.hostId !== user.id) {
    const attendee = await requireRegisteredAttendee(event.id, user.id);
    if (attendee.status !== "CHECKED_IN") {
      throw forbidden("Check-in required before chatting");
    }
  }
  const message = await getEventsStore().createChatMessage({ eventId: event.id, authorId: user.id, body });
  return publicChatMessage(message);
}

export async function listChatMessages(user: UserRecord, eventId: string): Promise<PublicChatMessage[]> {
  const event = await requireEvent(eventId);
  if (event.hostId !== user.id) {
    await requireRegisteredAttendee(event.id, user.id);
  }
  const messages = await getEventsStore().listChatMessages(event.id);
  return messages.map(publicChatMessage);
}

export async function requestRecording(user: UserRecord, eventId: string): Promise<PublicRecording> {
  const event = await requireEventHost(eventId, user.id);
  if (event.status !== "LIVE" && event.status !== "ENDED") {
    throw forbidden("Recording can only be requested after the event has started");
  }
  if (!event.liveRoomId || !event.liveProvider) {
    throw serviceUnavailable("Live room is not available");
  }
  const result = await getLiveRoomProvider().requestRecording(event.liveRoomId);
  const recording = await getEventsStore().createRecording({
    eventId: event.id,
    provider: event.liveProvider,
    providerRef: result.providerRef ?? null,
    status: result.available ? "AVAILABLE" : "UNAVAILABLE",
  });
  await getEventsStore().updateEvent(event.id, {
    recordingStatus: recording.status,
  });
  return publicRecording(recording);
}

export async function listRecordings(user: UserRecord, eventId: string): Promise<PublicRecording[]> {
  const event = await requireEvent(eventId);
  if (event.hostId !== user.id) {
    await requireRegisteredAttendee(event.id, user.id);
  }
  const recordings = await getEventsStore().listRecordings(event.id);
  return recordings.map(publicRecording);
}

export async function uploadRecording(
  user: UserRecord,
  eventId: string,
  file: { filename: string; mimeType: string; body: Buffer },
): Promise<PublicRecording> {
  const event = await requireEventHost(eventId, user.id);
  if (event.status !== "ENDED") {
    throw forbidden("Recordings can only be stored after the event ends");
  }
  const storage = getStorageProvider();
  const key = `events/${event.id}/recordings/${crypto.randomUUID()}-${file.filename}`;
  await storage.put(key, file.body, file.mimeType);
  checksumSha256(file.body);
  const recording = await getEventsStore().createRecording({
    eventId: event.id,
    provider: "storage",
    storageKey: key,
    mimeType: file.mimeType,
    byteSize: file.body.byteLength,
    status: "AVAILABLE",
  });
  await getEventsStore().updateEvent(event.id, { recordingStatus: "AVAILABLE" });
  return publicRecording(recording);
}

export async function getRecordingFile(
  user: UserRecord,
  eventId: string,
  recordingId: string,
): Promise<{ body: Buffer; contentType: string }> {
  const event = await requireEvent(eventId);
  if (event.hostId !== user.id) {
    await requireRegisteredAttendee(event.id, user.id);
  }
  const recording = await getEventsStore().findRecordingById(recordingId);
  if (!recording || recording.eventId !== event.id) {
    throw notFound("Recording not found");
  }
  if (recording.status !== "AVAILABLE" || !recording.storageKey) {
    throw serviceUnavailable("Recording media is not available");
  }
  const stored = await getStorageProvider().get(recording.storageKey);
  if (!stored) {
    throw notFound("Recording media is not stored");
  }
  return { body: stored.body, contentType: stored.contentType };
}

export async function createTranscript(
  user: UserRecord,
  eventId: string,
  input: { text: string; source?: string },
): Promise<PublicTranscript> {
  const event = await requireEventHost(eventId, user.id);
  if (event.status !== "ENDED") {
    throw forbidden("Transcripts can only be stored after the event ends");
  }
  const transcript = await getEventsStore().createTranscript({
    eventId: event.id,
    source: input.source ?? "upload",
    text: input.text,
    jobStatus: "QUEUED",
  });
  return publicTranscript(transcript);
}

export async function summarizeTranscript(user: UserRecord, eventId: string, transcriptId: string): Promise<PublicTranscript> {
  const { summarizeEventTranscript } = await import("@/modules/ai/ai-service");
  return summarizeEventTranscript(user, eventId, transcriptId);
}

export async function listTranscripts(user: UserRecord, eventId: string): Promise<PublicTranscript[]> {
  const event = await requireEvent(eventId);
  if (event.hostId !== user.id) {
    await requireRegisteredAttendee(event.id, user.id);
  }
  const transcripts = await getEventsStore().listTranscripts(event.id);
  return transcripts.map(publicTranscript);
}
