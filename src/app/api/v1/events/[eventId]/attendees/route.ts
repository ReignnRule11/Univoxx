import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json } from "@/lib/http";
import { listAttendees } from "@/modules/events/event-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const attendees = await listAttendees(auth.user, context.params.eventId);
  return json({ attendees });
});

export const OPTIONS = apiOptions();
