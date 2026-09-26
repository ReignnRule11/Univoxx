export const EVENT_STATUSES = ["DRAFT", "SCHEDULED", "LIVE", "ENDED", "CANCELLED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_ACCESS_TYPES = ["FREE", "SUBSCRIBER", "PAID"] as const;
export type EventAccessType = (typeof EVENT_ACCESS_TYPES)[number];

export const EVENT_ATTENDEE_STATUSES = ["REGISTERED", "CHECKED_IN", "LEFT"] as const;
export type EventAttendeeStatus = (typeof EVENT_ATTENDEE_STATUSES)[number];

export const EVENT_RECORDING_STATUSES = ["NONE", "REQUESTED", "AVAILABLE", "UNAVAILABLE"] as const;
export type EventRecordingStatus = (typeof EVENT_RECORDING_STATUSES)[number];

export const EVENT_CHAT_STATUSES = ["VISIBLE", "HIDDEN"] as const;
export type EventChatStatus = (typeof EVENT_CHAT_STATUSES)[number];

export const TRANSCRIPT_JOB_STATUSES = ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"] as const;
export type TranscriptJobStatus = (typeof TRANSCRIPT_JOB_STATUSES)[number];

export type EventRecord = {
  id: string;
  communityId: string | null;
  organizationId: string | null;
  hostId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  accessType: EventAccessType;
  priceCents: number | null;
  currency: string;
  capacity: number | null;
  status: EventStatus;
  publishedAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  cancelledAt: Date | null;
  liveProvider: string | null;
  liveRoomId: string | null;
  recordingStatus: EventRecordingStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type EventAttendeeRecord = {
  id: string;
  eventId: string;
  userId: string;
  status: EventAttendeeStatus;
  transactionId: string | null;
  registeredAt: Date;
  checkedInAt: Date | null;
  leftAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EventChatMessageRecord = {
  id: string;
  eventId: string;
  authorId: string;
  body: string;
  status: EventChatStatus;
  createdAt: Date;
};

export type EventRecordingRecord = {
  id: string;
  eventId: string;
  provider: string;
  providerRef: string | null;
  storageKey: string | null;
  mimeType: string | null;
  byteSize: number | null;
  status: EventRecordingStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type EventTranscriptRecord = {
  id: string;
  eventId: string;
  recordingId: string | null;
  source: string;
  text: string;
  summary: string | null;
  jobStatus: TranscriptJobStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicEvent = {
  id: string;
  communityId: string | null;
  organizationId: string | null;
  hostId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  accessType: EventAccessType;
  priceCents: number | null;
  currency: string;
  capacity: number | null;
  status: EventStatus;
  publishedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  cancelledAt: string | null;
  liveProvider: string | null;
  recordingStatus: EventRecordingStatus;
  createdAt: string;
  updatedAt: string;
};

export type PublicAttendee = {
  id: string;
  eventId: string;
  userId: string;
  status: EventAttendeeStatus;
  registeredAt: string;
  checkedInAt: string | null;
  leftAt: string | null;
};

export type PublicChatMessage = {
  id: string;
  eventId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type PublicLiveRoom = {
  provider: string;
  roomId: string;
  joinUrl: string;
  token: string;
  role: "host" | "attendee";
  recordingSupported: boolean;
};

export type PublicRecording = {
  id: string;
  eventId: string;
  provider: string;
  status: EventRecordingStatus;
  mimeType: string | null;
  byteSize: number | null;
  downloadPath: string | null;
  createdAt: string;
};

export type PublicTranscript = {
  id: string;
  eventId: string;
  source: string;
  text: string;
  summary: string | null;
  jobStatus: TranscriptJobStatus;
  createdAt: string;
};
