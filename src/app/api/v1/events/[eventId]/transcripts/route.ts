import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { createTranscript, listTranscripts } from "@/modules/events/event-service";
import { createTranscriptSchema } from "@/modules/events/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const transcripts = await listTranscripts(auth.user, context.params.eventId);
  return json({ transcripts });
});

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, createTranscriptSchema);
  const transcript = await createTranscript(auth.user, context.params.eventId, body);
  return json({ transcript }, { status: 201 });
});

export const OPTIONS = apiOptions();
