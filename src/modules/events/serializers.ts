import type {
  EventAttendeeRecord,
  EventChatMessageRecord,
  EventRecord,
  EventRecordingRecord,
  EventTranscriptRecord,
  PublicAttendee,
  PublicChatMessage,
  PublicEvent,
  PublicRecording,
  PublicTranscript,
} from "./types";

export function publicEvent(event: EventRecord): PublicEvent {
  return {
    id: event.id,
    communityId: event.communityId,
    organizationId: event.organizationId,
    hostId: event.hostId,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt ? event.endsAt.toISOString() : null,
    accessType: event.accessType,
    priceCents: event.priceCents,
    currency: event.currency,
    capacity: event.capacity,
    status: event.status,
    publishedAt: event.publishedAt ? event.publishedAt.toISOString() : null,
    startedAt: event.startedAt ? event.startedAt.toISOString() : null,
    endedAt: event.endedAt ? event.endedAt.toISOString() : null,
    cancelledAt: event.cancelledAt ? event.cancelledAt.toISOString() : null,
    liveProvider: event.liveProvider,
    recordingStatus: event.recordingStatus,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export function publicAttendee(attendee: EventAttendeeRecord): PublicAttendee {
  return {
    id: attendee.id,
    eventId: attendee.eventId,
    userId: attendee.userId,
    status: attendee.status,
    registeredAt: attendee.registeredAt.toISOString(),
    checkedInAt: attendee.checkedInAt ? attendee.checkedInAt.toISOString() : null,
    leftAt: attendee.leftAt ? attendee.leftAt.toISOString() : null,
  };
}

export function publicChatMessage(message: EventChatMessageRecord): PublicChatMessage {
  return {
    id: message.id,
    eventId: message.eventId,
    authorId: message.authorId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

export function publicRecording(recording: EventRecordingRecord): PublicRecording {
  return {
    id: recording.id,
    eventId: recording.eventId,
    provider: recording.provider,
    status: recording.status,
    mimeType: recording.mimeType,
    byteSize: recording.byteSize,
    downloadPath:
      recording.status === "AVAILABLE" && recording.storageKey
        ? `/api/v1/events/${recording.eventId}/recordings/${recording.id}`
        : null,
    createdAt: recording.createdAt.toISOString(),
  };
}

export function publicTranscript(transcript: EventTranscriptRecord): PublicTranscript {
  return {
    id: transcript.id,
    eventId: transcript.eventId,
    source: transcript.source,
    text: transcript.text,
    summary: transcript.summary,
    jobStatus: transcript.jobStatus,
    createdAt: transcript.createdAt.toISOString(),
  };
}
