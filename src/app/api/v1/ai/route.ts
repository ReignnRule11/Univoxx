import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json } from "@/lib/http";
import { listOwnJobs, refuseFinancialAuthority } from "@/modules/ai/ai-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request) => {
  const auth = await requireAuth(request);
  const jobs = await listOwnJobs(auth.user.id);
  return json({
    module: "ai",
    endpoints: [
      "POST /api/v1/ai/captions",
      "POST /api/v1/ai/repurpose",
      "POST /api/v1/ai/analytics/explain",
      "POST /api/v1/events/{eventId}/transcripts/{transcriptId}/summary",
      "GET /api/v1/ai/usage",
    ],
    jobs,
  });
});

export const POST = apiRoute(async (request) => {
  await requireAuth(request);
  refuseFinancialAuthority();
});

export const OPTIONS = apiOptions();
