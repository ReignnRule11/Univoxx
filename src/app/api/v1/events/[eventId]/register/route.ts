import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBodyOptional } from "@/lib/http";
import { registerForEvent } from "@/modules/events/event-service";
import { registerEventSchema } from "@/modules/events/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBodyOptional(request, registerEventSchema);
  const attendee = await registerForEvent(auth.user, context.params.eventId, body.transactionId);
  return json({ attendee }, { status: 201 });
});

export const OPTIONS = apiOptions();
