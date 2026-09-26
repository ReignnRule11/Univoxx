import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { getEvent, updateEvent } from "@/modules/events/event-service";
import { updateEventSchema } from "@/modules/events/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const event = await getEvent(context.params.eventId, auth.user.id);
  return json({ event });
});

export const PATCH = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, updateEventSchema);
  const event = await updateEvent(auth.user, context.params.eventId, body);
  return json({ event });
});

export const OPTIONS = apiOptions();
