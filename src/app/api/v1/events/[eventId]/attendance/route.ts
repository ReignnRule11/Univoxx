import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json } from "@/lib/http";
import { checkInAttendee, leaveEvent } from "@/modules/events/event-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const result = await checkInAttendee(auth.user, context.params.eventId);
  return json(result);
});

export const DELETE = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const attendee = await leaveEvent(auth.user, context.params.eventId);
  return json({ attendee });
});

export const OPTIONS = apiOptions();
