import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json } from "@/lib/http";
import { summarizeTranscript } from "@/modules/events/event-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const transcript = await summarizeTranscript(auth.user, context.params.eventId, context.params.transcriptId);
  return json({ transcript });
});

export const OPTIONS = apiOptions();
