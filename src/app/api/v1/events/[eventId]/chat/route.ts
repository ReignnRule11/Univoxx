import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { listChatMessages, postChatMessage } from "@/modules/events/event-service";
import { createChatMessageSchema } from "@/modules/events/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const messages = await listChatMessages(auth.user, context.params.eventId);
  return json({ messages });
});

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createChatMessageSchema);
  const message = await postChatMessage(auth.user, context.params.eventId, body.body);
  return json({ message }, { status: 201 });
});

export const OPTIONS = apiOptions();
