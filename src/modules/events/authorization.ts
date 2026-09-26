import { forbidden, notFound } from "@/lib/errors";
import { getEventsStore } from "./store";
import type { EventAttendeeRecord, EventRecord } from "./types";

export async function requireEvent(eventId: string): Promise<EventRecord> {
  const event = await getEventsStore().findEventById(eventId);
  if (!event) {
    throw notFound("Event not found");
  }
  return event;
}

export async function requireEventHost(eventId: string, userId: string): Promise<EventRecord> {
  const event = await requireEvent(eventId);
  if (event.hostId !== userId) {
    throw forbidden("Only the event host can manage this event");
  }
  return event;
}

export function isPublishedEvent(event: EventRecord): boolean {
  return event.status === "SCHEDULED" || event.status === "LIVE" || event.status === "ENDED";
}

export async function requireRegisteredAttendee(eventId: string, userId: string): Promise<EventAttendeeRecord> {
  const attendee = await getEventsStore().findAttendee(eventId, userId);
  if (!attendee) {
    throw forbidden("Registration required");
  }
  return attendee;
}
