import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json } from "@/lib/http";
import { startEvent } from "@/modules/events/event-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const result = await startEvent(auth.user, context.params.eventId);
  return json(result);
});

export const OPTIONS = apiOptions();
