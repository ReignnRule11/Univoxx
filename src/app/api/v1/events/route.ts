import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { createEvent, listOwnEvents } from "@/modules/events/event-service";
import { createEventSchema } from "@/modules/events/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const events = await listOwnEvents(auth.user.id);
  return json({ events });
});

export const POST = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createEventSchema);
  const event = await createEvent(auth.user, body);
  return json({ event }, { status: 201 });
});

export const OPTIONS = apiOptions();
