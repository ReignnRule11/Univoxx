import { apiOptions, apiRoute } from "@/lib/api-route";
import { requireAuth } from "@/lib/auth";
import { json, parseJsonBody } from "@/lib/http";
import { updateReport } from "@/modules/community/moderation-service";
import { updateReportStatusSchema } from "@/modules/community/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = apiRoute(async (request, context) => {
  const auth = await requireAuth(request);
  const body = await parseJsonBody(request, updateReportStatusSchema);
  const report = await updateReport(auth.user, context.params.communityId, context.params.reportId, body.status);
  return json({ report });
});

export const OPTIONS = apiOptions();
